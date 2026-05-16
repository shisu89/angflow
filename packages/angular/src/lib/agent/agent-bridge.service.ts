import {
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  Optional,
  effect,
  inject,
  runInInjectionContext,
  signal,
  type EffectRef,
} from '@angular/core';

import type { NgFlowService } from '../services/ng-flow.service';
import type { Node, Edge } from '../types';
import { AgentHistory } from './history';
import type { AgentHistoryOptions } from './history';
import { AGENT_TOOL_SCHEMAS } from './tool-schemas';
import type {
  AgentInbound,
  AgentResponse,
  AgentTransport,
  AgentEvent,
} from './types';

/** Provider token holding the user-supplied transport(s). */
export const AGENT_TRANSPORTS = new InjectionToken<AgentTransport[]>('AngflowAgentTransports');

/** Provider token for history config. `false` disables history entirely. */
export const AGENT_HISTORY_OPTIONS = new InjectionToken<AgentHistoryOptions | false>(
  'AngflowAgentHistoryOptions',
);

const ERROR_INVALID_PARAMS = -32602;
const ERROR_METHOD_NOT_FOUND = -32601;
const ERROR_FLOW_NOT_FOUND = -32000;
const ERROR_INTERNAL = -32603;

const MUTATING_TOOLS = new Set<string>([
  'add_node',
  'add_nodes',
  'add_edge',
  'add_edges',
  'update_node',
  'update_node_data',
  'update_edge',
  'update_edge_data',
  'delete_elements',
  'set_nodes',
  'set_edges',
]);
// apply_changes is treated specially — see dispatch logic.

type RegisteredFlow = {
  service: NgFlowService;
  watcher: EffectRef;
};

type ToolHandler = (
  flow: NgFlowService,
  params: Record<string, unknown>,
) => unknown | Promise<unknown>;

/**
 * Routes JSON-RPC requests from one or more transports to registered
 * `NgFlowService` instances, and pushes change events back to the agent.
 *
 * Provide via {@link provideAgentBridge}; register a flow by calling
 * `register(id, ngFlowService)` from `(init)` on `<ng-flow>`.
 *
 * @example
 * ```ts
 * // appConfig.ts
 * providers: [
 *   provideAgentBridge({
 *     transports: [new WindowTransport({ namespace: 'angflow' })],
 *   }),
 * ]
 *
 * // some-component.ts
 * bridge = inject(AngflowAgentBridge);
 *
 * onInit(flow: NgFlowService) {
 *   this.bridge.register('main', flow);
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class AngflowAgentBridge {
  /** Schemas for every exposed tool — feed straight to a Claude / OpenAI tools array. */
  readonly toolSchemas = AGENT_TOOL_SCHEMAS;

  private readonly flows = new Map<string, RegisteredFlow>();
  private readonly transports: AgentTransport[];
  private readonly history: AgentHistory | null;
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly injector = inject(Injector);
  private started = false;

  /** Bumped every time a flow registers/unregisters. Useful for diagnostics. */
  readonly registeredFlows = signal<string[]>([]);

  constructor(
    @Optional() @Inject(AGENT_TRANSPORTS) transports: AgentTransport[] | null,
    @Optional() @Inject(AGENT_HISTORY_OPTIONS) historyOptions: AgentHistoryOptions | false | null,
  ) {
    this.transports = transports ?? [];
    this.history =
      historyOptions === false ? null : new AgentHistory(historyOptions ?? undefined);
    this.installHandlers();
    this.start();
  }

  /**
   * Register a flow under `id`. The bridge subscribes to its `nodes`,
   * `edges`, and `viewport` signals and emits change events to all
   * transports.
   *
   * Returns a disposer; if not called manually, registration leaks until
   * the bridge itself is torn down. In Angular components, call from
   * `(init)` on `<ng-flow>` and pair with `OnDestroy`.
   */
  register(id: string, flow: NgFlowService): () => void {
    if (this.flows.has(id)) {
      this.flows.get(id)!.watcher.destroy();
    }

    const watcher = this.watchFlow(id, flow);
    this.flows.set(id, { service: flow, watcher });
    this.registeredFlows.set(Array.from(this.flows.keys()));
    this.emit({ event: 'flow.registered', params: { flowId: id } });

    return () => this.unregister(id);
  }

  unregister(id: string): void {
    const entry = this.flows.get(id);
    if (!entry) return;
    entry.watcher.destroy();
    this.flows.delete(id);
    this.history?.dropFlow(id);
    this.registeredFlows.set(Array.from(this.flows.keys()));
    this.emit({ event: 'flow.unregistered', params: { flowId: id } });
  }

  /** Look up a registered flow. */
  getFlow(id: string): NgFlowService | undefined {
    return this.flows.get(id)?.service;
  }

  /**
   * Invoke a tool directly without going through a transport. Useful for
   * in-process callers (tests, devtools snippets, Angular components that
   * want to share the same dispatch logic).
   */
  async callTool(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`Unknown tool: ${method}`);
    }
    if (method === 'list_flows') {
      return handler(null as unknown as NgFlowService, params);
    }
    const flow = this.resolveFlow(params['flowId']);
    return handler(flow, params);
  }

  // ── Internals ────────────────────────────────────────────────────────

  private start(): void {
    if (this.started) return;
    this.started = true;
    for (const t of this.transports) {
      void t.start((req) => this.dispatch(req));
    }
  }

  private async dispatch(req: AgentInbound): Promise<AgentResponse> {
    const handler = this.handlers.get(req.method);
    if (!handler) {
      return {
        id: req.id,
        error: { code: ERROR_METHOD_NOT_FOUND, message: `Unknown method: ${req.method}` },
      };
    }
    try {
      const params = req.params ?? {};
      if (req.method === 'list_flows') {
        const result = await handler(null as unknown as NgFlowService, params);
        return { id: req.id, result };
      }
      const flow = this.resolveFlow(params['flowId']);
      const flowId = this.findFlowId(flow);
      const isApplyChanges = req.method === 'apply_changes';

      // Pre-mutation snapshot for history capture. Skipped for non-mutating tools.
      let snapshot: { nodes: readonly Node[]; edges: readonly Edge[] } | null = null;
      if (this.history && (MUTATING_TOOLS.has(req.method) || isApplyChanges)) {
        snapshot = { nodes: flow.getNodes().slice(), edges: flow.getEdges().slice() };
      }

      const result = await handler(flow, params);

      // Commit the captured snapshot to history. For apply_changes, the handler
      // either succeeded entirely or threw and was rolled back already.
      if (snapshot && flowId && this.history) {
        if (isApplyChanges) {
          const ops = (params['ops'] as Array<Record<string, unknown>>) ?? [];
          const hasNonSelection = ops.some(
            (o) =>
              o['op'] !== 'select_nodes' &&
              o['op'] !== 'select_edges' &&
              o['op'] !== 'deselect_all',
          );
          if (hasNonSelection) {
            this.history.capture(flowId, snapshot);
            this.emitHistory(flowId);
          }
        } else {
          this.history.capture(flowId, snapshot);
          this.emitHistory(flowId);
        }
      }

      return { id: req.id, result: result ?? null };
    } catch (err) {
      if (err instanceof FlowNotFoundError) {
        return { id: req.id, error: { code: ERROR_FLOW_NOT_FOUND, message: err.message } };
      }
      if (err instanceof InvalidParamsError) {
        return { id: req.id, error: { code: ERROR_INVALID_PARAMS, message: err.message } };
      }
      if (err instanceof ApplyChangesError) {
        return {
          id: req.id,
          error: {
            code: ERROR_INTERNAL,
            message: err.message,
            data: { failedIndex: err.failedIndex },
          },
        };
      }
      return {
        id: req.id,
        error: {
          code: ERROR_INTERNAL,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  private findFlowId(flow: NgFlowService): string | null {
    for (const [id, entry] of this.flows.entries()) {
      if (entry.service === flow) return id;
    }
    return null;
  }

  private emitHistory(flowId: string): void {
    if (!this.history) return;
    const status = this.history.status(flowId);
    this.emit({ event: 'flow.history', params: { flowId, ...status } });
  }

  private emit(evt: AgentEvent): void {
    for (const t of this.transports) {
      try {
        t.send(evt);
      } catch {
        // Transport errors are isolated per-transport; never let one break the bridge.
      }
    }
  }

  private resolveFlow(rawId: unknown): NgFlowService {
    if (typeof rawId === 'string' && rawId.length > 0) {
      const entry = this.flows.get(rawId);
      if (!entry) throw new FlowNotFoundError(`No flow registered with id "${rawId}"`);
      return entry.service;
    }
    if (this.flows.size === 0) {
      throw new FlowNotFoundError('No flows are registered with the agent bridge.');
    }
    if (this.flows.size > 1) {
      throw new InvalidParamsError(
        `Multiple flows registered (${Array.from(this.flows.keys()).join(', ')}); pass flowId to disambiguate.`,
      );
    }
    return this.flows.values().next().value!.service;
  }

  private watchFlow(id: string, flow: NgFlowService): EffectRef {
    let pending = false;
    let lastSignature = '';
    return runInInjectionContext(this.injector, () =>
      effect(() => {
        // Touch every signal we want to broadcast so the effect re-runs on change.
        flow.nodes();
        flow.edges();
        flow.viewport();
        flow.selectedNodes();
        flow.selectedEdges();

        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          // Re-read on flush so coalesced bursts see the latest state.
          const params = {
            flowId: id,
            nodes: flow.getNodes(),
            edges: flow.getEdges(),
            viewport: flow.getViewport(),
            selection: {
              nodeIds: flow.selectedNodes().map((n: Node) => n.id),
              edgeIds: flow.selectedEdges().map((e: Edge) => e.id),
            },
          };
          // Suppress duplicate emissions when controlled-mode round-trips bounce
          // the same state through the store twice. Cheap signature: ids + counts.
          const sig = signatureOf(params);
          if (sig === lastSignature) return;
          lastSignature = sig;
          this.emit({ event: 'flow.state', params });
        });
      }),
    );
  }

  private installHandlers(): void {
    this.handlers.set('list_flows', () => Array.from(this.flows.keys()));

    this.handlers.set('get_state', (flow) => ({
      nodes: flow.getNodes(),
      edges: flow.getEdges(),
      viewport: flow.getViewport(),
    }));

    this.handlers.set('get_nodes', (flow) => flow.getNodes());
    this.handlers.set('get_edges', (flow) => flow.getEdges());

    this.handlers.set('get_node', (flow, params) => {
      const id = requireString(params, 'id');
      return flow.getNode(id) ?? null;
    });

    this.handlers.set('get_edge', (flow, params) => {
      const id = requireString(params, 'id');
      return flow.getEdge(id) ?? null;
    });

    this.handlers.set('add_node', (flow, params) => {
      const node = requireObject(params, 'node') as Node;
      flow.addNodes(node);
      return flow.getNode(node.id) ?? null;
    });

    this.handlers.set('add_edge', (flow, params) => {
      const edge = requireObject(params, 'edge') as Edge;
      flow.addEdges(edge);
      return flow.getEdge(edge.id) ?? null;
    });

    this.handlers.set('update_node', (flow, params) => {
      const id = requireString(params, 'id');
      const patch = requireObject(params, 'patch') as Partial<Node>;
      flow.updateNode(id, patch);
      return flow.getNode(id) ?? null;
    });

    this.handlers.set('update_edge', (flow, params) => {
      const id = requireString(params, 'id');
      const patch = requireObject(params, 'patch') as Partial<Edge>;
      flow.updateEdge(id, patch);
      return flow.getEdge(id) ?? null;
    });

    this.handlers.set('delete_elements', async (flow, params) => {
      const nodeIds = optionalStringArray(params, 'nodeIds');
      const edgeIds = optionalStringArray(params, 'edgeIds');
      const result = await flow.deleteElements({
        nodes: nodeIds?.map((id) => ({ id })) ?? [],
        edges: edgeIds?.map((id) => ({ id })) ?? [],
      });
      return {
        deletedNodeIds: result.deletedNodes.map((n: Node) => n.id),
        deletedEdgeIds: result.deletedEdges.map((e: Edge) => e.id),
      };
    });

    this.handlers.set('set_nodes', (flow, params) => {
      const nodes = requireArray(params, 'nodes') as Node[];
      flow.setNodes(nodes);
    });

    this.handlers.set('set_edges', (flow, params) => {
      const edges = requireArray(params, 'edges') as Edge[];
      flow.setEdges(edges);
    });

    this.handlers.set('fit_view', (flow, params) => {
      const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      const nodeIds = optionalStringArray(params, 'nodeIds');
      const nodes = nodeIds
        ? nodeIds
            .map((id) => flow.getNode(id))
            .filter((n): n is Node => !!n)
            .map((n) => ({ id: n.id }))
        : undefined;
      return flow.fitView({ padding, duration, nodes });
    });

    this.handlers.set('set_viewport', (flow, params) => {
      const viewport = requireObject(params, 'viewport') as { x: number; y: number; zoom: number };
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      flow.setViewport(viewport, { duration });
    });

    this.handlers.set('get_viewport', (flow) => flow.getViewport());

    this.handlers.set('get_internal_node', (flow, params) => {
      const id = requireString(params, 'id');
      const internal = flow.getInternalNode(id);
      if (!internal) return null;
      return {
        id: internal.id,
        positionAbsolute: internal.internals?.positionAbsolute ?? internal.position,
        measured: internal.measured
          ? { width: internal.measured.width, height: internal.measured.height }
          : null,
        handleBounds: internal.internals?.handleBounds ?? null,
      };
    });

    this.handlers.set('get_nodes_bounds', (flow, params) => {
      const nodeIds = optionalStringArray(params, 'nodeIds');
      const nodes = nodeIds ? flow.getNodes(nodeIds) : flow.getNodes();
      return flow.getNodesBounds(nodes);
    });

    this.handlers.set('get_intersecting_nodes', (flow, params) => {
      const id = requireString(params, 'id');
      const partially = typeof params['partially'] === 'boolean' ? (params['partially'] as boolean) : true;
      const node = flow.getNode(id);
      if (!node) return [];
      return flow.getIntersectingNodes(node, partially);
    });

    this.handlers.set('is_node_in_area', (flow, params) => {
      const id = requireString(params, 'id');
      const area = requireObject(params, 'area') as { x: number; y: number; width: number; height: number };
      const partially = typeof params['partially'] === 'boolean' ? (params['partially'] as boolean) : true;
      const node = flow.getNode(id);
      if (!node) return false;
      return flow.isNodeIntersecting(node, area, partially);
    });

    this.handlers.set('get_outgoers', (flow, params) => {
      const id = requireString(params, 'id');
      // Use the signal-based selector then read its current value to stay non-reactive at the JSON boundary.
      return flow.selectOutgoers(id)();
    });

    this.handlers.set('get_incomers', (flow, params) => {
      const id = requireString(params, 'id');
      return flow.selectIncomers(id)();
    });

    this.handlers.set('get_connected_edges', (flow, params) => {
      const nodeIds = optionalStringArray(params, 'nodeIds');
      if (!nodeIds) throw new InvalidParamsError('Param "nodeIds" must be an array of strings.');
      return flow.getConnectedEdges(nodeIds);
    });

    this.handlers.set('get_node_connections', (flow, params) => {
      const nodeId = requireString(params, 'nodeId');
      return flow.getNodeConnections(nodeId);
    });

    this.handlers.set('get_handle_connections', (flow, params) => {
      const nodeId = requireString(params, 'nodeId');
      const type = requireString(params, 'type');
      if (type !== 'source' && type !== 'target') {
        throw new InvalidParamsError('Param "type" must be "source" or "target".');
      }
      const handleId = typeof params['handleId'] === 'string' ? (params['handleId'] as string) : undefined;
      return flow.getHandleConnections({ nodeId, type, id: handleId });
    });

    this.handlers.set('get_handle_data', (flow, params) => {
      const nodeId = requireString(params, 'nodeId');
      const type = requireString(params, 'type');
      if (type !== 'source' && type !== 'target') {
        throw new InvalidParamsError('Param "type" must be "source" or "target".');
      }
      const rawHandleId = params['handleId'];
      if (rawHandleId !== null && typeof rawHandleId !== 'string') {
        throw new InvalidParamsError('Param "handleId" must be a string or null.');
      }
      return flow.getHandleData(nodeId, rawHandleId as string | null, type) ?? null;
    });

    this.handlers.set('screen_to_flow_position', (flow, params) => {
      const position = requireObject(params, 'position') as { x: number; y: number };
      const snapToGrid = typeof params['snapToGrid'] === 'boolean' ? (params['snapToGrid'] as boolean) : undefined;
      return flow.screenToFlowPosition(position, snapToGrid !== undefined ? { snapToGrid } : undefined);
    });

    this.handlers.set('flow_to_screen_position', (flow, params) => {
      const position = requireObject(params, 'position') as { x: number; y: number };
      return flow.flowToScreenPosition(position);
    });

    this.handlers.set('zoom_in', (flow, params) => {
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      return flow.zoomIn({ duration });
    });

    this.handlers.set('zoom_out', (flow, params) => {
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      return flow.zoomOut({ duration });
    });

    this.handlers.set('zoom_to', (flow, params) => {
      const level = params['level'];
      if (typeof level !== 'number') throw new InvalidParamsError('Param "level" must be a number.');
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      return flow.zoomTo(level, { duration });
    });

    this.handlers.set('set_center', (flow, params) => {
      const x = params['x'];
      const y = params['y'];
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new InvalidParamsError('Params "x" and "y" must be numbers.');
      }
      const zoom = typeof params['zoom'] === 'number' ? (params['zoom'] as number) : undefined;
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      return flow.setCenter(x, y, { zoom, duration });
    });

    this.handlers.set('fit_bounds', (flow, params) => {
      const bounds = requireObject(params, 'bounds') as { x: number; y: number; width: number; height: number };
      const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      return flow.fitBounds(bounds, { padding, duration });
    });

    this.handlers.set('add_nodes', (flow, params) => {
      const nodes = requireArray(params, 'nodes') as Node[];
      flow.addNodes(nodes);
      return nodes.map((n) => flow.getNode(n.id)).filter((n): n is Node => !!n);
    });

    this.handlers.set('add_edges', (flow, params) => {
      const edges = requireArray(params, 'edges') as Edge[];
      flow.addEdges(edges);
      return edges.map((e) => flow.getEdge(e.id)).filter((e): e is Edge => !!e);
    });

    this.handlers.set('update_node_data', (flow, params) => {
      const id = requireString(params, 'id');
      const dataPatch = requireObject(params, 'dataPatch');
      flow.updateNodeData(id, dataPatch);
      return flow.getNode(id) ?? null;
    });

    this.handlers.set('update_edge_data', (flow, params) => {
      const id = requireString(params, 'id');
      const dataPatch = requireObject(params, 'dataPatch');
      flow.updateEdgeData(id, dataPatch);
      return flow.getEdge(id) ?? null;
    });

    this.handlers.set('select_nodes', (flow, params) => {
      const nodeIds = optionalStringArray(params, 'nodeIds');
      if (!nodeIds) throw new InvalidParamsError('Param "nodeIds" must be an array of strings.');
      const additive = typeof params['additive'] === 'boolean' ? (params['additive'] as boolean) : false;
      flow.setSelection({ nodeIds, additive });
      return { selectedNodeIds: flow.selectedNodes().map((n) => n.id) };
    });

    this.handlers.set('select_edges', (flow, params) => {
      const edgeIds = optionalStringArray(params, 'edgeIds');
      if (!edgeIds) throw new InvalidParamsError('Param "edgeIds" must be an array of strings.');
      const additive = typeof params['additive'] === 'boolean' ? (params['additive'] as boolean) : false;
      flow.setSelection({ edgeIds, additive });
      return { selectedEdgeIds: flow.selectedEdges().map((e) => e.id) };
    });

    this.handlers.set('deselect_all', (flow) => {
      flow.setSelection({ nodeIds: [], edgeIds: [], additive: false });
    });

    this.handlers.set('apply_changes', (flow, params) => {
      const ops = requireArray(params, 'ops') as Array<Record<string, unknown>>;

      // Capture snapshot for rollback. Viewport is not part of the snapshot per design.
      const snapshot = {
        nodes: flow.getNodes().slice(),
        edges: flow.getEdges().slice(),
      };

      const results: Array<{ ok: true; value: unknown }> = [];
      let failure: { failedIndex: number; cause: unknown } | null = null;

      flow.batch(() => {
        for (let i = 0; i < ops.length; i++) {
          try {
            results.push({ ok: true, value: executeOp(flow, ops[i]) });
          } catch (err) {
            failure = { failedIndex: i, cause: err };
            break;
          }
        }
      });

      if (failure) {
        flow.batch(() => {
          flow.setNodes(snapshot.nodes as Node[]);
          flow.setEdges(snapshot.edges as Edge[]);
        });
        const f = failure as { failedIndex: number; cause: unknown };
        const message = f.cause instanceof Error ? f.cause.message : String(f.cause);
        throw new ApplyChangesError(f.failedIndex, message);
      }

      return { results };
    });

    this.handlers.set('undo', (flow, params) => {
      if (!this.history) return { undone: 0, canUndo: false, canRedo: false };
      const flowId = this.findFlowId(flow);
      if (!flowId) return { undone: 0, canUndo: false, canRedo: false };
      const steps = typeof params['steps'] === 'number' ? (params['steps'] as number) : 1;
      const current = { nodes: flow.getNodes().slice(), edges: flow.getEdges().slice() };
      const result = this.history.undo(flowId, steps, current);
      if (result) {
        flow.batch(() => {
          flow.setNodes(result.snapshot.nodes as Node[]);
          flow.setEdges(result.snapshot.edges as Edge[]);
        });
      }
      this.emitHistory(flowId);
      const status = this.history.status(flowId);
      return { undone: result?.consumed ?? 0, canUndo: status.canUndo, canRedo: status.canRedo };
    });

    this.handlers.set('redo', (flow, params) => {
      if (!this.history) return { redone: 0, canUndo: false, canRedo: false };
      const flowId = this.findFlowId(flow);
      if (!flowId) return { redone: 0, canUndo: false, canRedo: false };
      const steps = typeof params['steps'] === 'number' ? (params['steps'] as number) : 1;
      const current = { nodes: flow.getNodes().slice(), edges: flow.getEdges().slice() };
      const result = this.history.redo(flowId, steps, current);
      if (result) {
        flow.batch(() => {
          flow.setNodes(result.snapshot.nodes as Node[]);
          flow.setEdges(result.snapshot.edges as Edge[]);
        });
      }
      this.emitHistory(flowId);
      const status = this.history.status(flowId);
      return { redone: result?.consumed ?? 0, canUndo: status.canUndo, canRedo: status.canRedo };
    });

    this.handlers.set('history_status', (flow) => {
      if (!this.history) return { canUndo: false, canRedo: false, pastDepth: 0, futureDepth: 0 };
      const flowId = this.findFlowId(flow);
      if (!flowId) return { canUndo: false, canRedo: false, pastDepth: 0, futureDepth: 0 };
      return this.history.status(flowId);
    });

    this.handlers.set('clear_history', (flow) => {
      if (!this.history) return;
      const flowId = this.findFlowId(flow);
      if (!flowId) return;
      this.history.clear(flowId);
      this.emitHistory(flowId);
    });
  }
}

class FlowNotFoundError extends Error {}
class InvalidParamsError extends Error {}
class ApplyChangesError extends Error {
  constructor(public readonly failedIndex: number, message: string) {
    super(message);
  }
}

function signatureOf(params: {
  flowId: string;
  nodes: readonly { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }[];
  edges: readonly { id: string; source: string; target: string }[];
  viewport: { x: number; y: number; zoom: number };
  selection: { nodeIds: string[]; edgeIds: string[] };
}): string {
  const n = params.nodes
    .map((n) => `${n.id}:${n.position.x},${n.position.y}:${n.measured?.width ?? '-'}x${n.measured?.height ?? '-'}`)
    .join('|');
  const e = params.edges.map((e) => `${e.id}:${e.source}>${e.target}`).join('|');
  const v = `${params.viewport.x},${params.viewport.y},${params.viewport.zoom}`;
  const s = `${params.selection.nodeIds.join(',')}/${params.selection.edgeIds.join(',')}`;
  return `${n}#${e}#${v}#${s}`;
}

function executeOp(flow: NgFlowService, op: Record<string, unknown>): unknown {
  const kind = op['op'];
  switch (kind) {
    case 'add_node': {
      const node = op['node'] as Node;
      if (!node || typeof node !== 'object') throw new InvalidParamsError('add_node: missing "node".');
      flow.addNodes(node);
      return flow.getNode(node.id) ?? null;
    }
    case 'add_nodes': {
      const nodes = op['nodes'] as Node[];
      if (!Array.isArray(nodes)) throw new InvalidParamsError('add_nodes: "nodes" must be an array.');
      flow.addNodes(nodes);
      return nodes.map((n) => flow.getNode(n.id)).filter((n): n is Node => !!n);
    }
    case 'add_edge': {
      const edge = op['edge'] as Edge;
      if (!edge || typeof edge !== 'object') throw new InvalidParamsError('add_edge: missing "edge".');
      flow.addEdges(edge);
      return flow.getEdge(edge.id) ?? null;
    }
    case 'add_edges': {
      const edges = op['edges'] as Edge[];
      if (!Array.isArray(edges)) throw new InvalidParamsError('add_edges: "edges" must be an array.');
      flow.addEdges(edges);
      return edges.map((e) => flow.getEdge(e.id)).filter((e): e is Edge => !!e);
    }
    case 'update_node': {
      const id = op['id'];
      const patch = op['patch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_node: "id" must be a string.');
      if (!patch || typeof patch !== 'object') throw new InvalidParamsError('update_node: "patch" must be an object.');
      if (!flow.getNode(id)) throw new InvalidParamsError(`update_node: node "${id}" not found.`);
      flow.updateNode(id, patch as Partial<Node>);
      return flow.getNode(id) ?? null;
    }
    case 'update_node_data': {
      const id = op['id'];
      const dataPatch = op['dataPatch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_node_data: "id" must be a string.');
      if (!dataPatch || typeof dataPatch !== 'object') throw new InvalidParamsError('update_node_data: "dataPatch" must be an object.');
      if (!flow.getNode(id)) throw new InvalidParamsError(`update_node_data: node "${id}" not found.`);
      flow.updateNodeData(id, dataPatch as Record<string, unknown>);
      return flow.getNode(id) ?? null;
    }
    case 'update_edge': {
      const id = op['id'];
      const patch = op['patch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_edge: "id" must be a string.');
      if (!patch || typeof patch !== 'object') throw new InvalidParamsError('update_edge: "patch" must be an object.');
      if (!flow.getEdge(id)) throw new InvalidParamsError(`update_edge: edge "${id}" not found.`);
      flow.updateEdge(id, patch as Partial<Edge>);
      return flow.getEdge(id) ?? null;
    }
    case 'update_edge_data': {
      const id = op['id'];
      const dataPatch = op['dataPatch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_edge_data: "id" must be a string.');
      if (!dataPatch || typeof dataPatch !== 'object') throw new InvalidParamsError('update_edge_data: "dataPatch" must be an object.');
      if (!flow.getEdge(id)) throw new InvalidParamsError(`update_edge_data: edge "${id}" not found.`);
      flow.updateEdgeData(id, dataPatch as Record<string, unknown>);
      return flow.getEdge(id) ?? null;
    }
    case 'delete_elements': {
      const nodeIds = Array.isArray(op['nodeIds']) ? (op['nodeIds'] as string[]) : [];
      const edgeIds = Array.isArray(op['edgeIds']) ? (op['edgeIds'] as string[]) : [];
      // deleteElements is async because of onBeforeDelete; inside apply_changes we
      // intentionally do not await — the synchronous setNodes/setEdges paths are
      // what we need for rollback semantics. Skip onBeforeDelete hooks inside batches.
      const allEdgeIds = new Set(edgeIds);
      for (const e of flow.getEdges()) {
        if (nodeIds.includes(e.source) || nodeIds.includes(e.target)) allEdgeIds.add(e.id);
      }
      if (nodeIds.length > 0) {
        flow.setNodes(flow.getNodes().filter((n) => !nodeIds.includes(n.id)));
      }
      if (allEdgeIds.size > 0) {
        flow.setEdges(flow.getEdges().filter((e) => !allEdgeIds.has(e.id)));
      }
      return { deletedNodeIds: nodeIds, deletedEdgeIds: Array.from(allEdgeIds) };
    }
    case 'select_nodes': {
      const nodeIds = op['nodeIds'];
      if (!Array.isArray(nodeIds)) throw new InvalidParamsError('select_nodes: "nodeIds" must be an array.');
      const additive = typeof op['additive'] === 'boolean' ? (op['additive'] as boolean) : false;
      flow.setSelection({ nodeIds: nodeIds as string[], additive });
      return null;
    }
    case 'select_edges': {
      const edgeIds = op['edgeIds'];
      if (!Array.isArray(edgeIds)) throw new InvalidParamsError('select_edges: "edgeIds" must be an array.');
      const additive = typeof op['additive'] === 'boolean' ? (op['additive'] as boolean) : false;
      flow.setSelection({ edgeIds: edgeIds as string[], additive });
      return null;
    }
    case 'deselect_all': {
      flow.setSelection({ nodeIds: [], edgeIds: [], additive: false });
      return null;
    }
    default:
      throw new InvalidParamsError(`Unknown op kind: ${String(kind)}`);
  }
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string') throw new InvalidParamsError(`Param "${key}" must be a string.`);
  return value;
}

function requireObject(params: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = params[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidParamsError(`Param "${key}" must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(params: Record<string, unknown>, key: string): unknown[] {
  const value = params[key];
  if (!Array.isArray(value)) throw new InvalidParamsError(`Param "${key}" must be an array.`);
  return value;
}

function optionalStringArray(params: Record<string, unknown>, key: string): string[] | undefined {
  const value = params[key];
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new InvalidParamsError(`Param "${key}" must be an array of strings.`);
  }
  return value as string[];
}

import {
  DestroyRef,
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  Optional,
  effect,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';

import type { FitViewResult } from '@angflow/system';
import type { NgFlowService } from '../services/ng-flow.service';
import type { Node, Edge } from '../types';
import type { AgentLayoutFn, NodeTemplateSpec } from '../types/node-template';
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

/** Optional error sink. Receives transport/dispatch failures that the bridge swallows. */
export const AGENT_ON_ERROR = new InjectionToken<
  (err: unknown, ctx: { kind: 'transport-start' | 'transport-send' | 'dispatch'; transport?: AgentTransport; method?: string }) => void
>('AngflowAgentOnError');

/** Optional host-provided layout function backing the `layout_nodes` tool. */
export const AGENT_LAYOUT = new InjectionToken<AgentLayoutFn>('AngflowAgentLayout');

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
  'group_nodes',
  'set_node_group',
  'set_group_collapsed',
  'dissolve_group',
]);
// apply_changes is treated specially — see dispatch logic.

/** Max flow.state emission rate while any node drag is in progress. */
const DRAG_STATE_EMIT_INTERVAL_MS = 100;

type RegisteredFlow = {
  service: NgFlowService;
  /** Tears down the watcher and prevents any in-flight microtask from emitting. */
  dispose: () => void;
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly layoutFn: AgentLayoutFn | null;
  private started = false;
  private nextInProcessId = 1;
  // Shared across flows; mintId's per-flow collision check guarantees uniqueness.
  private nextNodeIdSeq = 0;
  private warnedOnBeforeDeleteBypass = false;

  /** Bumped every time a flow registers/unregisters. Useful for diagnostics. */
  readonly registeredFlows = signal<string[]>([]);

  private readonly onError:
    | ((err: unknown, ctx: { kind: 'transport-start' | 'transport-send' | 'dispatch'; transport?: AgentTransport; method?: string }) => void)
    | null;

  constructor(
    @Optional() @Inject(AGENT_TRANSPORTS) transports: AgentTransport[] | null,
    @Optional() @Inject(AGENT_HISTORY_OPTIONS) historyOptions: AgentHistoryOptions | false | null,
    @Optional() @Inject(AGENT_ON_ERROR) onError: ((err: unknown, ctx: { kind: 'transport-start' | 'transport-send' | 'dispatch'; transport?: AgentTransport; method?: string }) => void) | null,
    @Optional() @Inject(AGENT_LAYOUT) layoutFn: AgentLayoutFn | null,
  ) {
    this.transports = transports ?? [];
    this.history =
      historyOptions === false ? null : new AgentHistory(historyOptions ?? undefined);
    this.onError = onError ?? null;
    this.layoutFn = layoutFn ?? null;
    this.installHandlers();
    this.start();
    this.destroyRef.onDestroy(() => this.stop());
  }

  private reportError(err: unknown, ctx: { kind: 'transport-start' | 'transport-send' | 'dispatch'; transport?: AgentTransport; method?: string }): void {
    if (!this.onError) return;
    try {
      this.onError(err, ctx);
    } catch {
      // An onError handler must not crash the bridge.
    }
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
    const existing = this.flows.get(id);
    if (existing) {
      // Idempotent re-register: same id + same service is a no-op so callers
      // can safely call from (init) without tracking lifecycle.
      if (existing.service === flow) {
        return () => this.unregister(id);
      }
      // Different service under the same id: tear down the old watcher and
      // drop history (the previous snapshots refer to a different graph and
      // restoring them into this service would corrupt it).
      existing.dispose();
      this.history?.dropFlow(id);
    }

    const dispose = this.watchFlow(id, flow);
    this.flows.set(id, { service: flow, dispose });
    this.registeredFlows.set(Array.from(this.flows.keys()));
    this.emit({ event: 'flow.registered', params: { flowId: id } });

    return () => this.unregister(id);
  }

  unregister(id: string): void {
    const entry = this.flows.get(id);
    if (!entry) return;
    entry.dispose();
    this.flows.delete(id);
    this.history?.dropFlow(id);
    this.registeredFlows.set(Array.from(this.flows.keys()));
    this.emit({ event: 'flow.unregistered', params: { flowId: id } });
  }

  /** Look up a registered flow. */
  getFlow(id: string): NgFlowService | undefined {
    return this.flows.get(id)?.service;
  }

  /** Mint a unique node/group id for a flow (collision-safe vs agent-supplied ids). */
  private mintId(flow: NgFlowService, prefix: string): string {
    let id: string;
    do {
      id = `${prefix}_${++this.nextNodeIdSeq}`;
    } while (flow.getNode(id));
    return id;
  }

  /**
   * Invoke a tool directly without going through a transport. Behaves
   * identically to a JSON-RPC request: captures a history snapshot, emits
   * `flow.history` / `flow.state` events, and throws a structured error
   * (with `code` and `data` attached) on failure.
   */
  async callTool(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const response = await this.dispatch({
      id: `in-process:${this.nextInProcessId++}`,
      method,
      params,
    });
    if ('error' in response) {
      const err = new Error(response.error.message) as Error & { code?: number; data?: unknown };
      err.code = response.error.code;
      err.data = response.error.data;
      throw err;
    }
    return response.result;
  }

  // ── Internals ────────────────────────────────────────────────────────

  private start(): void {
    if (this.started) return;
    this.started = true;
    for (const t of this.transports) {
      try {
        const maybePromise = t.start((req) => this.dispatch(req));
        if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
          (maybePromise as Promise<void>).catch((err) =>
            this.reportError(err, { kind: 'transport-start', transport: t }),
          );
        }
      } catch (err) {
        this.reportError(err, { kind: 'transport-start', transport: t });
      }
    }
  }

  /** Stop all transports. Invoked automatically when the owning injector is destroyed. */
  private stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const t of this.transports) {
      try {
        t.stop();
      } catch {
        // A transport that throws during teardown must not break the others.
      }
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
        // list_flows ignores the service arg; null stub avoids resolving a flow.
        const result = await handler(null as unknown as NgFlowService, params);
        return { id: req.id, result };
      }
      const flow = this.resolveFlow(params['flowId']);
      const flowId = this.findFlowId(flow);
      const isApplyChanges = req.method === 'apply_changes';
      const isLayout = req.method === 'layout_nodes';

      // Pre-mutation snapshot for history capture. Skipped for non-mutating tools.
      // Shallow-clone each element so subsequent in-place mutations (notably
      // the drag fast-path in FlowStore) can't retroactively corrupt the
      // snapshot we already captured.
      let snapshot: { nodes: readonly Node[]; edges: readonly Edge[] } | null = null;
      if (this.history && (MUTATING_TOOLS.has(req.method) || isApplyChanges || isLayout)) {
        snapshot = {
          nodes: flow.getNodes().map((n) => ({ ...n })) as Node[],
          edges: flow.getEdges().map((e) => ({ ...e })) as Edge[],
        };
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
        } else if (isLayout) {
          // Capture only when at least one position was applied — an empty
          // layout pass must not pollute the undo stack.
          const positions =
            (result as { positions?: Record<string, unknown> } | null)?.positions ?? {};
          if (Object.keys(positions).length > 0) {
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
      if (err instanceof MethodUnavailableError) {
        return { id: req.id, error: { code: ERROR_METHOD_NOT_FOUND, message: err.message } };
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
      // Anything that lands here is an unexpected throw inside a handler — a
      // bug or an underlying service failure. Surface it via onError so the
      // host can log / report it; the wire response is still -32603.
      this.reportError(err, { kind: 'dispatch', method: req.method });
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
      } catch (err) {
        // Transport errors are isolated per-transport; never let one break the
        // bridge. Forward to onError if the host wants to observe them.
        this.reportError(err, { kind: 'transport-send', transport: t });
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

  private watchFlow(id: string, flow: NgFlowService): () => void {
    let pending = false;
    let destroyed = false;
    let lastSignature = '';
    let lastEmitTime = Number.NEGATIVE_INFINITY;
    let trailingTimer: ReturnType<typeof setTimeout> | null = null;

    const emitState = (isDrag: boolean) => {
      // Re-read at emit time so coalesced/throttled bursts see the latest state.
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
      const sig = signatureOf(params);
      if (sig === lastSignature) return;
      lastSignature = sig;
      // Only record the drag-emission timestamp when actually in a drag — so a
      // non-drag emission (register, mutation tool) does not push back the next
      // drag frame's throttle window.
      if (isDrag) {
        lastEmitTime = Date.now();
      } else {
        lastEmitTime = Number.NEGATIVE_INFINITY;
      }
      this.emit({ event: 'flow.state', params });
    };

    const ref = runInInjectionContext(this.injector, () =>
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
          // A queued microtask may outlive the effect (unregister between
          // effect run and microtask drain). Drop late emissions so we never
          // push state for a flowId that's no longer registered.
          if (destroyed) return;
          // While a drag is in flight the store re-emits nodes per pointer
          // frame; serializing the whole graph at that rate floods every
          // transport. Throttle to one emission per interval with a trailing
          // emit so the final drag state is never lost. The timer only
          // schedules the emission — no view state is written here.
          const dragging = flow.getNodes().some((n: Node) => n.dragging === true);
          if (dragging) {
            const elapsed = Date.now() - lastEmitTime;
            if (elapsed < DRAG_STATE_EMIT_INTERVAL_MS) {
              if (trailingTimer === null) {
                trailingTimer = setTimeout(() => {
                  trailingTimer = null;
                  if (destroyed) return;
                  emitState(true);
                }, DRAG_STATE_EMIT_INTERVAL_MS - elapsed);
              }
              return;
            }
          }
          if (trailingTimer !== null) {
            clearTimeout(trailingTimer);
            trailingTimer = null;
          }
          emitState(dragging);
        });
      }),
    );
    return () => {
      destroyed = true;
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      ref.destroy();
    };
  }

  private installHandlers(): void {
    this.handlers.set('list_flows', () => Array.from(this.flows.keys()));

    this.handlers.set('get_state', (flow, params) => {
      const hasGroup = params['groupId'] !== undefined;
      const hasBounds = params['bounds'] !== undefined;
      if (hasGroup && hasBounds) {
        throw new InvalidParamsError('Pass either "groupId" or "bounds", not both.');
      }
      const allNodes = flow.getNodes();
      const allEdges = flow.getEdges();
      let nodes = allNodes;
      let edges = allEdges;
      if (hasGroup) {
        const groupId = requireString(params, 'groupId');
        if (!flow.getNode(groupId)) {
          throw new InvalidParamsError(`get_state: no node with id "${groupId}".`);
        }
        const ids = descendantIdsOf(groupId, buildChildMap(allNodes));
        nodes = allNodes.filter((n) => ids.has(n.id));
        edges = inducedEdges(allEdges, ids);
      } else if (hasBounds) {
        const rect = requireRect(params, 'bounds');
        nodes = allNodes.filter((n) => flow.isNodeIntersecting(n, rect, true));
        const idSet = new Set(nodes.map((n) => n.id));
        edges = inducedEdges(allEdges, idSet);
      }
      return {
        nodes,
        edges,
        viewport: flow.getViewport(),
        collapsedHiddenIds: flow.getCollapsedHiddenIds(),
      };
    });

    this.handlers.set('get_summary', (flow) => {
      const nodes = flow.getNodes();
      const edges = flow.getEdges();
      const childMap = buildChildMap(nodes);
      const groups = nodes
        .filter((n) => n.type === 'group')
        .map((g) => ({
          id: g.id,
          label: nodeTitle(g),
          collapsed: g.collapsed === true,
          memberCount: descendantIdsOf(g.id, childMap).size,
        }));
      return {
        counts: { nodes: nodes.length, edges: edges.length, groups: groups.length },
        groups,
        titles: nodes.map((n) => ({ id: n.id, type: n.type ?? 'default', label: nodeTitle(n) })),
        viewport: flow.getViewport(),
        bounds: nodes.length > 0 ? flow.getNodesBounds(nodes) : null,
        collapsedHiddenIds: flow.getCollapsedHiddenIds(),
      };
    });

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
      // Shallow-clone so we never mutate the caller's params object when minting.
      const raw = { ...requireObject(params, 'node') };
      if (raw['id'] == null || raw['id'] === '') {
        raw['id'] = this.mintId(flow, 'node');
      }
      const node = validateNodeShape(raw, 'add_node');
      flow.addNodes(node);
      return flow.getNode(node.id) ?? null;
    });

    this.handlers.set('group_nodes', async (flow, params) => {
      const nodeIds = optionalStringArray(params, 'nodeIds');
      if (!nodeIds || nodeIds.length === 0) {
        throw new InvalidParamsError('Param "nodeIds" must be a non-empty array of strings.');
      }
      for (const id of nodeIds) {
        if (!flow.getNode(id)) throw new InvalidParamsError(`group_nodes: unknown node id "${id}".`);
      }
      const suppliedGroupId = typeof params['groupId'] === 'string' && params['groupId'] ? (params['groupId'] as string) : undefined;
      if (suppliedGroupId && flow.getNode(suppliedGroupId)) {
        throw new InvalidParamsError(`group_nodes: a node with id "${suppliedGroupId}" already exists.`);
      }
      const groupId = suppliedGroupId ?? this.mintId(flow, 'group');
      const label = typeof params['label'] === 'string' ? (params['label'] as string) : undefined;
      const collapsed = typeof params['collapsed'] === 'boolean' ? (params['collapsed'] as boolean) : undefined;
      // padding/headerHeight: inline typeof (not optionalPositiveNumber) — 0 is a valid inset.
      const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
      const headerHeight = typeof params['headerHeight'] === 'number' ? (params['headerHeight'] as number) : undefined;
      await flow.groupNodes(nodeIds, { groupId, label, collapsed, padding, headerHeight });
      return { groupId };
    });

    this.handlers.set('set_node_group', async (flow, params) => {
      const nodeId = requireString(params, 'nodeId');
      if (!flow.getNode(nodeId)) throw new InvalidParamsError(`set_node_group: unknown node id "${nodeId}".`);
      const rawGroup = params['groupId'];
      if (rawGroup !== null && typeof rawGroup !== 'string') {
        throw new InvalidParamsError('Param "groupId" must be a string or null.');
      }
      const groupId = rawGroup as string | null;
      if (groupId !== null) {
        if (!flow.getNode(groupId)) throw new InvalidParamsError(`set_node_group: unknown group id "${groupId}".`);
        if (groupId === nodeId || descendantIdsOf(nodeId, buildChildMap(flow.getNodes())).has(groupId)) {
          throw new InvalidParamsError('set_node_group: groupId would create a cycle (it is the node or a descendant).');
        }
      }
      await flow.setNodeGroup(nodeId, groupId);
      return { nodeId, groupId };
    });

    this.handlers.set('add_edge', (flow, params) => {
      const edge = validateEdgeShape(requireObject(params, 'edge'), 'add_edge');
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
      const nodes = requireArray(params, 'nodes').map((n, i) =>
        validateNodeShape(n, `set_nodes[${i}]`),
      );
      flow.setNodes(nodes);
    });

    this.handlers.set('set_edges', (flow, params) => {
      const edges = requireArray(params, 'edges').map((e, i) =>
        validateEdgeShape(e, `set_edges[${i}]`),
      );
      flow.setEdges(edges);
    });

    this.handlers.set('fit_view', (flow, params) => {
      const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      const minZoom = optionalPositiveNumber(params, 'minZoom');
      const nodeIds = optionalStringArray(params, 'nodeIds');
      const nodes = nodeIds
        ? nodeIds
            .map((id) => flow.getNode(id))
            .filter((n): n is Node => !!n)
            .map((n) => ({ id: n.id }))
        : undefined;
      return flow.fitView({ padding, duration, minZoom, nodes });
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
      const minZoom = optionalPositiveNumber(params, 'minZoom');
      return flow.fitBounds(bounds, { padding, duration, minZoom });
    });

    this.handlers.set('add_nodes', (flow, params) => {
      const nodes = requireArray(params, 'nodes').map((n, i) =>
        validateNodeShape(n, `add_nodes[${i}]`),
      );
      flow.addNodes(nodes);
      return nodes.map((n) => flow.getNode(n.id)).filter((n): n is Node => !!n);
    });

    this.handlers.set('add_edges', (flow, params) => {
      const edges = requireArray(params, 'edges').map((e, i) =>
        validateEdgeShape(e, `add_edges[${i}]`),
      );
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

      // apply_changes' delete_elements op takes the synchronous setNodes/
      // setEdges path so the whole batch can roll back, which means
      // onBeforeDelete is bypassed (it can't be awaited inside a rollback-
      // capable batch). Warn once per bridge lifetime if the host actually
      // has the veto hook registered — otherwise the silent veto-loss is
      // very hard to discover.
      if (!this.warnedOnBeforeDeleteBypass && flow.hasOnBeforeDeleteHook()) {
        const hasDelete = ops.some((o) => o['op'] === 'delete_elements');
        if (hasDelete) {
          this.warnedOnBeforeDeleteBypass = true;
          console.warn(
            '[angflow] apply_changes/delete_elements bypasses onBeforeDelete. ' +
              'Call the standalone `delete_elements` tool if you need the veto hook.',
          );
        }
      }

      // Capture snapshot for rollback. Viewport is intentionally excluded.
      // Shallow-clone each element so in-place field assignments (e.g.
      // FlowStore's drag fast-path writing `node.position` / `node.dragging`)
      // cannot corrupt the snapshot mid-batch. We do not deep-clone `data`
      // because mutating `data` directly violates the documented contract.
      const snapshot = {
        nodes: flow.getNodes().map((n) => ({ ...n })) as Node[],
        edges: flow.getEdges().map((e) => ({ ...e })) as Edge[],
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
      const current = {
        nodes: flow.getNodes().map((n) => ({ ...n })) as Node[],
        edges: flow.getEdges().map((e) => ({ ...e })) as Edge[],
      };
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
      const current = {
        nodes: flow.getNodes().map((n) => ({ ...n })) as Node[],
        edges: flow.getEdges().map((e) => ({ ...e })) as Edge[],
      };
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

    this.handlers.set('list_node_types', (flow) => ({ types: flow.getNodeTypeNames() }));
    this.handlers.set('list_edge_types', (flow) => ({ types: flow.getEdgeTypeNames() }));

    this.handlers.set('register_node_template', (flow, params) => {
      const name = requireString(params, 'name');
      if (name.length === 0) {
        throw new InvalidParamsError('Param "name" must be a non-empty string.');
      }
      const spec = validateTemplateSpec(requireObject(params, 'spec'), 'register_node_template');
      const claimed = flow
        .getNodeTypeNames()
        .find((t) => t.name === name && t.source !== 'template');
      if (claimed) {
        throw new InvalidParamsError(
          `register_node_template: "${name}" is already registered by the ` +
            `${claimed.source === 'builtin' ? 'library' : 'host application'} and cannot be overridden.`,
        );
      }
      flow.registerNodeTemplate(name, spec);
      return { name };
    });

    this.handlers.set('unregister_node_template', (flow, params) => {
      const name = requireString(params, 'name');
      return { removed: flow.unregisterNodeTemplate(name) };
    });

    this.handlers.set('list_node_templates', (flow) => ({
      templates: flow.getNodeTemplates(),
    }));

    this.handlers.set('layout_nodes', async (flow, params) => {
      if (!this.layoutFn) {
        throw new MethodUnavailableError(
          'layout_nodes unavailable: no layout function configured. ' +
            'Pass `layout` to provideAgentBridge (e.g. dagreLayout from @angflow/angular/layout).',
        );
      }
      const direction = params['direction'] ?? 'TB';
      if (typeof direction !== 'string' || !['TB', 'LR', 'BT', 'RL'].includes(direction)) {
        throw new InvalidParamsError('Param "direction" must be one of: TB, LR, BT, RL.');
      }
      const nodeSep = typeof params['nodeSep'] === 'number' ? (params['nodeSep'] as number) : undefined;
      const rankSep = typeof params['rankSep'] === 'number' ? (params['rankSep'] as number) : undefined;
      const minZoom = optionalPositiveNumber(params, 'minZoom');
      const nodeIds = optionalStringArray(params, 'nodeIds');
      if (nodeIds) {
        for (const id of nodeIds) {
          if (!flow.getNode(id)) {
            throw new InvalidParamsError(`Param "nodeIds" contains unknown node id "${id}".`);
          }
        }
      }
      const targetNodes = nodeIds
        ? nodeIds.map((id) => flow.getNode(id)!)
        : flow.getNodes();
      const idSet = new Set(targetNodes.map((n) => n.id));

      const layoutNodes = targetNodes.map((n) => {
        const internal = flow.getInternalNode(n.id);
        return {
          id: n.id,
          width: internal?.measured?.width ?? n.width ?? 150,
          height: internal?.measured?.height ?? n.height ?? 40,
          position: { x: n.position.x, y: n.position.y },
          // Forward parentId only when the parent is also being laid out, so the
          // layout fn clusters grouped children within their group. Excluding the
          // parent (e.g. via nodeIds) drops it — the child is then a free node.
          parentId: n.parentId != null && idSet.has(n.parentId) ? n.parentId : undefined,
        };
      });
      // Induced subgraph: only edges with BOTH endpoints in the target set.
      const layoutEdges = flow
        .getEdges()
        .filter((e) => idSet.has(e.source) && idSet.has(e.target))
        .map((e) => ({ source: e.source, target: e.target }));

      const raw = await this.layoutFn(layoutNodes, layoutEdges, {
        direction: direction as 'TB' | 'LR' | 'BT' | 'RL',
        nodeSep,
        rankSep,
      });
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('layout function must return an object map of nodeId -> {x, y}.');
      }

      // Validate the full result BEFORE applying anything so a bad position
      // rolls back cleanly (nothing applied, no history entry).
      const applied: Record<string, { x: number; y: number }> = {};
      const unknownIds: string[] = [];
      for (const [id, pos] of Object.entries(raw as Record<string, { x: number; y: number }>)) {
        if (!idSet.has(id)) {
          unknownIds.push(id);
          continue;
        }
        if (
          !pos ||
          typeof pos.x !== 'number' ||
          typeof pos.y !== 'number' ||
          !Number.isFinite(pos.x) ||
          !Number.isFinite(pos.y)
        ) {
          throw new Error(`layout function returned an invalid position for node "${id}"`);
        }
        applied[id] = { x: pos.x, y: pos.y };
      }
      if (unknownIds.length > 0) {
        console.warn(
          `[angflow] layout_nodes: layout function returned positions for unknown node ids ` +
            `(ignored): ${unknownIds.join(', ')}`,
        );
      }

      // Re-check existence at apply time: the graph may have changed while the
      // (possibly async) layout fn ran — e.g. a human deleted a node. Only
      // nodes that still exist are moved, reported, and counted for history.
      const actuallyApplied: Record<string, { x: number; y: number }> = {};
      for (const [id, position] of Object.entries(applied)) {
        if (!flow.getNode(id)) continue;
        actuallyApplied[id] = position;
      }
      // Honors the host's [animate] input: positions tween when it's on, and
      // the await keeps the subsequent fitView measuring settled positions.
      // Layout fns emit flow-absolute coordinates, so apply in absolute space:
      // setNodePositions resolves each parented child against its parent's new
      // position, keeping grouped children inside their group.
      await flow.setNodePositions(actuallyApplied, { coordinateSpace: 'absolute' });

      const shouldFit = params['fitView'] !== false;
      let fit: FitViewResult | null = null;
      if (shouldFit && Object.keys(actuallyApplied).length > 0) {
        try {
          fit = await flow.fitView({ minZoom });
        } catch (err) {
          // Best-effort viewport fit: never fail the tool over a cosmetic step,
          // but surface the error to hosts observing onError.
          this.reportError(err, { kind: 'dispatch', method: 'layout_nodes' });
        }
      }
      return { positions: actuallyApplied, fit };
    });
  }
}

class FlowNotFoundError extends Error {}
class InvalidParamsError extends Error {}
/** Tool exists in the catalog but the deployment lacks a required capability. Maps to -32601. */
class MethodUnavailableError extends Error {}
class ApplyChangesError extends Error {
  constructor(public readonly failedIndex: number, message: string) {
    super(message);
  }
}

/**
 * Build a stable signature of the emit payload, used to suppress duplicate
 * emissions when controlled-mode round-trips bounce identical state through
 * the store twice. Must hash every field that can change via a mutating
 * tool — including `data`, `style`, `type`, `hidden`, `animated`, `label` —
 * otherwise `update_node_data` / `update_edge_data` updates would be silently
 * dropped.
 */
function signatureOf(params: {
  flowId: string;
  nodes: readonly Node[];
  edges: readonly Edge[];
  viewport: { x: number; y: number; zoom: number };
  selection: { nodeIds: string[]; edgeIds: string[] };
}): string {
  // Curated subset of node/edge fields that surface in `flow.state` consumers
  // (renderers, history, agents). Order is fixed by the literal so JSON.stringify
  // produces a deterministic string.
  const n = params.nodes.map((node) => ({
    id: node.id,
    p: [node.position.x, node.position.y],
    m: node.measured ? [node.measured.width ?? null, node.measured.height ?? null] : null,
    t: node.type ?? null,
    h: node.hidden === true,
    d: node.data ?? null,
    s: node.style ?? null,
  }));
  const e = params.edges.map((edge) => ({
    id: edge.id,
    src: edge.source,
    tgt: edge.target,
    sh: edge.sourceHandle ?? null,
    th: edge.targetHandle ?? null,
    t: edge.type ?? null,
    h: edge.hidden === true,
    a: edge.animated === true,
    l: edge.label ?? null,
    d: edge.data ?? null,
    s: edge.style ?? null,
  }));
  try {
    return JSON.stringify({ n, e, v: params.viewport, sel: params.selection });
  } catch {
    // Defensive: if any field is non-serializable (e.g. cyclic data), fall back
    // to a coarser signature so dedup never silently swallows updates.
    return `__nonserializable__:${Date.now()}:${Math.random()}`;
  }
}

function executeOp(flow: NgFlowService, op: Record<string, unknown>): unknown {
  const kind = op['op'];
  switch (kind) {
    case 'add_node': {
      const node = validateNodeShape(op['node'], 'apply_changes/add_node');
      flow.addNodes(node);
      return flow.getNode(node.id) ?? null;
    }
    case 'add_nodes': {
      const nodes = op['nodes'];
      if (!Array.isArray(nodes)) throw new InvalidParamsError('add_nodes: "nodes" must be an array.');
      if (nodes.length > MAX_BULK_ELEMENTS) {
        throw new InvalidParamsError(
          `add_nodes: "nodes" exceeds the maximum of ${MAX_BULK_ELEMENTS} elements per call (got ${nodes.length}).`,
        );
      }
      const validated = nodes.map((n, i) =>
        validateNodeShape(n, `apply_changes/add_nodes[${i}]`),
      );
      flow.addNodes(validated);
      return validated.map((n) => flow.getNode(n.id)).filter((n): n is Node => !!n);
    }
    case 'add_edge': {
      const edge = validateEdgeShape(op['edge'], 'apply_changes/add_edge');
      flow.addEdges(edge);
      return flow.getEdge(edge.id) ?? null;
    }
    case 'add_edges': {
      const edges = op['edges'];
      if (!Array.isArray(edges)) throw new InvalidParamsError('add_edges: "edges" must be an array.');
      if (edges.length > MAX_BULK_ELEMENTS) {
        throw new InvalidParamsError(
          `add_edges: "edges" exceeds the maximum of ${MAX_BULK_ELEMENTS} elements per call (got ${edges.length}).`,
        );
      }
      const validated = edges.map((e, i) =>
        validateEdgeShape(e, `apply_changes/add_edges[${i}]`),
      );
      flow.addEdges(validated);
      return validated.map((e) => flow.getEdge(e.id)).filter((e): e is Edge => !!e);
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

/** Hard cap on elements per bulk call (nodes, edges, apply_changes ops). */
const MAX_BULK_ELEMENTS = 5000;

function requireArray(params: Record<string, unknown>, key: string): unknown[] {
  const value = params[key];
  if (!Array.isArray(value)) throw new InvalidParamsError(`Param "${key}" must be an array.`);
  if (value.length > MAX_BULK_ELEMENTS) {
    throw new InvalidParamsError(
      `Param "${key}" exceeds the maximum of ${MAX_BULK_ELEMENTS} elements per call (got ${value.length}).`,
    );
  }
  return value;
}

function optionalStringArray(params: Record<string, unknown>, key: string): string[] | undefined {
  const value = params[key];
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new InvalidParamsError(`Param "${key}" must be an array of strings.`);
  }
  if (value.length > MAX_BULK_ELEMENTS) {
    throw new InvalidParamsError(
      `Param "${key}" exceeds the maximum of ${MAX_BULK_ELEMENTS} elements per call (got ${value.length}).`,
    );
  }
  return value as string[];
}

function optionalPositiveNumber(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new InvalidParamsError(`Param "${key}" must be a finite number greater than 0.`);
  }
  return value;
}

function requireRect(
  params: Record<string, unknown>,
  key: string,
): { x: number; y: number; width: number; height: number } {
  const v = requireObject(params, key);
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    if (typeof v[k] !== 'number' || !Number.isFinite(v[k])) {
      throw new InvalidParamsError(`Param "${key}.${k}" must be a finite number.`);
    }
  }
  return v as { x: number; y: number; width: number; height: number };
}

/** Build a parentId → child-ids map from a node list in one pass. */
function buildChildMap(nodes: readonly Node[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId != null) {
      const arr = map.get(n.parentId);
      if (arr) arr.push(n.id);
      else map.set(n.parentId, [n.id]);
    }
  }
  return map;
}

/**
 * Nesting-aware descendant ids of a node (excludes the node itself; cycle-guarded).
 * Takes a prebuilt child map so callers that resolve many groups (e.g. get_summary)
 * build it once rather than per group.
 */
function descendantIdsOf(groupId: string, childrenByParent: ReadonlyMap<string, string[]>): Set<string> {
  const out = new Set<string>();
  // BFS with an index pointer rather than queue.shift() (which is O(n) per
  // dequeue) — keeps this O(n) for deep hierarchies up to the bulk cap.
  const queue = [...(childrenByParent.get(groupId) ?? [])];
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]!;
    if (out.has(id)) continue; // self-parent / cycle guard
    out.add(id);
    const kids = childrenByParent.get(id);
    if (kids) queue.push(...kids);
  }
  return out;
}

/** Edges whose source AND target are both in the id set. */
function inducedEdges(edges: readonly Edge[], nodeIds: ReadonlySet<string>): Edge[] {
  return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
}

/** Best-effort display title for a node: data.label/title/name, else type, else id. */
function nodeTitle(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  for (const key of ['label', 'title', 'name'] as const) {
    const v = data?.[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  if (typeof node.type === 'string' && node.type.length > 0) return node.type;
  return node.id;
}

const BADGE_COLOR_SET = new Set(['slate', 'indigo', 'emerald', 'amber', 'rose']);
const HANDLE_POSITION_SET = new Set(['top', 'right', 'bottom', 'left']);

const KNOWN_SPEC_KEYS = new Set(['title', 'icon', 'accent', 'variant', 'badges', 'fields', 'body', 'handles']);

/** Validate a NodeTemplateSpec payload. Throws InvalidParamsError naming the offending field. */
function validateTemplateSpec(value: unknown, ctx: string): NodeTemplateSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidParamsError(`${ctx}: spec must be an object.`);
  }
  const s = value as Record<string, unknown>;
  for (const key of Object.keys(s)) {
    if (!KNOWN_SPEC_KEYS.has(key)) {
      throw new InvalidParamsError(`${ctx}: unknown spec key "${key}".`);
    }
  }
  for (const key of ['title', 'icon', 'accent', 'body']) {
    if (s[key] !== undefined && typeof s[key] !== 'string') {
      throw new InvalidParamsError(`${ctx}: spec.${key} must be a string.`);
    }
  }
  if (s['variant'] !== undefined && s['variant'] !== 'compact' && s['variant'] !== 'detailed') {
    throw new InvalidParamsError(`${ctx}: spec.variant must be "compact" or "detailed".`);
  }
  if (s['badges'] !== undefined) {
    if (!Array.isArray(s['badges'])) throw new InvalidParamsError(`${ctx}: spec.badges must be an array.`);
    (s['badges'] as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidParamsError(`${ctx}: spec.badges[${i}] must be an object.`);
      }
      const b = raw as Record<string, unknown>;
      if (typeof b['text'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.badges[${i}].text must be a string.`);
      }
      if (b['color'] !== undefined && !BADGE_COLOR_SET.has(b['color'] as string)) {
        throw new InvalidParamsError(
          `${ctx}: spec.badges[${i}].color must be one of: ${Array.from(BADGE_COLOR_SET).join(', ')}.`,
        );
      }
      if (b['showIf'] !== undefined && typeof b['showIf'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.badges[${i}].showIf must be a string.`);
      }
    });
  }
  if (s['fields'] !== undefined) {
    if (!Array.isArray(s['fields'])) throw new InvalidParamsError(`${ctx}: spec.fields must be an array.`);
    (s['fields'] as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}] must be an object.`);
      }
      const f = raw as Record<string, unknown>;
      if (typeof f['label'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}].label must be a string.`);
      }
      if (typeof f['value'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}].value must be a string.`);
      }
      if (f['showIf'] !== undefined && typeof f['showIf'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}].showIf must be a string.`);
      }
    });
  }
  if (s['handles'] !== undefined) {
    if (!Array.isArray(s['handles'])) throw new InvalidParamsError(`${ctx}: spec.handles must be an array.`);
    (s['handles'] as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidParamsError(`${ctx}: spec.handles[${i}] must be an object.`);
      }
      const h = raw as Record<string, unknown>;
      if (h['type'] !== 'source' && h['type'] !== 'target') {
        throw new InvalidParamsError(`${ctx}: spec.handles[${i}].type must be "source" or "target".`);
      }
      if (h['position'] !== undefined && !HANDLE_POSITION_SET.has(h['position'] as string)) {
        throw new InvalidParamsError(
          `${ctx}: spec.handles[${i}].position must be one of: top, right, bottom, left.`,
        );
      }
      if (h['id'] !== undefined && typeof h['id'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.handles[${i}].id must be a string.`);
      }
    });
  }
  return value as NodeTemplateSpec;
}

/**
 * CSS values that can fetch remote resources (`url(`) or execute in legacy
 * engines (`expression(`). Angular's style sanitization already blocks
 * script execution, so this is a narrow redressing/beaconing guard rather
 * than a full CSS allowlist.
 */
const CSS_VALUE_BLOCKLIST = /url\s*\(|expression\s*\(/i;

/** Shared style/className validation for agent-supplied nodes and edges. */
function validateStyleAndClassName(
  o: Record<string, unknown>,
  ctx: string,
  kind: 'node' | 'edge',
): void {
  const style = o['style'];
  if (style !== undefined) {
    if (!style || typeof style !== 'object' || Array.isArray(style)) {
      throw new InvalidParamsError(
        `${ctx}: ${kind}.style must be a plain object of CSS property/value pairs.`,
      );
    }
    for (const [prop, raw] of Object.entries(style as Record<string, unknown>)) {
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        throw new InvalidParamsError(`${ctx}: ${kind}.style["${prop}"] must be a string or number.`);
      }
      if (typeof raw === 'string' && CSS_VALUE_BLOCKLIST.test(raw)) {
        throw new InvalidParamsError(
          `${ctx}: ${kind}.style["${prop}"] must not contain "url(" or "expression(".`,
        );
      }
    }
  }
  if (o['className'] !== undefined && typeof o['className'] !== 'string') {
    throw new InvalidParamsError(`${ctx}: ${kind}.className must be a string.`);
  }
}

/** Validate that `value` is a structurally valid Node payload for add_*. */
function validateNodeShape(value: unknown, ctx: string): Node {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidParamsError(`${ctx}: node must be an object.`);
  }
  const n = value as Record<string, unknown>;
  if (typeof n['id'] !== 'string' || n['id'].length === 0) {
    throw new InvalidParamsError(`${ctx}: node.id must be a non-empty string.`);
  }
  const pos = n['position'];
  if (!pos || typeof pos !== 'object' || Array.isArray(pos)) {
    throw new InvalidParamsError(`${ctx}: node.position must be { x, y }.`);
  }
  const p = pos as Record<string, unknown>;
  if (typeof p['x'] !== 'number' || typeof p['y'] !== 'number') {
    throw new InvalidParamsError(`${ctx}: node.position.{x,y} must be numbers.`);
  }
  if (!Number.isFinite(p['x'] as number) || !Number.isFinite(p['y'] as number)) {
    throw new InvalidParamsError(`${ctx}: node.position.{x,y} must be finite (no NaN/Infinity).`);
  }
  validateStyleAndClassName(n, ctx, 'node');
  return value as Node;
}

/** Validate that `value` is a structurally valid Edge payload for add_*. */
function validateEdgeShape(value: unknown, ctx: string): Edge {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidParamsError(`${ctx}: edge must be an object.`);
  }
  const e = value as Record<string, unknown>;
  if (typeof e['id'] !== 'string' || e['id'].length === 0) {
    throw new InvalidParamsError(`${ctx}: edge.id must be a non-empty string.`);
  }
  if (typeof e['source'] !== 'string' || e['source'].length === 0) {
    throw new InvalidParamsError(`${ctx}: edge.source must be a non-empty string.`);
  }
  if (typeof e['target'] !== 'string' || e['target'].length === 0) {
    throw new InvalidParamsError(`${ctx}: edge.target must be a non-empty string.`);
  }
  validateStyleAndClassName(e, ctx, 'edge');
  return value as Edge;
}

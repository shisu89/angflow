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
import { AGENT_TOOL_SCHEMAS } from './tool-schemas';
import type {
  AgentInbound,
  AgentResponse,
  AgentTransport,
  AgentEvent,
} from './types';

/** Provider token holding the user-supplied transport(s). */
export const AGENT_TRANSPORTS = new InjectionToken<AgentTransport[]>('AngflowAgentTransports');

const ERROR_INVALID_PARAMS = -32602;
const ERROR_METHOD_NOT_FOUND = -32601;
const ERROR_FLOW_NOT_FOUND = -32000;
const ERROR_INTERNAL = -32603;

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
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly injector = inject(Injector);
  private started = false;

  /** Bumped every time a flow registers/unregisters. Useful for diagnostics. */
  readonly registeredFlows = signal<string[]>([]);

  constructor(
    @Optional() @Inject(AGENT_TRANSPORTS) transports: AgentTransport[] | null,
  ) {
    this.transports = transports ?? [];
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
      const result = await handler(flow, params);
      return { id: req.id, result: result ?? null };
    } catch (err) {
      if (err instanceof FlowNotFoundError) {
        return { id: req.id, error: { code: ERROR_FLOW_NOT_FOUND, message: err.message } };
      }
      if (err instanceof InvalidParamsError) {
        return { id: req.id, error: { code: ERROR_INVALID_PARAMS, message: err.message } };
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
  }
}

class FlowNotFoundError extends Error {}
class InvalidParamsError extends Error {}

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

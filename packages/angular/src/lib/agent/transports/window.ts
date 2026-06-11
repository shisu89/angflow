import type {
  AgentInbound,
  AgentOutbound,
  AgentResponse,
  AgentTransport,
} from '../types';
import { AGENT_TOOL_SCHEMAS } from '../tool-schemas';

export interface WindowTransportOptions {
  /**
   * Property name to expose on `window`. Defaults to `'angflow'`. The shape
   * is `window[namespace] = { callTool, subscribe, toolSchemas }`.
   */
  namespace?: string;
}

interface AngflowWindowApi {
  /** Invoke a tool. Returns the raw JSON-RPC result, or throws on error. */
  callTool(method: string, params?: Record<string, unknown>): Promise<unknown>;
  /** Subscribe to push events. Returns an unsubscribe function. */
  subscribe(handler: (evt: AgentOutbound) => void): () => void;
  /** Schemas for every tool. Useful when wiring to an LLM tool-use API. */
  toolSchemas: typeof AGENT_TOOL_SCHEMAS;
}

/**
 * Transport that exposes a global `window.angflow` API. Useful for:
 *   - devtools console snippets (`await window.angflow.callTool('add_node', {...})`)
 *   - same-page agent harnesses (Playwright `page.evaluate`, browser extensions)
 *   - bridging to a custom transport you control (e.g. CDP, postMessage)
 *
 * It does NOT open a network port. For cross-process agents use
 * `WebSocketTransport`.
 */
export class WindowTransport implements AgentTransport {
  private readonly namespace: string;
  private subscribers = new Set<(evt: AgentOutbound) => void>();
  private requestHandler: ((req: AgentInbound) => Promise<AgentResponse>) | null = null;
  private nextId = 1;

  constructor(options: WindowTransportOptions = {}) {
    this.namespace = options.namespace ?? 'angflow';
  }

  start(handler: (req: AgentInbound) => Promise<AgentResponse>): void {
    this.requestHandler = handler;
    if (typeof window === 'undefined') return;

    const winRec = window as unknown as Record<string, unknown>;
    if (winRec[this.namespace] !== undefined) {
      // Surface the collision so a second WindowTransport (or a host that
      // already owns the namespace) doesn't silently lose its API.
      console.warn(
        `[angflow] WindowTransport: window.${this.namespace} is already set and will be overwritten. ` +
          `Pass { namespace: '…' } to disambiguate.`,
      );
    }

    const api: AngflowWindowApi = {
      callTool: (method, params = {}) => this.handleCallTool(method, params),
      subscribe: (h) => {
        this.subscribers.add(h);
        return () => this.subscribers.delete(h);
      },
      toolSchemas: AGENT_TOOL_SCHEMAS,
    };

    winRec[this.namespace] = api;
  }

  send(frame: AgentOutbound): void {
    // Only events get pushed to subscribers; responses are returned from callTool.
    if ('event' in frame) {
      for (const sub of this.subscribers) {
        try {
          sub(frame);
        } catch {
          // Subscriber errors must not poison other subscribers.
        }
      }
    }
  }

  stop(): void {
    this.requestHandler = null;
    this.subscribers.clear();
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>)[this.namespace];
    }
  }

  private async handleCallTool(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.requestHandler) throw new Error('Agent bridge not started');
    const res = await this.requestHandler({ id: this.nextId++, method, params });
    if ('error' in res) {
      const err = new Error(res.error.message) as Error & { code?: number; data?: unknown };
      err.code = res.error.code;
      err.data = res.error.data;
      throw err;
    }
    return res.result;
  }
}

/**
 * Wire formats and transport contract for the agent bridge.
 *
 * The bridge speaks a small JSON-RPC-style protocol so a remote agent (an
 * MCP server, a Playwright script, a browser extension, a console snippet)
 * can call into `NgFlowService` and observe state changes uniformly.
 */

/** A request from the agent to the bridge. `id` correlates the response. */
export interface AgentRequest {
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
  /** Host-defined origin of this call (e.g. "agent:claude", "user"). Threaded to canMutate / op-log / flow.history. */
  source?: string;
}

/** A successful response to an `AgentRequest`. */
export interface AgentSuccessResponse {
  id: number | string;
  result: unknown;
}

/** An error response to an `AgentRequest`. */
export interface AgentErrorResponse {
  id: number | string;
  error: { code: number; message: string; data?: unknown };
}

export type AgentResponse = AgentSuccessResponse | AgentErrorResponse;

/** A push-style event from the bridge to the agent (no id, no response expected). */
export interface AgentEvent {
  event: string;
  params?: Record<string, unknown>;
}

/**
 * Host write-guard for mutating tool calls. Return `true` to allow; `false` or a
 * non-empty string (the denial reason) to reject with `-32001`. Async-capable.
 */
export type AgentCanMutateFn = (
  op: { method: string; params: Record<string, unknown> },
  source?: string,
) => boolean | string | Promise<boolean | string>;

/** Frame sent from agent to bridge. */
export type AgentInbound = AgentRequest;

/** Frame sent from bridge to agent. */
export type AgentOutbound = AgentResponse | AgentEvent;

/**
 * Transport contract: anything that can shuttle JSON frames between an
 * external agent process and the in-browser bridge. The bridge calls
 * `start(handler)` once; the transport invokes `handler` for every inbound
 * frame and calls `send` for every outbound frame.
 */
export interface AgentTransport {
  /** Begin accepting incoming requests. Resolves once the transport is ready. */
  start(handler: (req: AgentInbound) => Promise<AgentResponse>): void | Promise<void>;
  /** Push an outbound frame (response or event) to the agent peer. */
  send(frame: AgentOutbound): void;
  /** Tear down resources; called when the bridge is destroyed. */
  stop(): void;
}

/**
 * Describes a single agent tool — name, human description, and a JSON Schema
 * for params. Suitable for direct use as a Claude / OpenAI tool definition.
 */
export interface AgentToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

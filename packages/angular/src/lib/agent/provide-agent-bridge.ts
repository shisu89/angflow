import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AGENT_CAN_MUTATE, AGENT_HISTORY_OPTIONS, AGENT_LAYOUT, AGENT_ON_ERROR, AGENT_ON_OP, AGENT_OPLOG_OPTIONS, AGENT_TRANSPORTS } from './agent-bridge.service';
import type { AgentHistoryOptions } from './history';
import type { AgentTransport, AgentCanMutateFn } from './types';
import type { AgentLayoutFn } from '../types/node-template';

export type AgentBridgeErrorContext =
  | { kind: 'transport-start'; transport: AgentTransport }
  | { kind: 'transport-send'; transport: AgentTransport }
  | { kind: 'dispatch'; method: string };

export interface AgentBridgeConfig {
  /** Transports the bridge should attach to. Order doesn't matter. */
  transports: AgentTransport[];
  /** History config. Pass `false` to disable undo/redo entirely. Default: { maxDepth: 100 }. */
  history?: AgentHistoryOptions | false;
  /**
   * Optional callback for surfacing transport / dispatch errors that the
   * bridge would otherwise swallow (a transport whose `start()` rejects, a
   * `send()` that throws, etc.). The bridge keeps running regardless; use
   * this to log or report.
   */
  onError?: (err: unknown, ctx: AgentBridgeErrorContext) => void;
  /**
   * Optional layout function backing the `layout_nodes` tool. Import the
   * turnkey dagre adapter from `@angflow/angular/layout`, or supply your own.
   * When omitted, `layout_nodes` fails with a "no layout function configured"
   * error.
   */
  layout?: AgentLayoutFn;
  /**
   * Optional host write-guard. Called before any mutating tool executes with
   * `({ method, params }, source)`. Return `true` to allow; `false` or a
   * non-empty string (the denial reason) to reject with `-32001`. Async-capable;
   * a throw is treated as a deny.
   */
  canMutate?: AgentCanMutateFn;
  /** Sink called after each applied mutating tool call with its op-log entry. */
  onOp?: (entry: import('./op-log').OpLogEntry) => void;
  /** Op-log config. Pass `false` to disable the op-log and `get_changes_since`. Default { maxOps: 1000 }. */
  opLog?: import('./op-log').OpLogOptions | false;
}

/**
 * Register the agent bridge for an Angular app. Add to your `appConfig`
 * providers alongside `provideRouter` etc., then attach `<ng-flow>`
 * instances by calling `bridge.register(id, $event)` from `(init)`.
 *
 * @example
 * ```ts
 * // app.config.ts
 * import { provideAgentBridge, WindowTransport } from '@angflow/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideAgentBridge({
 *       transports: [new WindowTransport()],
 *     }),
 *   ],
 * };
 * ```
 */
export function provideAgentBridge(config: AgentBridgeConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AGENT_TRANSPORTS, useValue: config.transports },
    {
      provide: AGENT_HISTORY_OPTIONS,
      useValue: config.history ?? { maxDepth: 100 },
    },
    ...(config.onError ? [{ provide: AGENT_ON_ERROR, useValue: config.onError }] : []),
    ...(config.layout ? [{ provide: AGENT_LAYOUT, useValue: config.layout }] : []),
    ...(config.canMutate ? [{ provide: AGENT_CAN_MUTATE, useValue: config.canMutate }] : []),
    ...(config.onOp ? [{ provide: AGENT_ON_OP, useValue: config.onOp }] : []),
    { provide: AGENT_OPLOG_OPTIONS, useValue: config.opLog ?? { maxOps: 1000 } },
  ]);
}

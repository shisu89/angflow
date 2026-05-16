import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AGENT_HISTORY_OPTIONS, AGENT_ON_ERROR, AGENT_TRANSPORTS } from './agent-bridge.service';
import type { AgentHistoryOptions } from './history';
import type { AgentTransport } from './types';

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
  ]);
}

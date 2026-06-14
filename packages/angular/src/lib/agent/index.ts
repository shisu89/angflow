export { AngflowAgentBridge } from './agent-bridge.service';
export { provideAgentBridge, type AgentBridgeConfig, type AgentBridgeErrorContext } from './provide-agent-bridge';
export type { AgentHistoryOptions } from './history';
export type { OpLogEntry, OpLogOptions, ChangesSince } from './op-log';
export { AGENT_TOOL_SCHEMAS } from './tool-schemas';
export { WindowTransport, type WindowTransportOptions } from './transports/window';
export { WebSocketTransport, type WebSocketTransportOptions } from './transports/websocket';
export type {
  AgentRequest,
  AgentResponse,
  AgentSuccessResponse,
  AgentErrorResponse,
  AgentEvent,
  AgentInbound,
  AgentOutbound,
  AgentTransport,
  AgentToolSchema,
  AgentCanMutateFn,
} from './types';
export * from './chat';

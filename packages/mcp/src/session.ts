/**
 * Event-fed mirror of the connected canvas: which flows exist and their
 * last-known state. Consumed by canvas_status and logging — agents read live
 * state via the passthrough tools, not from this mirror.
 */
export class SessionMirror {
  /** Informational only — canvas_status reads CanvasSocket.isConnected() as the authority; this flag exists for logging/diagnostics and future use. */
  connected = false;
  private readonly flows = new Map<string, unknown>();

  handleConnect(): void {
    this.connected = true;
  }

  handleDisconnect(): void {
    this.connected = false;
    this.flows.clear();
  }

  handleEvent(event: string, params?: Record<string, unknown>): void {
    const flowId = params?.['flowId'];
    if (typeof flowId !== 'string' || flowId.length === 0) return;
    switch (event) {
      case 'flow.registered':
        if (!this.flows.has(flowId)) this.flows.set(flowId, undefined);
        break;
      case 'flow.unregistered':
        this.flows.delete(flowId);
        break;
      case 'flow.state':
        this.flows.set(flowId, params);
        break;
      default:
        // flow.history and future events: nothing to mirror yet.
        break;
    }
  }

  flowIds(): string[] {
    return Array.from(this.flows.keys());
  }

  lastState(flowId: string): unknown {
    return this.flows.get(flowId);
  }
}

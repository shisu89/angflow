/**
 * Event-fed mirror of the connected canvas: which flows exist. Consumed by
 * canvas_status and the flow resources. It deliberately does NOT retain
 * flow.state payloads (whole graphs, pushed on every edit) — agents read live
 * state via the passthrough tools / resources instead.
 */
export class SessionMirror {
  /** Informational only — canvas_status reads CanvasSocket.isConnected() as the authority; this flag exists for logging/diagnostics and future use. */
  connected = false;
  private readonly flows = new Set<string>();

  /** Called whenever the set of flow ids changes. */
  constructor(private readonly onFlowsChanged: () => void = () => {}) {}

  handleConnect(): void {
    this.connected = true;
  }

  handleDisconnect(): void {
    this.connected = false;
    const had = this.flows.size > 0;
    this.flows.clear();
    if (had) this.onFlowsChanged();
  }

  handleEvent(event: string, params?: Record<string, unknown>): void {
    const flowId = params?.['flowId'];
    if (typeof flowId !== 'string' || flowId.length === 0) return;
    switch (event) {
      case 'flow.registered':
      case 'flow.state': // a state push implies the flow exists
        if (!this.flows.has(flowId)) {
          this.flows.add(flowId);
          this.onFlowsChanged();
        }
        break;
      case 'flow.unregistered':
        if (this.flows.delete(flowId)) this.onFlowsChanged();
        break;
      default:
        // flow.history and future events: nothing to mirror yet.
        break;
    }
  }

  flowIds(): string[] {
    return Array.from(this.flows.keys());
  }
}

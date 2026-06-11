import type {
  AgentInbound,
  AgentOutbound,
  AgentResponse,
  AgentTransport,
} from '../types';

export interface WebSocketTransportOptions {
  /** WS URL to dial. */
  url: string;
  /**
   * Auth token for an `@angflow/mcp` server. Sent as the
   * `angflow.token.<token>` WebSocket subprotocol alongside `angflow.bridge`
   * — preferred over `?token=` in the URL, which leaks into server logs.
   * Not needed for local dev: the MCP server allowlists localhost origins.
   */
  token?: string;
  /** Reconnect with exponential backoff on close. Defaults to `true`. */
  reconnect?: boolean;
  /** Initial reconnect delay in ms. Defaults to `1000`. */
  initialReconnectDelayMs?: number;
  /** Max reconnect delay in ms. Defaults to `30000`. */
  maxReconnectDelayMs?: number;
  /** Optional logger; defaults to no-op. */
  onError?: (err: unknown) => void;
}

/**
 * Browser→server WebSocket transport. The page dials `url`; whatever lives
 * on the other end is expected to send `AgentInbound` frames and read
 * `AgentOutbound` frames.
 *
 * Reconnects with exponential backoff on close unless `reconnect: false`.
 */
export class WebSocketTransport implements AgentTransport {
  private socket: WebSocket | null = null;
  private handler: ((req: AgentInbound) => Promise<AgentResponse>) | null = null;
  private stopped = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly token: string | undefined;
  private readonly reconnect: boolean;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly onError: (err: unknown) => void;

  constructor(options: WebSocketTransportOptions) {
    this.url = options.url;
    this.token = options.token;
    this.reconnect = options.reconnect ?? true;
    this.initialDelay = options.initialReconnectDelayMs ?? 1000;
    this.maxDelay = options.maxReconnectDelayMs ?? 30000;
    this.onError = options.onError ?? (() => {});
  }

  start(handler: (req: AgentInbound) => Promise<AgentResponse>): void {
    this.handler = handler;
    this.connect();
  }

  send(frame: AgentOutbound): void {
    const sock = this.socket;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    try {
      sock.send(JSON.stringify(frame));
    } catch (err) {
      this.onError(err);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.handler = null;
  }

  private connect(): void {
    if (this.stopped || typeof WebSocket === 'undefined') return;

    let sock: WebSocket;
    try {
      sock = this.token
        ? new WebSocket(this.url, ['angflow.bridge', `angflow.token.${this.token}`])
        : new WebSocket(this.url);
    } catch (err) {
      this.onError(err);
      this.scheduleReconnect();
      return;
    }
    this.socket = sock;

    sock.addEventListener('open', () => {
      this.reconnectAttempts = 0;
    });

    sock.addEventListener('message', async (msg) => {
      if (!this.handler) return;
      let req: AgentInbound;
      try {
        req = JSON.parse(typeof msg.data === 'string' ? msg.data : await (msg.data as Blob).text()) as AgentInbound;
      } catch (err) {
        this.onError(err);
        return;
      }
      const res = await this.handler(req);
      this.send(res);
    });

    sock.addEventListener('error', (ev) => this.onError(ev));

    sock.addEventListener('close', () => {
      this.socket = null;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || !this.reconnect) return;
    const delay = Math.min(this.initialDelay * 2 ** this.reconnectAttempts, this.maxDelay);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

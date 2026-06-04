/**
 * WebSocket server side of the agent-bridge wire protocol.
 *
 * The browser canvas (WebSocketTransport in @angflow/angular) DIALS this
 * server. Policy: single active canvas — a new connection replaces the old
 * one (close 4000). Optional shared-token auth (bad token → close 4401).
 * Knows nothing about MCP; exposes call()/status and event callbacks.
 */
import { IncomingMessage } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import type { Logger } from './log.js';

/** A JSON-RPC-style error returned by the bridge for a tool call. */
export class BridgeToolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
  }
}

/** No canvas is currently connected. */
export class NoCanvasError extends Error {
  constructor(public readonly url: string) {
    super(`No canvas connected at ${url}`);
  }
}

/** The canvas did not answer within the configured timeout. */
export class CanvasTimeoutError extends Error {
  constructor(method: string, timeoutMs: number) {
    super(`Canvas did not answer "${method}" within ${timeoutMs}ms`);
  }
}

/** The canvas disconnected while a call was in flight. */
export class CanvasDisconnectedError extends Error {
  constructor(method: string) {
    super(`Canvas disconnected while "${method}" was in flight; its effect is unknown`);
  }
}

export interface CanvasSocketOptions {
  /** Port to listen on; 0 picks an ephemeral port (tests). */
  port: number;
  host: string;
  /** When set, connections must present ?token=<value> or are closed (4401). */
  token?: string;
  /** Per-request timeout in ms. */
  timeoutMs: number;
  log: Logger;
  /** Push events (flow.state, flow.registered, …) from the canvas. */
  onEvent?: (event: string, params: Record<string, unknown> | undefined) => void;
  /** Fired when the active canvas connection ends (incl. replacement). */
  onDisconnect?: () => void;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  method: string;
};

export class CanvasSocket {
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private actualPort = 0;

  constructor(private readonly options: CanvasSocketOptions) {}

  /** The bound port (resolves option `port: 0` to the real ephemeral port). */
  get port(): number {
    return this.actualPort;
  }

  get host(): string {
    return this.options.host;
  }

  get url(): string {
    return `ws://${this.options.host}:${this.actualPort}`;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ host: this.options.host, port: this.options.port });
      this.wss = wss;
      wss.on('listening', () => {
        const addr = wss.address();
        this.actualPort = typeof addr === 'object' && addr ? addr.port : this.options.port;
        this.options.log.info(`listening for canvas connections on ${this.url}`);
        resolve();
      });
      wss.on('error', (err) => reject(err));
      wss.on('connection', (socket, req) => this.onConnection(socket, req));
    });
  }

  async stop(): Promise<void> {
    this.rejectAllPending('stop');
    // Order matters: WebSocketServer.close() does not terminate connected
    // clients, so close the live socket first or stop() would hang.
    this.socket?.close();
    this.socket = null;
    await new Promise<void>((resolve) => {
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
    });
    this.wss = null;
  }

  call(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected()) {
      return Promise.reject(new NoCanvasError(this.url));
    }
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CanvasTimeoutError(method, this.options.timeoutMs));
      }, this.options.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      // The catch guards synchronous throws only (already-CLOSED socket,
      // serialization failure). An OPEN→CLOSING race does not throw here —
      // ws queues the frame and the close handler rejects the pending call.
      try {
        this.socket!.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private onConnection(socket: WebSocket, req: IncomingMessage): void {
    if (this.options.token) {
      const url = new URL(req.url ?? '/', 'ws://placeholder');
      if (url.searchParams.get('token') !== this.options.token) {
        this.options.log.warn('rejected canvas connection: bad or missing token');
        socket.close(4401, 'invalid token');
        return;
      }
    }

    if (this.socket) {
      this.options.log.warn(
        'a new canvas connected — replacing the previous connection (did you open a second tab?)',
      );
      const old = this.socket;
      this.socket = null;
      this.rejectAllPending('replaced');
      old.close(4000, 'replaced by newer canvas');
      this.options.onDisconnect?.();
    }

    this.socket = socket;
    this.options.log.info('canvas connected');

    socket.on('message', (data) => this.onMessage(String(data)));
    socket.on('close', () => {
      if (this.socket !== socket) return; // already replaced
      this.socket = null;
      this.options.log.info('canvas disconnected');
      this.rejectAllPending('disconnect');
      this.options.onDisconnect?.();
    });
    socket.on('error', (err) => this.options.log.warn('canvas socket error:', err));
  }

  private onMessage(text: string): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.options.log.debug('dropping malformed frame:', text.slice(0, 200));
      return;
    }

    if (typeof frame['event'] === 'string') {
      this.options.onEvent?.(frame['event'], frame['params'] as Record<string, unknown> | undefined);
      return;
    }

    const id = frame['id'];
    if (typeof id !== 'number' || !this.pending.has(id)) {
      this.options.log.debug('dropping response with unknown id:', id);
      return;
    }
    const entry = this.pending.get(id)!;
    this.pending.delete(id);
    clearTimeout(entry.timer);

    if (frame['error'] !== undefined && frame['error'] !== null) {
      const err = frame['error'] as { code?: number; message?: string; data?: unknown };
      entry.reject(new BridgeToolError(err.code ?? -32603, err.message ?? 'Unknown bridge error', err.data));
      return;
    }
    entry.resolve(frame['result']);
  }

  private rejectAllPending(reason: 'disconnect' | 'replaced' | 'stop'): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new CanvasDisconnectedError(entry.method));
    }
    this.pending.clear();
    void reason;
  }
}

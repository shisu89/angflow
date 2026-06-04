/**
 * Test double for a browser canvas running AngflowAgentBridge with a
 * WebSocketTransport. Dials the CanvasSocket under test and answers
 * AgentRequest frames from a scripted handler table.
 */
import WebSocket from 'ws';

type Handler = (params: Record<string, unknown> | undefined) => unknown | Promise<unknown>;

export interface FakeCanvasOptions {
  /** Per-method scripted responses. Throwing → {id, error} with code -32603. */
  handlers?: Record<string, Handler>;
  /** 'silent' never answers requests; 'wrong-id' answers with id + 1000. */
  mode?: 'normal' | 'silent' | 'wrong-id';
}

export class FakeCanvas {
  readonly received: Array<{ id: number | string; method: string; params?: Record<string, unknown> }> = [];
  private socket: WebSocket | null = null;
  private readonly handlers: Record<string, Handler>;
  private readonly mode: 'normal' | 'silent' | 'wrong-id';

  constructor(options: FakeCanvasOptions = {}) {
    this.handlers = options.handlers ?? {};
    this.mode = options.mode ?? 'normal';
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = new WebSocket(url);
      this.socket = sock;
      sock.on('open', () => resolve());
      sock.on('error', (err) => reject(err));
      sock.on('message', (data) => void this.onMessage(String(data)));
    });
  }

  /** Resolves with the close code when the server (or close()) ends the connection. */
  waitForClose(): Promise<number> {
    return new Promise((resolve) => {
      this.socket?.on('close', (code) => resolve(code));
    });
  }

  emit(event: string, params?: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify({ event, params }));
  }

  sendRaw(text: string): void {
    this.socket?.send(text);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private async onMessage(text: string): Promise<void> {
    const req = JSON.parse(text) as { id: number | string; method: string; params?: Record<string, unknown> };
    this.received.push(req);
    if (this.mode === 'silent') return;
    const replyId = this.mode === 'wrong-id' ? (req.id as number) + 1000 : req.id;
    const handler = this.handlers[req.method];
    if (!handler) {
      this.socket?.send(
        JSON.stringify({ id: replyId, error: { code: -32601, message: `Unknown method: ${req.method}` } }),
      );
      return;
    }
    try {
      const result = await handler(req.params);
      this.socket?.send(JSON.stringify({ id: replyId, result: result ?? null }));
    } catch (err) {
      this.socket?.send(
        JSON.stringify({
          id: replyId,
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        }),
      );
    }
  }
}

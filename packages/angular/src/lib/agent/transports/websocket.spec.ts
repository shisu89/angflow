import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { WebSocketTransport } from './websocket';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }
  addEventListener(): void {}
  close(): void {}
  send(): void {}
}

/**
 * Richer fake that captures event listeners so tests can fire them.
 * Used for close-code terminal / reconnect behaviour tests.
 */
class CapturingFakeWebSocket {
  static instances: CapturingFakeWebSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  private listeners = new Map<string, Array<(ev: unknown) => void>>();

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    CapturingFakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (ev: unknown) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(handler);
    this.listeners.set(type, bucket);
  }

  fireClose(code: number): void {
    for (const h of this.listeners.get('close') ?? []) h({ code } as CloseEvent);
  }

  close(): void {}
  send(): void {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWebSocket.instances = [];
  CapturingFakeWebSocket.instances = [];
});

describe('WebSocketTransport terminal close codes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', CapturingFakeWebSocket);
  });

  it('does NOT schedule a reconnect when close code is 4403 (origin rejected)', () => {
    const transport = new WebSocketTransport({
      url: 'ws://localhost:8765',
      reconnect: true,
    });
    transport.start(async () => ({ id: 1, result: null }));
    expect(CapturingFakeWebSocket.instances).toHaveLength(1);

    CapturingFakeWebSocket.instances[0].fireClose(4403);

    // Advance far past any reconnect delay — no new WebSocket should be created.
    vi.advanceTimersByTime(60_000);
    expect(CapturingFakeWebSocket.instances).toHaveLength(1);

    transport.stop();
  });

  it('does NOT schedule a reconnect when close code is 4401 (bad token)', () => {
    const transport = new WebSocketTransport({
      url: 'ws://localhost:8765',
      token: 'wrong',
      reconnect: true,
    });
    transport.start(async () => ({ id: 1, result: null }));
    expect(CapturingFakeWebSocket.instances).toHaveLength(1);

    CapturingFakeWebSocket.instances[0].fireClose(4401);

    vi.advanceTimersByTime(60_000);
    expect(CapturingFakeWebSocket.instances).toHaveLength(1);

    transport.stop();
  });

  it('DOES schedule a reconnect for non-terminal close codes (e.g. 1006 network drop)', () => {
    const transport = new WebSocketTransport({
      url: 'ws://localhost:8765',
      reconnect: true,
      initialReconnectDelayMs: 500,
    });
    transport.start(async () => ({ id: 1, result: null }));
    expect(CapturingFakeWebSocket.instances).toHaveLength(1);

    CapturingFakeWebSocket.instances[0].fireClose(1006);

    // After the initial delay a new WebSocket is constructed.
    vi.advanceTimersByTime(1000);
    expect(CapturingFakeWebSocket.instances.length).toBeGreaterThanOrEqual(2);

    transport.stop();
  });
});

describe('WebSocketTransport token handshake', () => {
  it('dials with angflow.bridge + angflow.token.<secret> subprotocols when token is set', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const transport = new WebSocketTransport({
      url: 'ws://localhost:8765',
      token: 'sekret',
      reconnect: false,
    });
    transport.start(async () => ({ id: 1, result: null }));
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost:8765');
    expect(FakeWebSocket.instances[0].protocols).toEqual([
      'angflow.bridge',
      'angflow.token.sekret',
    ]);
    transport.stop();
  });

  it('dials with no subprotocols when token is omitted (backward compatible)', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const transport = new WebSocketTransport({ url: 'ws://localhost:8765', reconnect: false });
    transport.start(async () => ({ id: 1, result: null }));
    expect(FakeWebSocket.instances[0].protocols).toBeUndefined();
    transport.stop();
  });
});

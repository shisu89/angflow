import { describe, it, expect, vi, afterEach } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
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

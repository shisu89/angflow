import { describe, it, expect, afterEach } from 'vitest';
import {
  CanvasSocket,
  BridgeToolError,
  NoCanvasError,
  CanvasTimeoutError,
  CanvasDisconnectedError,
} from '../src/canvas-socket';
import { createLogger } from '../src/log';
import { FakeCanvas } from './fake-canvas';

const log = createLogger('silent');

let sockets: CanvasSocket[] = [];
let canvases: FakeCanvas[] = [];

async function makeSocket(opts: Partial<ConstructorParameters<typeof CanvasSocket>[0]> = {}): Promise<CanvasSocket> {
  const cs = new CanvasSocket({ port: 0, host: '127.0.0.1', timeoutMs: 1000, log, ...opts });
  await cs.start();
  sockets.push(cs);
  return cs;
}

function makeCanvas(...args: ConstructorParameters<typeof FakeCanvas>): FakeCanvas {
  const c = new FakeCanvas(...args);
  canvases.push(c);
  return c;
}

afterEach(async () => {
  for (const c of canvases) c.close();
  canvases = [];
  for (const s of sockets) await s.stop();
  sockets = [];
});

describe('CanvasSocket lifecycle', () => {
  it('starts on an ephemeral port and reports it', async () => {
    const cs = await makeSocket();
    expect(cs.port).toBeGreaterThan(0);
    expect(cs.isConnected()).toBe(false);
  });

  it('accepts a canvas connection', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas();
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect.poll(() => cs.isConnected()).toBe(true);
  });

  it('replaces an existing connection with close code 4000', async () => {
    const cs = await makeSocket();
    const first = makeCanvas();
    await first.connect(`ws://127.0.0.1:${cs.port}`);
    const closed = first.waitForClose();
    const second = makeCanvas({ handlers: { ping: () => 'pong-2' } });
    await second.connect(`ws://127.0.0.1:${cs.port}`);
    expect(await closed).toBe(4000);
    expect(await cs.call('ping', {})).toBe('pong-2');
  });

  it('rejects connections with a bad token (close 4401) when token is configured', async () => {
    const cs = await makeSocket({ token: 'sekret' });
    const bad = makeCanvas();
    await bad.connect(`ws://127.0.0.1:${cs.port}`);
    expect(await bad.waitForClose()).toBe(4401);
    expect(cs.isConnected()).toBe(false);

    const good = makeCanvas({ handlers: { ping: () => 'pong' } });
    await good.connect(`ws://127.0.0.1:${cs.port}?token=sekret`);
    expect(await cs.call('ping', {})).toBe('pong');
  });

  it('rejects the first canvas in-flight calls when replaced', async () => {
    const cs = await makeSocket();
    const first = makeCanvas({ mode: 'silent' });
    await first.connect(`ws://127.0.0.1:${cs.port}`);
    const pending = cs.call('get_state', {});
    const expectation = expect(pending).rejects.toBeInstanceOf(CanvasDisconnectedError);
    const second = makeCanvas({ handlers: { ping: () => 'pong-2' } });
    await second.connect(`ws://127.0.0.1:${cs.port}`);
    await expectation;
    expect(await cs.call('ping', {})).toBe('pong-2');
  });
});

describe('CanvasSocket calls', () => {
  it('rejects with NoCanvasError when nothing is connected', async () => {
    const cs = await makeSocket();
    await expect(cs.call('get_state', {})).rejects.toBeInstanceOf(NoCanvasError);
  });

  it('round-trips a call and resolves with the result', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas({
      handlers: { add_node: (params) => ({ added: params?.['node'] }) },
    });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const result = await cs.call('add_node', { node: { id: 'n1' } });
    expect(result).toEqual({ added: { id: 'n1' } });
    expect(canvas.received[0]).toMatchObject({ method: 'add_node', params: { node: { id: 'n1' } } });
  });

  it('maps bridge {id, error} frames to BridgeToolError with code/data', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas(); // no handlers → FakeCanvas answers -32601
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const err = await cs.call('nope', {}).catch((e) => e);
    expect(err).toBeInstanceOf(BridgeToolError);
    expect((err as BridgeToolError).code).toBe(-32601);
    expect((err as BridgeToolError).message).toContain('Unknown method');
  });

  it('correlates out-of-order responses by id', async () => {
    const cs = await makeSocket();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const canvas = makeCanvas({
      handlers: {
        slow: async () => {
          await gate;
          return 'slow-result';
        },
        fast: () => 'fast-result',
      },
    });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const slow = cs.call('slow', {});
    const fast = cs.call('fast', {});
    expect(await fast).toBe('fast-result');
    release();
    expect(await slow).toBe('slow-result');
  });

  it('times out a never-answered call with CanvasTimeoutError', async () => {
    const cs = await makeSocket({ timeoutMs: 100 });
    const canvas = makeCanvas({ mode: 'silent' });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect(cs.call('get_state', {})).rejects.toBeInstanceOf(CanvasTimeoutError);
  });

  it('rejects in-flight calls with CanvasDisconnectedError when the canvas drops', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas({ mode: 'silent' });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const pending = cs.call('get_state', {});
    canvas.close();
    await expect(pending).rejects.toBeInstanceOf(CanvasDisconnectedError);
  });

  it('drops responses with unknown ids without affecting real calls', async () => {
    const cs = await makeSocket({ timeoutMs: 100 });
    const canvas = makeCanvas({ mode: 'wrong-id' });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect(cs.call('get_state', {})).rejects.toBeInstanceOf(CanvasTimeoutError);
  });

  it('tolerates malformed JSON frames', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas({ handlers: { ping: () => 'pong' } });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    canvas.sendRaw('{not json');
    expect(await cs.call('ping', {})).toBe('pong');
  });
});

describe('CanvasSocket events', () => {
  it('routes AgentEvent frames to onEvent', async () => {
    const events: Array<{ event: string; params?: Record<string, unknown> }> = [];
    const cs = await makeSocket({ onEvent: (event, params) => events.push({ event, params }) });
    const canvas = makeCanvas();
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    canvas.emit('flow.registered', { flowId: 'demo' });
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toEqual({ event: 'flow.registered', params: { flowId: 'demo' } });
  });

  it('signals disconnect via onDisconnect', async () => {
    let disconnects = 0;
    const cs = await makeSocket({ onDisconnect: () => disconnects++ });
    const canvas = makeCanvas();
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect.poll(() => cs.isConnected()).toBe(true);
    canvas.close();
    await expect.poll(() => disconnects).toBe(1);
  });
});

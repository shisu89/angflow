import { describe, it, expect } from 'vitest';
import { SessionMirror } from '../src/session';

describe('SessionMirror', () => {
  it('starts disconnected with no flows', () => {
    const s = new SessionMirror();
    expect(s.connected).toBe(false);
    expect(s.flowIds()).toEqual([]);
  });

  it('tracks flow registration and unregistration', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.registered', { flowId: 'a' });
    s.handleEvent('flow.registered', { flowId: 'b' });
    expect(s.flowIds()).toEqual(['a', 'b']);
    s.handleEvent('flow.unregistered', { flowId: 'a' });
    expect(s.flowIds()).toEqual(['b']);
  });

  it('records last-known state per flow', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.state', { flowId: 'a', nodes: [{ id: 'n1' }], edges: [] });
    expect(s.lastState('a')).toMatchObject({ nodes: [{ id: 'n1' }] });
    expect(s.lastState('missing')).toBeUndefined();
  });

  it('flow.state implies the flow exists even without flow.registered', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.state', { flowId: 'implied', nodes: [], edges: [] });
    expect(s.flowIds()).toEqual(['implied']);
  });

  it('clears everything on disconnect (a different canvas may connect next)', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.registered', { flowId: 'a' });
    s.handleDisconnect();
    expect(s.connected).toBe(false);
    expect(s.flowIds()).toEqual([]);
  });

  it('ignores events without a string flowId', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.registered', {});
    s.handleEvent('flow.registered', undefined);
    expect(s.flowIds()).toEqual([]);
  });
});

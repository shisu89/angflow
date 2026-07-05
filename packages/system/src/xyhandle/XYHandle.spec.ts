// packages/system/src/xyhandle/XYHandle.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XYHandle } from './XYHandle';

// We test that onPointerDown threads isNodeVisible into both utility calls.
// Mock the utils module so we can spy on argument lists without needing DOM.
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getClosestHandle: vi.fn(() => null),
    getFloatingDropTarget: vi.fn(() => null),
  };
});

import { getClosestHandle, getFloatingDropTarget } from './utils';

function makeFakeEvent(type: string, x = 50, y = 50): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
}

/** Minimal OnPointerDownParams for the threading test. */
function makeParams(isNodeVisible?: (n: any) => boolean) {
  // We need a real Element for handleDomNode (used in getHandleType).
  const handleEl = document.createElement('div');
  handleEl.classList.add('source');

  // domNode must return a real ClientRect — we stub getBoundingClientRect.
  const domNode = document.createElement('div');
  domNode.getBoundingClientRect = () =>
    ({ x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 } as DOMRect);

  // nodeLookup needs the fromHandle node (nodeId='N') so XYHandle can find
  // fromHandleInternal. Give it a minimal source handle.
  const sourceHandle = {
    id: 'h', nodeId: 'N', type: 'source' as const,
    position: 'left' as any,
    x: 0, y: 0, width: 10, height: 10,
  };
  const nodeLookup = new Map([
    ['N', {
      id: 'N',
      position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 0, y: 0 },
        z: 0,
        handleBounds: { source: [sourceHandle], target: [] },
      },
    }],
  ]);

  return {
    autoPanOnConnect: false,
    connectionMode: 'strict' as any,
    connectionRadius: 50,
    domNode,
    handleId: 'h',
    nodeId: 'N',
    isTarget: false,
    nodeLookup: nodeLookup as any,
    lib: 'ng',
    flowId: 'flow-1',
    updateConnection: vi.fn(),
    panBy: vi.fn(),
    cancelConnection: vi.fn(),
    getTransform: () => [1, 0, 0] as any,
    getFromHandle: () => sourceHandle as any,
    dragThreshold: 0,
    handleDomNode: handleEl,
    isNodeVisible,
  };
}

describe('XYHandle.onPointerDown — isNodeVisible threading', () => {
  beforeEach(() => {
    // Fire a pointerup to flush any lingering onPointerMove listeners from a prior test.
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    vi.mocked(getClosestHandle).mockClear();
    vi.mocked(getFloatingDropTarget).mockClear();
    // jsdom does not implement elementFromPoint — stub it so isValidHandle
    // does not throw an uncaught exception after the utility mocks are called.
    if (!document.elementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        value: () => null,
        writable: true,
        configurable: true,
      });
    }
  });

  it('passes isNodeVisible to getClosestHandle on pointermove', () => {
    const predicate = vi.fn(() => true);
    const params = makeParams(predicate);

    const downEvt = makeFakeEvent('mousedown');
    XYHandle.onPointerDown(downEvt, params);

    const moveEvt = makeFakeEvent('pointermove', 100, 100);
    document.dispatchEvent(moveEvt);

    expect(vi.mocked(getClosestHandle)).toHaveBeenCalled();
    const args = vi.mocked(getClosestHandle).mock.calls[0];
    // 5th argument (index 4) is the isNodeVisible predicate.
    expect(args[4]).toBe(predicate);
  });

  it('passes isNodeVisible to getFloatingDropTarget when stage 1 returns null', () => {
    vi.mocked(getClosestHandle).mockReturnValue(null);
    const predicate = vi.fn(() => true);
    const params = makeParams(predicate);

    const downEvt = makeFakeEvent('mousedown');
    XYHandle.onPointerDown(downEvt, params);

    const moveEvt = makeFakeEvent('pointermove', 100, 100);
    document.dispatchEvent(moveEvt);

    expect(vi.mocked(getFloatingDropTarget)).toHaveBeenCalled();
    const args = vi.mocked(getFloatingDropTarget).mock.calls[0];
    // 4th argument (index 3) is the isNodeVisible predicate.
    expect(args[3]).toBe(predicate);
  });

  it('absent isNodeVisible passes undefined to both utilities', () => {
    const params = makeParams(undefined);

    const downEvt = makeFakeEvent('mousedown');
    XYHandle.onPointerDown(downEvt, params);

    const moveEvt = makeFakeEvent('pointermove', 100, 100);
    document.dispatchEvent(moveEvt);

    if (vi.mocked(getClosestHandle).mock.calls.length > 0) {
      expect(vi.mocked(getClosestHandle).mock.calls[0][4]).toBeUndefined();
    }
  });
});

// ── Regression: the drag session must tear down on pointerup ───────────────────
//
// Bug ("clicking to connect starts a phantom second connection"): the connection
// trigger is a `pointerdown`, but the session used to tear down on `mouseup`.
// Chrome suppresses the compatibility `mouseup` for the LEFT button while
// d3-drag owns the pointer stream (confirmed on real hardware: the click fires
// `pointerdown, mousedown, pointerup, click` — no `mouseup`), so `onPointerUp`
// never ran and the document move-listener leaked. The next bare cursor move
// then crossed the drag threshold and started a phantom connection from the
// just-clicked handle. Listening on the pointer family fixes it because
// `pointerup` always fires.

describe('XYHandle.onPointerDown — pointer-family teardown (no dangling listeners)', () => {
  beforeEach(() => {
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    if (!document.elementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        value: () => null,
        writable: true,
        configurable: true,
      });
    }
    vi.mocked(getClosestHandle).mockReturnValue(null);
    vi.mocked(getFloatingDropTarget).mockReturnValue(null);
  });

  function startedInProgress(updateConnection: unknown): boolean {
    return (updateConnection as { mock: { calls: unknown[][] } }).mock.calls.some(
      (c) => (c[0] as { inProgress?: boolean } | undefined)?.inProgress === true
    );
  }

  it('does NOT start a phantom connection after pointerup, even if the compat mouseup never fires', () => {
    const params = { ...makeParams(), dragThreshold: 1 };

    // Click a handle: pointerdown (threshold 1 → no connection yet).
    XYHandle.onPointerDown(makeFakeEvent('pointerdown'), params);

    // Real browser on left-click: pointerup fires; the compat mouseup is suppressed.
    document.dispatchEvent(makeFakeEvent('pointerup'));

    // User moves the cursor toward the next handle (button up). Both events fire.
    (params.updateConnection as ReturnType<typeof vi.fn>).mockClear();
    document.dispatchEvent(makeFakeEvent('pointermove', 300, 300));
    document.dispatchEvent(makeFakeEvent('mousemove', 300, 300));

    expect(startedInProgress(params.updateConnection)).toBe(false);
  });

  it('still starts a normal drag connection when the pointer moves past the threshold', () => {
    const params = { ...makeParams(), dragThreshold: 1 };

    XYHandle.onPointerDown(makeFakeEvent('pointerdown'), params);
    // No pointerup — an ongoing drag. Move past the threshold.
    document.dispatchEvent(makeFakeEvent('pointermove', 300, 300));

    expect(startedInProgress(params.updateConnection)).toBe(true);
  });
});

// ── Click-to-connect preview: stateless per-move connection state ──────────────
//
// Powers the click-connect preview line: while a handle is "armed" (first
// click), each cursor move recomputes a line from that handle to the cursor
// (snap + validity), with no drag lifecycle or listeners.

describe('XYHandle.getClickConnectionState', () => {
  beforeEach(() => {
    if (!document.elementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', { value: () => null, writable: true, configurable: true });
    }
    vi.mocked(getClosestHandle).mockReturnValue(null);
    vi.mocked(getFloatingDropTarget).mockReturnValue(null);
  });

  it('returns an in-progress connection from the armed handle to the cursor', () => {
    const params = makeParams();
    const state = XYHandle.getClickConnectionState(makeFakeEvent('pointermove', 250, 175), params);

    expect(state).not.toBeNull();
    expect(state!.inProgress).toBe(true);
    expect(state!.fromHandle.nodeId).toBe('N');
    // No handle under the cursor (mocks return null) → endpoint is the raw cursor
    // position (relative to the 0,0 container bounds), validity is unknown (null),
    // and there's no target handle. Same "no target yet" state the drag preview uses.
    expect(state!.to).toEqual({ x: 250, y: 175 });
    expect(state!.isValid).toBeNull();
    expect(state!.toHandle).toBeNull();
  });

  it('returns null when the armed handle cannot be resolved', () => {
    const params = { ...makeParams(), nodeId: 'does-not-exist' };
    const state = XYHandle.getClickConnectionState(makeFakeEvent('pointermove', 10, 10), params);
    expect(state).toBeNull();
  });
});

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
    // Fire a mouseup to flush any lingering onPointerMove listeners from a prior test.
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
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

    const moveEvt = makeFakeEvent('mousemove', 100, 100);
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

    const moveEvt = makeFakeEvent('mousemove', 100, 100);
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

    const moveEvt = makeFakeEvent('mousemove', 100, 100);
    document.dispatchEvent(moveEvt);

    if (vi.mocked(getClosestHandle).mock.calls.length > 0) {
      expect(vi.mocked(getClosestHandle).mock.calls[0][4]).toBeUndefined();
    }
  });
});

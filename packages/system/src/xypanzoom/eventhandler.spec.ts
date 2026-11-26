import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { createPanZoomStartHandler, createPanZoomHandler, createPanZoomEndHandler } from './eventhandler';
import type { ZoomPanValues } from './XYPanZoom';

const T0 = zoomIdentity;
const T1 = zoomIdentity.translate(30, 0);
const T2 = zoomIdentity.scale(2);
const mouse = (type: string, x = 0, y = 0, button = 0) => ({ type, clientX: x, clientY: y, button });
const touches = (type: string, pts: [number, number, number][]) => ({
  type,
  touches: pts.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
});
const ev = (sourceEvent: unknown, transform: ZoomTransform = T0) => ({ sourceEvent, transform }) as never;

function harness(
  threshold: number,
  extra: { panOnDrag?: boolean | number[]; onPaneContextMenu?: (e: unknown) => void } = {}
) {
  const zoomPanValues: ZoomPanValues = {
    isZoomingOrPanning: false,
    prevViewport: { x: 0, y: 0, zoom: 1 },
    mouseButton: 0,
    timerId: undefined,
    panScrollTimeout: undefined,
    isPanScrolling: false,
    pointerDrag: null,
  };
  const d3Selection = { property: vi.fn() };
  const spies = {
    onDraggingChange: vi.fn(),
    onPanZoomStart: vi.fn(),
    onPanZoom: vi.fn(),
    onPanZoomEnd: vi.fn(),
    onTransformChange: vi.fn(),
  };
  const start = createPanZoomStartHandler({
    zoomPanValues,
    paneDragThreshold: threshold,
    onDraggingChange: spies.onDraggingChange,
    onPanZoomStart: spies.onPanZoomStart,
  });
  const zoom = createPanZoomHandler({
    zoomPanValues,
    d3Selection: d3Selection as never,
    paneDragThreshold: threshold,
    onDraggingChange: spies.onDraggingChange,
    onPanZoomStart: spies.onPanZoomStart,
    onPanZoom: spies.onPanZoom,
    onTransformChange: spies.onTransformChange,
  });
  const end = createPanZoomEndHandler({
    zoomPanValues,
    panOnDrag: extra.panOnDrag ?? true,
    panOnScroll: false,
    onDraggingChange: spies.onDraggingChange,
    onPanZoomEnd: spies.onPanZoomEnd,
    onPaneContextMenu: extra.onPaneContextMenu,
  });
  return { zoomPanValues, d3Selection, spies, start, zoom, end };
}

describe('pan/zoom pointer-drag threshold (#6115)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a mouse press below the threshold restores __zoom and reports nothing', () => {
    const h = harness(5);
    h.start(ev(mouse('mousedown', 0, 0)));
    h.zoom(ev(mouse('mousemove', 3, 0), T1));
    expect(h.d3Selection.property).toHaveBeenCalledWith('__zoom', T0);
    h.end(ev(mouse('mouseup', 3, 0)));
    vi.runAllTimers();
    for (const spy of Object.values(h.spies)) expect(spy).not.toHaveBeenCalled();
  });

  it('crossing the threshold starts the move and the dragging state', () => {
    const h = harness(5);
    h.start(ev(mouse('mousedown', 0, 0)));
    h.zoom(ev(mouse('mousemove', 10, 0), T1));
    expect(h.spies.onPanZoomStart).toHaveBeenCalledTimes(1);
    expect(h.spies.onDraggingChange).toHaveBeenCalledWith(true);
    expect(h.spies.onTransformChange).toHaveBeenCalledWith([30, 0, 1]);
    expect(h.spies.onPanZoom).toHaveBeenCalledTimes(1);
    h.end(ev(mouse('mouseup', 10, 0), T1));
    vi.runAllTimers();
    expect(h.spies.onDraggingChange).toHaveBeenLastCalledWith(false);
    expect(h.spies.onPanZoomEnd).toHaveBeenCalledTimes(1);
  });

  it('a threshold of 0 starts on press', () => {
    const h = harness(0);
    h.start(ev(mouse('mousedown', 0, 0)));
    expect(h.spies.onPanZoomStart).toHaveBeenCalledTimes(1);
    expect(h.spies.onDraggingChange).toHaveBeenCalledWith(true);
  });

  it('a single touch respects the threshold and never sets dragging', () => {
    const h = harness(5);
    h.start(ev(touches('touchstart', [[1, 0, 0]])));
    h.zoom(ev(touches('touchmove', [[1, 3, 0]]), T1));
    expect(h.d3Selection.property).toHaveBeenCalledWith('__zoom', T0);
    expect(h.spies.onTransformChange).not.toHaveBeenCalled();
    h.zoom(ev(touches('touchmove', [[1, 10, 0]]), T1));
    expect(h.spies.onTransformChange).toHaveBeenCalled();
    expect(h.spies.onDraggingChange).not.toHaveBeenCalledWith(true);
  });

  it('a second touch (pinch) or a lost first touch starts at once', () => {
    const pinch = harness(50);
    pinch.start(ev(touches('touchstart', [[1, 0, 0]])));
    pinch.zoom(
      ev(
        touches('touchmove', [
          [1, 0, 0],
          [2, 1, 1],
        ]),
        T2
      )
    );
    expect(pinch.spies.onTransformChange).toHaveBeenCalledWith([0, 0, 2]);
    const lost = harness(50);
    lost.start(ev(touches('touchstart', [[1, 0, 0]])));
    lost.zoom(ev(touches('touchmove', [[2, 1, 1]]), T1));
    expect(lost.spies.onTransformChange).toHaveBeenCalled();
  });

  it('a wheel zoom while the button is held becomes the new resting transform', () => {
    const h = harness(5);
    h.start(ev(mouse('mousedown', 0, 0)));
    h.zoom(ev({ type: 'wheel' }, T2));
    expect(h.spies.onTransformChange).toHaveBeenCalledWith([0, 0, 2]);
    expect(h.spies.onPanZoomStart).toHaveBeenCalledTimes(1);
    expect(h.spies.onDraggingChange).not.toHaveBeenCalled();
    h.zoom(ev(mouse('mousemove', 1, 0), T1));
    expect(h.d3Selection.property).toHaveBeenLastCalledWith('__zoom', T2);
  });

  it('a right-click pan without movement still reports a context menu', () => {
    const onPaneContextMenu = vi.fn();
    const h = harness(5, { panOnDrag: [2], onPaneContextMenu });
    h.start(ev(mouse('mousedown', 0, 0, 2)));
    h.end(ev(mouse('mouseup', 0, 0, 2)));
    expect(onPaneContextMenu).toHaveBeenCalledTimes(1);
  });

  it('programmatic transitions (null sourceEvent) keep angflow behaviour: start, zoom and end are reported', () => {
    const h = harness(5);
    h.start(ev(null));
    expect(h.spies.onPanZoomStart).toHaveBeenCalledWith(null, { x: 0, y: 0, zoom: 1 });
    expect(h.zoomPanValues.isZoomingOrPanning).toBe(true);
    expect(h.zoomPanValues.pointerDrag).toBeNull();
    h.zoom(ev(null, T1));
    expect(h.spies.onTransformChange).toHaveBeenCalledWith([30, 0, 1]);
    expect(h.spies.onPanZoom).toHaveBeenCalledTimes(1);
    h.end(ev(null, T1));
    vi.runAllTimers();
    expect(h.spies.onDraggingChange).toHaveBeenCalledWith(false);
    expect(h.spies.onPanZoomEnd).toHaveBeenCalledTimes(1);
  });
});

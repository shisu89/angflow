import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanOnScrollMode, type CoordinateExtent, type PanZoomUpdateOptions } from '../types';
import { XYPanZoom } from './XYPanZoom';
import { createFilter } from './filter';

const extent: CoordinateExtent = [
  [-Infinity, -Infinity],
  [Infinity, Infinity],
];

function zoomListenerTypes(node: HTMLElement): string[] {
  const listeners = (node as HTMLElement & {
    __on?: Array<{ type: string; name: string }>;
  }).__on ?? [];
  return listeners
    .filter(({ name }) => name === 'zoom')
    .map(({ type }) => type)
    .sort();
}

function updateOptions(
  onTransformChange: PanZoomUpdateOptions['onTransformChange'],
  overrides: Partial<PanZoomUpdateOptions> = {}
): PanZoomUpdateOptions {
  return {
    noWheelClassName: 'nowheel',
    noPanClassName: 'nopan',
    preventScrolling: true,
    panOnScroll: false,
    panOnDrag: true,
    panOnScrollMode: PanOnScrollMode.Free,
    panOnScrollSpeed: 0.5,
    userSelectionActive: false,
    zoomOnPinch: true,
    zoomOnScroll: true,
    zoomOnDoubleClick: true,
    lib: 'ng',
    onTransformChange,
    paneClickDistance: 0,
    selectionOnDrag: true,
    ...overrides,
  };
}

function setup() {
  const domNode = document.createElement('div');
  vi.spyOn(domNode, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600,
    width: 800, height: 600, toJSON: () => ({}),
  });
  const onTransformChange = vi.fn();
  const panZoom = XYPanZoom({
    domNode,
    minZoom: 0.5,
    maxZoom: 2,
    translateExtent: extent,
    viewport: { x: 0, y: 0, zoom: 1 },
    onDraggingChange: vi.fn(),
  });
  panZoom.update(updateOptions(onTransformChange));
  return { domNode, onTransformChange, panZoom };
}

describe('XYPanZoom selection lifecycle', () => {
  it('keeps D3 DOM listeners attached while box selection is active', () => {
    const { domNode, panZoom } = setup();
    const before = zoomListenerTypes(domNode);
    expect(before).toContain('mousedown');
    expect(before).toContain('wheel');

    panZoom.update(updateOptions(vi.fn(), { userSelectionActive: true }));

    expect(zoomListenerTypes(domNode)).toEqual(before);
  });

  it('propagates programmatic transforms during box selection', async () => {
    const { onTransformChange, panZoom } = setup();
    panZoom.update(updateOptions(onTransformChange, { userSelectionActive: true }));

    await panZoom.setViewport({ x: 25, y: 30, zoom: 1 });

    expect(onTransformChange).toHaveBeenLastCalledWith([25, 30, 1]);
  });

  it('removes all D3 zoom listeners on real destroy', () => {
    const { domNode, panZoom } = setup();
    panZoom.destroy();
    expect(zoomListenerTypes(domNode)).toEqual([]);
  });
});

describe('createFilter middle-click pan', () => {
  function middleClickOnNode() {
    const node = document.createElement('div');
    node.className = 'ng-flow__node';
    return { type: 'mousedown', button: 1, target: node, composedPath: () => [node] };
  }

  function filterFor(userSelectionActive: boolean) {
    return createFilter({
      zoomOnScroll: true,
      zoomOnPinch: true,
      // Left-button only, so the middle-click-on-node branch is the ONLY thing
      // that can return true here — every later check rejects button 1.
      panOnDrag: [0],
      panOnScroll: false,
      zoomOnDoubleClick: true,
      userSelectionActive,
      noWheelClassName: 'nowheel',
      noPanClassName: 'nopan',
      lib: 'ng',
    });
  }

  it('allows a middle-click pan that starts on a node', () => {
    expect(filterFor(false)(middleClickOnNode())).toBe(true);
  });

  it('blocks it while a box selection is active', () => {
    // Regression guard for the branch that returns true ahead of the blanket
    // userSelectionActive check — mousedown.zoom is no longer torn down during a
    // selection, so the filter is the only thing stopping a competing d3 pan.
    expect(filterFor(true)(middleClickOnNode())).toBe(false);
  });
});

describe('XYPanZoom transition promises (#6064)', () => {
  it('resolves true when a transition runs to the end', async () => {
    const { panZoom } = setup();
    await expect(panZoom.setViewport({ x: 10, y: 0, zoom: 1 }, { duration: 20 })).resolves.toBe(true);
    await expect(panZoom.scaleTo(1.5, { duration: 20 })).resolves.toBe(true);
    await expect(panZoom.scaleBy(1.1, { duration: 20 })).resolves.toBe(true);
  });

  it('resolves true immediately without a duration', async () => {
    const { panZoom } = setup();
    await expect(panZoom.setViewport({ x: 10, y: 0, zoom: 1 })).resolves.toBe(true);
  });

  it('resolves false when another viewport call cancels a scheduled transition', async () => {
    const { panZoom } = setup();
    const pending = panZoom.setViewport({ x: 300, y: 0, zoom: 1 }, { duration: 5000 });
    void panZoom.setViewport({ x: 0, y: 0, zoom: 1 }); // interrupts before the transition starts -> 'cancel'
    await expect(pending).resolves.toBe(false);
  });

  it('resolves false when a running transition is interrupted', async () => {
    const { panZoom } = setup();
    const pending = panZoom.scaleTo(1.8, { duration: 5000 });
    await new Promise((r) => setTimeout(r, 50)); // let it start
    void panZoom.setViewport({ x: 0, y: 0, zoom: 1 }); // -> 'interrupt'
    await expect(pending).resolves.toBe(false);
  });
});

describe('XYPanZoom pane extent cache (#5850)', () => {
  function stubResizeObserver() {
    const captured: { callback?: (entries: unknown[]) => void; disconnect: ReturnType<typeof vi.fn> } = {
      disconnect: vi.fn(),
    };
    class FakeResizeObserver {
      constructor(callback: (entries: unknown[]) => void) {
        captured.callback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {
        captured.disconnect();
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    return captured;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not read layout size per gesture', async () => {
    stubResizeObserver();
    const { domNode, panZoom } = setup();
    const clientWidth = vi.fn(() => 800);
    const clientHeight = vi.fn(() => 600);
    Object.defineProperty(domNode, 'clientWidth', { get: clientWidth });
    Object.defineProperty(domNode, 'clientHeight', { get: clientHeight });

    await panZoom.scaleBy(2);

    expect(clientWidth).not.toHaveBeenCalled();
    expect(clientHeight).not.toHaveBeenCalled();
  });

  it('uses the observed size', async () => {
    const ro = stubResizeObserver();
    const { panZoom } = setup();

    ro.callback!([{ contentRect: { width: 400, height: 300 } }]);
    await panZoom.scaleTo(2);

    expect(panZoom.getViewport()).toEqual({ x: -200, y: -150, zoom: 2 });
  });

  it('ignores observer entries without contentRect (#6108)', async () => {
    const ro = stubResizeObserver();
    const { panZoom } = setup();

    expect(() => ro.callback!([{}])).not.toThrow();
    await panZoom.scaleTo(2);

    expect(panZoom.getViewport()).toEqual({ x: -400, y: -300, zoom: 2 });
  });

  it('disconnects the observer on destroy (#6054)', () => {
    const ro = stubResizeObserver();
    const { panZoom } = setup();

    panZoom.destroy();

    expect(ro.disconnect).toHaveBeenCalled();
  });
});

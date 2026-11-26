import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanOnScrollMode, type CoordinateExtent, type PanZoomUpdateOptions } from '../types';
import { XYPanZoom } from './XYPanZoom';
import { createFilter } from './filter';

// d3 removes its post-drag click suppressor after setTimeout(0); draining it keeps one test's
// suppressor from swallowing the next test's click.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

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
    paneDragThreshold: 1,
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
  const onDraggingChange = vi.fn();
  const panZoom = XYPanZoom({
    domNode,
    minZoom: 0.5,
    maxZoom: 2,
    translateExtent: extent,
    viewport: { x: 0, y: 0, zoom: 1 },
    onDraggingChange,
  });
  panZoom.update(updateOptions(onTransformChange));
  return { domNode, onTransformChange, onDraggingChange, panZoom };
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
  // The element carries `nopan`, so the middle-button branch is the ONLY path that
  // can return true (the nopan check rejects everything after it).
  function middleClickOn(className: string) {
    const node = document.createElement('div');
    node.className = className;
    return { type: 'mousedown', button: 1, target: node, composedPath: () => [node] };
  }

  function filterFor(userSelectionActive: boolean, panOnDrag: boolean | number[]) {
    return createFilter({
      zoomOnScroll: true,
      zoomOnPinch: true,
      panOnDrag,
      panOnScroll: false,
      zoomOnDoubleClick: true,
      userSelectionActive,
      noWheelClassName: 'nowheel',
      noPanClassName: 'nopan',
      lib: 'ng',
    });
  }

  it('allows a middle-click pan that starts on a node when panOnDrag includes button 1', () => {
    expect(filterFor(false, [0, 1])(middleClickOn('ng-flow__node nopan'))).toBe(true);
  });

  it('blocks it on a node when panOnDrag excludes button 1 (#6119)', () => {
    expect(filterFor(false, [0])(middleClickOn('ng-flow__node nopan'))).toBe(false);
  });

  it('blocks it while a box selection is active', () => {
    // Regression guard for the branch that returns true ahead of the blanket
    // userSelectionActive check — mousedown.zoom is no longer torn down during a
    // selection, so the filter is the only thing stopping a competing d3 pan.
    expect(filterFor(true, [0, 1])(middleClickOn('ng-flow__node nopan'))).toBe(false);
  });

  it('allows it from the nodes selection (#5902)', () => {
    expect(filterFor(false, true)(middleClickOn('ng-flow__nodesselection nopan'))).toBe(true);
  });

  it('allows it from the selection rect class (#5902)', () => {
    expect(filterFor(false, true)(middleClickOn('ng-flow__selection nopan'))).toBe(true);
  });

  it('blocks it from the nodes selection when panOnDrag is false (#6119)', () => {
    expect(filterFor(false, false)(middleClickOn('ng-flow__nodesselection nopan'))).toBe(false);
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

describe('createFilter pan activation key (#5922)', () => {
  function filterFor(panActivationKeyPressed?: boolean) {
    return createFilter({
      panActivationKeyPressed,
      zoomOnScroll: true,
      zoomOnPinch: true,
      panOnDrag: true,
      panOnScroll: false,
      zoomOnDoubleClick: true,
      userSelectionActive: false,
      noWheelClassName: 'nowheel',
      noPanClassName: 'nopan',
      lib: 'ng',
    });
  }

  function ctrlMouseDown() {
    const target = document.createElement('div');
    return { type: 'mousedown', button: 0, ctrlKey: true, target, composedPath: () => [target] };
  }

  it('rejects a ctrl-modified drag without the pan activation key', () => {
    expect(filterFor()(ctrlMouseDown())).toBe(false);
  });

  it('allows a ctrl-modified drag while the pan activation key is held', () => {
    expect(filterFor(true)(ctrlMouseDown())).toBe(true);
  });

  it('leaves ctrl+wheel to the zoomOnPinch rules', () => {
    const target = document.createElement('div');
    const wheel = { type: 'wheel', button: 0, ctrlKey: true, target, composedPath: () => [target] };
    expect(filterFor(true)(wheel)).toBe(true);
    const noPinch = createFilter({
      panActivationKeyPressed: true,
      zoomOnScroll: true,
      zoomOnPinch: false,
      panOnDrag: true,
      panOnScroll: false,
      zoomOnDoubleClick: true,
      userSelectionActive: false,
      noWheelClassName: 'nowheel',
      noPanClassName: 'nopan',
      lib: 'ng',
    });
    expect(noPinch(wheel)).toBe(false);
  });
});

describe('XYPanZoom paneDragThreshold (#6115)', () => {
  let attached: ReturnType<typeof setup> | null = null;
  function setupAttached() {
    const s = setup();
    document.body.appendChild(s.domNode);
    attached = s;
    s.onTransformChange.mockClear();
    s.onDraggingChange.mockClear();
    return s;
  }
  afterEach(async () => {
    attached?.panZoom.destroy();
    attached?.domNode.remove();
    attached = null;
    await flush();
  });
  // jsdom rejects `view: window` under vitest's global proxy, so the real Window is attached afterwards.
  const view = document.defaultView as Window;
  const mouse = (type: string, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 100, button: 0 });
    Object.defineProperty(event, 'view', { value: view });
    return event;
  };
  function press(domNode: HTMLElement, dx: number) {
    domNode.dispatchEvent(mouse('mousedown', 100));
    view.dispatchEvent(mouse('mousemove', 100 + dx));
    view.dispatchEvent(mouse('mouseup', 100 + dx));
    const click = vi.fn();
    domNode.addEventListener('click', click);
    domNode.dispatchEvent(mouse('click', 100 + dx));
    return click;
  }

  it('below the threshold: no transform, no dragging, __zoom unchanged, the click is kept', () => {
    const { domNode, panZoom, onTransformChange, onDraggingChange } = setupAttached();
    panZoom.update(updateOptions(onTransformChange, { paneDragThreshold: 5 }));
    const click = press(domNode, 3);
    expect(onTransformChange).not.toHaveBeenCalled();
    expect(onDraggingChange).not.toHaveBeenCalled();
    expect((domNode as unknown as { __zoom: { x: number; k: number } }).__zoom).toMatchObject({ x: 0, k: 1 });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('past the threshold: pans, toggles dragging, and d3 suppresses the click', () => {
    const { domNode, panZoom, onTransformChange, onDraggingChange } = setupAttached();
    panZoom.update(updateOptions(onTransformChange, { paneDragThreshold: 5 }));
    const click = press(domNode, 20);
    expect(onTransformChange).toHaveBeenCalled();
    expect(onDraggingChange).toHaveBeenNthCalledWith(1, true);
    expect(onDraggingChange).toHaveBeenLastCalledWith(false);
    expect(click).not.toHaveBeenCalled();
  });
});

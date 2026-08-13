import { describe, expect, it, vi } from 'vitest';
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

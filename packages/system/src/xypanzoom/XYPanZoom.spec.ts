import { describe, expect, it, vi } from 'vitest';
import { PanOnScrollMode, type CoordinateExtent, type PanZoomUpdateOptions } from '../types';
import { XYPanZoom } from './XYPanZoom';

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

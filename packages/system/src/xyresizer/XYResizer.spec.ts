import { describe, it, expect, vi, afterEach } from 'vitest';

import { XYResizer } from './XYResizer';
import { adoptUserNodes } from '../utils/store';
import type { ControlPosition } from './types';
import type { InternalNodeBase, NodeBase, NodeLookup, ParentLookup } from '../types';

type ResizerUpdate = Parameters<ReturnType<typeof XYResizer>['update']>[0];

// jsdom rejects `view: window` under vitest's global proxy, so the real Window is attached afterwards.
const view = document.defaultView as Window;
const mouse = (type: string, target: EventTarget, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'view', { value: view });
  return target.dispatchEvent(event);
};

const node = (id: string, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  measured: { width: 100, height: 100 },
  ...extra,
});

function setup(
  nodes: NodeBase[],
  nodeId: string,
  controlPosition: ControlPosition,
  callbacks: Partial<ResizerUpdate> = {}
) {
  const nodeLookup: NodeLookup<InternalNodeBase<NodeBase>> = new Map();
  const parentLookup: ParentLookup<InternalNodeBase<NodeBase>> = new Map();
  adoptUserNodes(nodes, nodeLookup, parentLookup);

  const pane = document.createElement('div');
  const control = document.createElement('div');
  pane.appendChild(control);
  document.body.appendChild(pane);

  const onChange = vi.fn();
  const onEnd = vi.fn();
  const onResizeStart = vi.fn();
  const onResize = vi.fn();
  const onResizeEnd = vi.fn();

  const resizer = XYResizer({
    domNode: control,
    nodeId,
    onChange,
    onEnd,
    getStoreItems: () => ({
      nodeLookup,
      transform: [0, 0, 1],
      snapGrid: [15, 15],
      snapToGrid: false,
      nodeOrigin: [0, 0],
      paneDomNode: pane,
    }),
  });
  resizer.update({
    controlPosition,
    boundaries: { minWidth: 10, minHeight: 10, maxWidth: 1000, maxHeight: 1000 },
    keepAspectRatio: false,
    onResizeStart,
    onResize,
    onResizeEnd,
    shouldResize: undefined,
    ...callbacks,
  } as ResizerUpdate);

  return { pane, control, onChange, onEnd, onResizeStart, onResize, onResizeEnd, nodeLookup, resizer };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('XYResizer', () => {
  it('always ends a gesture that started, even without any move', () => {
    const { control, onResizeStart, onResizeEnd, onEnd } = setup([node('a')], 'a', 'bottom-right');

    mouse('mousedown', control, 100, 100);
    mouse('mouseup', view, 100, 100);

    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a frame rejected by shouldResize leaves no values behind', () => {
    const shouldResize = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const { control, onResize, onChange } = setup([node('a')], 'a', 'bottom-right', { shouldResize });

    mouse('mousedown', control, 100, 100);
    mouse('mousemove', view, 150, 150);
    mouse('mousemove', view, 150, 150);
    mouse('mouseup', view, 150, 150);

    expect(shouldResize).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize.mock.calls[0][1]).toMatchObject({ width: 150, height: 150 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not throw or call onEnd when the node vanished', () => {
    const { control, onEnd, onResizeEnd, nodeLookup } = setup([node('a')], 'a', 'bottom-right');
    nodeLookup.clear();

    expect(() => {
      mouse('mousedown', control, 100, 100);
      mouse('mouseup', view, 100, 100);
    }).not.toThrow();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it('starts from the clamped drawn position of a node outside its own extent', () => {
    const nodes = [
      node('a', {
        position: { x: -50, y: 0 },
        extent: [
          [0, 0],
          [200, 200],
        ],
      }),
    ];
    const { control, onResize } = setup(nodes, 'a', 'bottom-right');

    mouse('mousedown', control, 100, 100);
    mouse('mousemove', view, 110, 100);
    mouse('mouseup', view, 110, 100);

    expect(onResize).toHaveBeenCalled();
    expect(onResize.mock.calls[0][1]).toMatchObject({ x: 0, width: 110 });
  });

  it('computes a child extent from absolute positions under an origin parent', () => {
    const nodes = [
      node('p', { position: { x: 100, y: 100 }, origin: [0.5, 0.5] }),
      node('c', {
        parentId: 'p',
        extent: 'parent',
        position: { x: 10, y: 10 },
        measured: { width: 20, height: 20 },
      }),
    ];
    const { control, onResize } = setup(nodes, 'p', 'bottom-right');

    // Shrink far below the child's right edge: the child (parent-relative 10..30) bounds the width.
    mouse('mousedown', control, 100, 100);
    mouse('mousemove', view, 0, 0);
    mouse('mouseup', view, 0, 0);

    expect(onResize).toHaveBeenCalled();
    const last = onResize.mock.calls.at(-1)![1];
    expect(last.width).toBe(30);
    expect(last.height).toBe(30);
  });
});

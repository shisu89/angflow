import { describe, it, expect, vi, afterEach } from 'vitest';
import { XYDrag } from './XYDrag';
import { adoptUserNodes } from '../utils/store';
import type { InternalNodeBase, NodeBase, NodeLookup, ParentLookup } from '../types';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const box = (id: string, x = 0, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x, y: 0 },
  data: {},
  measured: { width: 100, height: 40 },
  ...extra,
});

function setup(
  opts: { nodes?: NodeBase[]; nodeId?: string; nodeDragThreshold?: number; nodeExtent?: number[][] } = {}
) {
  const pane = document.createElement('div');
  const nodeEl = document.createElement('div');
  pane.appendChild(nodeEl);
  document.body.appendChild(pane);
  const nodeLookup = new Map() as NodeLookup<InternalNodeBase>;
  adoptUserNodes(opts.nodes ?? [box('a')], nodeLookup, new Map() as ParentLookup<InternalNodeBase>);
  const updateNodePositions = vi.fn();
  const store = {
    nodes: [...nodeLookup.values()].map((n) => n.internals.userNode),
    nodeLookup,
    edges: [],
    nodeExtent: opts.nodeExtent ?? [
      [-Infinity, -Infinity],
      [Infinity, Infinity],
    ],
    snapGrid: [15, 15],
    snapToGrid: false,
    nodeOrigin: [0, 0],
    multiSelectionActive: false,
    domNode: pane,
    transform: [0, 0, 1],
    autoPanOnNodeDrag: false,
    nodesDraggable: true,
    selectNodesOnDrag: true,
    nodeDragThreshold: opts.nodeDragThreshold ?? 1,
    panBy: vi.fn(async () => false),
    unselectNodesAndEdges: vi.fn(),
    updateNodePositions,
  };
  const drag = XYDrag({ getStoreItems: () => store as never });
  const nodeId = opts.nodeId ?? 'a';
  drag.update({ domNode: nodeEl, nodeId, isSelectable: true });
  const clicks = { node: vi.fn(), pane: vi.fn() };
  nodeEl.addEventListener('click', clicks.node);
  pane.addEventListener('click', clicks.pane);
  return { pane, nodeEl, store, drag, clicks, updateNodePositions, nodeLookup, nodeId };
}

// jsdom rejects `view: window` under vitest's global proxy, so the real Window is attached afterwards.
const view = document.defaultView as Window;
const mouse = (type: string, target: EventTarget, x: number, y = 10) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'view', { value: view });
  return target.dispatchEvent(event);
};
const moved = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.some(([, dragging]) => dragging === true);
/**
 * A full mouse drag. The move that crosses nodeDragThreshold only starts the drag (startDrag sets
 * lastPos = pointerPos, so that move moves nothing); updateNodePositions fires from the NEXT move on.
 * Every simulated drag therefore needs the crossing move plus at least one further move.
 */
function drag(target: EventTarget, x0: number, x1: number, upTarget: EventTarget = target) {
  mouse('mousedown', target, x0);
  mouse('mousemove', target, x1); // crosses the threshold: starts the drag
  mouse('mousemove', target, x1 + 10); // first move that updates positions
  mouse('mouseup', upTarget, x1 + 10);
}

afterEach(async () => {
  // let any pending preventNextClick suppressor remove itself so it can't leak into the next test
  await flush();
  document.body.innerHTML = '';
});

describe('XYDrag click suppression (#5556)', () => {
  it('a press that moves less than nodeDragThreshold still clicks', () => {
    const { nodeEl, clicks, updateNodePositions } = setup({ nodeDragThreshold: 1 });
    mouse('mousedown', nodeEl, 10);
    mouse('mousemove', nodeEl, 11);
    mouse('mouseup', nodeEl, 11);
    mouse('click', nodeEl, 11);
    expect(moved(updateNodePositions)).toBe(false);
    expect(clicks.node).toHaveBeenCalledTimes(1);
  });

  it('a drag that moved nodes suppresses exactly the next click; the suppressor is gone after a task', async () => {
    const { nodeEl, clicks, updateNodePositions } = setup();
    drag(nodeEl, 10, 60);
    expect(moved(updateNodePositions)).toBe(true);
    mouse('click', nodeEl, 60);
    expect(clicks.node).not.toHaveBeenCalled();
    await flush();
    mouse('click', nodeEl, 60);
    expect(clicks.node).toHaveBeenCalledTimes(1);
  });

  it('a moved drag released outside the node suppresses the click dispatched to the ancestor', () => {
    const { pane, nodeEl, clicks } = setup();
    drag(nodeEl, 10, 60, pane);
    mouse('click', pane, 70);
    expect(clicks.pane).not.toHaveBeenCalled();
  });

  it('a drag clamped by the extent (no position change) released on the node does not suppress the click', () => {
    const { nodeEl, clicks, updateNodePositions } = setup({
      nodeExtent: [
        [0, 0],
        [100, 40],
      ],
    });
    drag(nodeEl, 10, 60);
    expect(moved(updateNodePositions)).toBe(false);
    mouse('click', nodeEl, 70);
    expect(clicks.node).toHaveBeenCalledTimes(1);
  });

  it('measures the threshold from the press point', () => {
    const { nodeEl, updateNodePositions } = setup({ nodeDragThreshold: 5 });
    mouse('mousedown', nodeEl, 10);
    mouse('mousemove', nodeEl, 13); // 3px from the press
    expect(moved(updateNodePositions)).toBe(false);
    mouse('mousemove', nodeEl, 16); // 3px from the last move, 6px from the press: crosses, starts the drag
    mouse('mousemove', nodeEl, 20); // the move after the crossing updates positions
    expect(moved(updateNodePositions)).toBe(true);
  });

  it('an aborted drag does not leak into the next press', () => {
    const { nodeEl, nodeLookup, updateNodePositions } = setup();
    const nodeA = nodeLookup.get('a')!;
    mouse('mousedown', nodeEl, 10);
    mouse('mousemove', nodeEl, 60); // crossing: the drag starts (dragStarted = true, dragItems set)
    mouse('mousemove', nodeEl, 70); // positions update
    nodeLookup.delete('a'); // deleted mid-drag → abort
    mouse('mousemove', nodeEl, 80);
    mouse('mouseup', nodeEl, 80);
    expect(updateNodePositions).toHaveBeenLastCalledWith(expect.any(Map), false); // abort reset kept
    nodeLookup.set('a', nodeA);
    updateNodePositions.mockClear();
    mouse('mousedown', nodeEl, 10);
    mouse('mousemove', nodeEl, 10.5); // below the threshold
    mouse('mouseup', nodeEl, 10.5);
    expect(moved(updateNodePositions)).toBe(false);
  });

  it('dragging an unselected node moves only that node (B #6097 kept)', () => {
    const { nodeEl, updateNodePositions } = setup({
      nodes: [box('a', 0, { selected: true }), box('b', 200)],
      nodeId: 'b',
    });
    mouse('mousedown', nodeEl, 210);
    mouse('mousemove', nodeEl, 260); // crossing
    mouse('mousemove', nodeEl, 270); // first position update
    const first = updateNodePositions.mock.calls.find(([, dragging]) => dragging === true)!;
    expect([...(first[0] as Map<string, unknown>).keys()]).toEqual(['b']);
  });
});

const touch = (type: string, target: EventTarget, x: number, y = 10, id = 1) => {
  const point = { identifier: id, clientX: x, clientY: y, pageX: x, pageY: y, target };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : [point] },
    changedTouches: { value: [point] },
    view: { value: view },
  });
  target.dispatchEvent(event);
};

describe('XYDrag binds once per element (#6168)', () => {
  it('a second update() with the same element adds and removes no listeners; new params apply to the next gesture', () => {
    const { nodeEl, drag: instance, updateNodePositions } = setup();
    const add = vi.spyOn(nodeEl, 'addEventListener');
    const remove = vi.spyOn(nodeEl, 'removeEventListener');
    instance.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true, handleSelector: '.grip' });
    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    drag(nodeEl, 10, 60); // not on .grip → filtered out
    expect(moved(updateNodePositions)).toBe(false);

    const grip = document.createElement('span');
    grip.className = 'grip';
    nodeEl.appendChild(grip);
    drag(grip, 10, 60);
    expect(moved(updateNodePositions)).toBe(true);
  });

  it('destroy() then update() rebinds', () => {
    const { nodeEl, drag: instance, updateNodePositions } = setup();
    instance.destroy();
    const add = vi.spyOn(nodeEl, 'addEventListener');
    instance.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true });
    expect(add.mock.calls.some(([type]) => type === 'mousedown')).toBe(true);
    drag(nodeEl, 10, 60);
    expect(moved(updateNodePositions)).toBe(true);
  });

  it('a touch drag in progress survives an update()', () => {
    const { nodeEl, drag: instance, updateNodePositions } = setup();
    // d3-drag binds touch listeners only on touch-capable elements; mark the node element as one, then rebind.
    Object.defineProperty(nodeEl, 'ontouchstart', { value: null, configurable: true });
    instance.destroy();
    instance.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true });

    touch('touchstart', nodeEl, 10);
    touch('touchmove', nodeEl, 40); // crossing: starts the drag, moves nothing
    touch('touchmove', nodeEl, 50); // first position update
    const before = updateNodePositions.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    instance.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true }); // e.g. an input changed mid-gesture
    touch('touchmove', nodeEl, 80);
    expect(updateNodePositions.mock.calls.length).toBeGreaterThan(before);
    touch('touchend', nodeEl, 80);
    expect(updateNodePositions).toHaveBeenLastCalledWith(expect.any(Map), false);
  });
});

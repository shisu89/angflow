import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adoptUserNodes, updateNodeInternals } from './store';
import type {
  NodeBase,
  InternalNodeBase,
  NodeLookup,
  ParentLookup,
  InternalNodeUpdate,
} from '../types';

function lookups() {
  return {
    nodeLookup: new Map() as NodeLookup<InternalNodeBase<NodeBase>>,
    parentLookup: new Map() as ParentLookup<InternalNodeBase<NodeBase>>,
  };
}

const node = (id: string, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});

/** updateNodeInternals bails unless the container holds `.xyflow__viewport`. */
function makeDom(): HTMLElement {
  const domNode = document.createElement('div');
  const viewport = document.createElement('div');
  viewport.classList.add('xyflow__viewport');
  domNode.appendChild(viewport);
  document.body.appendChild(domNode);
  return domNode;
}

/**
 * jsdom performs no layout, so offsetWidth/offsetHeight are 0 — and
 * updateNodeInternals skips any node whose measured size is falsy. Stub real
 * numbers or the test silently exercises nothing.
 */
function makeNodeEl(width: number, height: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      x: 0, y: 0, width, height,
      top: 0, left: 0, right: width, bottom: height,
      toJSON: () => ({}),
    }) as DOMRect;
  return el as HTMLDivElement;
}

const update = (id: string, el: HTMLDivElement) =>
  new Map<string, InternalNodeUpdate>([[id, { id, nodeElement: el }]]);

describe('updateNodeInternals initial flag', () => {
  beforeEach(() => {
    // jsdom implements neither layout nor DOMMatrixReadOnly; updateNodeInternals
    // reads the viewport transform's m22 as the zoom factor. 1 = unzoomed.
    vi.stubGlobal(
      'DOMMatrixReadOnly',
      class {
        m22 = 1;
        constructor(_transform?: string) {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('flags a node`s first measurement as initial', () => {
    const { nodeLookup, parentLookup } = lookups();
    // Declared width/height do NOT seed `measured`, so this is unmeasured.
    adoptUserNodes([node('a', { width: 200, height: 200 })], nodeLookup, parentLookup);

    const { changes } = updateNodeInternals(
      update('a', makeNodeEl(200, 200)),
      nodeLookup,
      parentLookup,
      makeDom(),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 'a', type: 'dimensions', initial: true });
  });

  it('does not flag a later genuine size change', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('a', { width: 200, height: 200 })], nodeLookup, parentLookup);
    const domNode = makeDom();

    updateNodeInternals(update('a', makeNodeEl(200, 200)), nodeLookup, parentLookup, domNode);
    const { changes } = updateNodeInternals(
      update('a', makeNodeEl(300, 200)),
      nodeLookup,
      parentLookup,
      domNode,
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 'a', type: 'dimensions' });
    expect(changes[0]).not.toMatchObject({ initial: true });
  });

  it('flags the first measurement even when the node declared no size', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('b')], nodeLookup, parentLookup);

    const { changes } = updateNodeInternals(
      update('b', makeNodeEl(120, 40)),
      nodeLookup,
      parentLookup,
      makeDom(),
    );

    expect(changes[0]).toMatchObject({ initial: true });
  });

  it('force widens doUpdate but not the dimensions-change gate, so it never manufactures a spurious initial', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('a', { width: 200, height: 200 })], nodeLookup, parentLookup);
    const domNode = makeDom();

    const first = updateNodeInternals(update('a', makeNodeEl(200, 200)), nodeLookup, parentLookup, domNode);
    expect(first.changes).toHaveLength(1);
    expect(first.changes[0]).toMatchObject({ initial: true });

    // Baseline: same size, no force. handleBounds is already set and the size is
    // unchanged, so doUpdate itself is false and nothing happens at all.
    const unforced = updateNodeInternals(update('a', makeNodeEl(200, 200)), nodeLookup, parentLookup, domNode);
    expect(unforced.updatedInternals).toBe(false);
    expect(unforced.changes).toHaveLength(0);

    // Forced, same size: `force` makes doUpdate true (updatedInternals flips to true,
    // proving the forced branch actually ran), but dimensionChanged is still false, so
    // the push onto `changes` must stay gated off entirely — no change at all, and
    // certainly no spurious `initial`.
    const forcedUpdate = new Map<string, InternalNodeUpdate>([
      ['a', { id: 'a', nodeElement: makeNodeEl(200, 200), force: true }],
    ]);
    const forced = updateNodeInternals(forcedUpdate, nodeLookup, parentLookup, domNode);
    expect(forced.updatedInternals).toBe(true);
    expect(forced.changes).toHaveLength(0);
  });

  describe('hidden flip preserves `measured` across visibility toggles', () => {
    it('re-measuring at the same size after a hidden round-trip emits no change', () => {
      const { nodeLookup, parentLookup } = lookups();
      const domNode = makeDom();
      adoptUserNodes([node('a', { width: 100, height: 50 })], nodeLookup, parentLookup);

      const firstMeasure = updateNodeInternals(update('a', makeNodeEl(100, 50)), nodeLookup, parentLookup, domNode);
      expect(firstMeasure.changes).toHaveLength(1);
      expect(firstMeasure.changes[0]).toMatchObject({ initial: true });

      // Hide: this is a fresh user-node object, so checkEquality fails and a new
      // internal node is built — but adoptUserNodes must still carry `measured` over.
      adoptUserNodes([node('a', { width: 100, height: 50, hidden: true })], nodeLookup, parentLookup);
      expect(nodeLookup.get('a')?.measured).toMatchObject({ width: 100, height: 50 });

      // updateNodeInternals early-returns for hidden nodes: it clears handleBounds
      // only, `measured` must survive untouched.
      const hiddenPass = updateNodeInternals(update('a', makeNodeEl(100, 50)), nodeLookup, parentLookup, domNode);
      expect(hiddenPass.changes).toHaveLength(0);
      expect(nodeLookup.get('a')?.internals.handleBounds).toBeUndefined();
      expect(nodeLookup.get('a')?.measured).toMatchObject({ width: 100, height: 50 });

      // Unhide, re-measure at the SAME size: `measured` was never cleared, so the
      // handleBounds-less state must not be mistaken for a first measurement.
      adoptUserNodes([node('a', { width: 100, height: 50, hidden: false })], nodeLookup, parentLookup);
      const unhiddenPass = updateNodeInternals(update('a', makeNodeEl(100, 50)), nodeLookup, parentLookup, domNode);
      expect(unhiddenPass.changes).toHaveLength(0);
    });

    it('re-measuring at a different size after a hidden round-trip flags initial: false', () => {
      const { nodeLookup, parentLookup } = lookups();
      const domNode = makeDom();
      adoptUserNodes([node('c', { width: 100, height: 50 })], nodeLookup, parentLookup);

      updateNodeInternals(update('c', makeNodeEl(100, 50)), nodeLookup, parentLookup, domNode);

      adoptUserNodes([node('c', { width: 100, height: 50, hidden: true })], nodeLookup, parentLookup);
      updateNodeInternals(update('c', makeNodeEl(100, 50)), nodeLookup, parentLookup, domNode);

      adoptUserNodes([node('c', { width: 100, height: 50, hidden: false })], nodeLookup, parentLookup);
      const { changes } = updateNodeInternals(update('c', makeNodeEl(150, 50)), nodeLookup, parentLookup, domNode);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ id: 'c', type: 'dimensions', initial: false });
    });
  });

  describe('remount identity determines whether initial re-flags', () => {
    it('a node genuinely removed and later re-added as a fresh object re-flags initial: true', () => {
      const { nodeLookup, parentLookup } = lookups();
      const domNode = makeDom();

      adoptUserNodes([node('d', { width: 80, height: 80 })], nodeLookup, parentLookup);
      const firstMeasure = updateNodeInternals(update('d', makeNodeEl(80, 80)), nodeLookup, parentLookup, domNode);
      expect(firstMeasure.changes).toHaveLength(1);
      expect(firstMeasure.changes[0]).toMatchObject({ initial: true });

      // Genuine removal: the next adoptUserNodes call omits 'd' entirely, so it drops
      // out of nodeLookup (adoptUserNodes clears and rebuilds from the passed array).
      adoptUserNodes([], nodeLookup, parentLookup);
      expect(nodeLookup.has('d')).toBe(false);

      // Re-add as a genuinely fresh node object (tmpLookup no longer has an entry for
      // 'd' to carry `measured` forward from) at the SAME size as before.
      adoptUserNodes([node('d', { width: 80, height: 80 })], nodeLookup, parentLookup);
      expect(nodeLookup.get('d')?.measured).toMatchObject({ width: undefined, height: undefined });

      const remeasure = updateNodeInternals(update('d', makeNodeEl(80, 80)), nodeLookup, parentLookup, domNode);
      expect(remeasure.changes).toHaveLength(1);
      expect(remeasure.changes[0]).toMatchObject({ id: 'd', type: 'dimensions', initial: true });
    });

    it('a node re-adopted with a fresh object identity while still present does not re-flag initial', () => {
      const { nodeLookup, parentLookup } = lookups();
      const domNode = makeDom();

      adoptUserNodes([node('e', { width: 80, height: 80 })], nodeLookup, parentLookup);
      const firstMeasure = updateNodeInternals(update('e', makeNodeEl(80, 80)), nodeLookup, parentLookup, domNode);
      expect(firstMeasure.changes).toHaveLength(1);
      expect(firstMeasure.changes[0]).toMatchObject({ initial: true });

      // Re-adopt with a brand-new object for the SAME id, still present in the array
      // every pass — this is what re-rendering a parent component without unmounting
      // the flow looks like. checkEquality fails on object identity, but `measured`
      // must still carry over via tmpLookup because the id never left nodeLookup.
      adoptUserNodes([node('e', { width: 80, height: 80 })], nodeLookup, parentLookup);
      expect(nodeLookup.get('e')?.measured).toMatchObject({ width: 80, height: 80 });

      const remeasureSameSize = updateNodeInternals(
        update('e', makeNodeEl(80, 80)),
        nodeLookup,
        parentLookup,
        domNode,
      );
      expect(remeasureSameSize.changes).toHaveLength(0);

      adoptUserNodes([node('e', { width: 80, height: 80 })], nodeLookup, parentLookup);
      const remeasureDifferentSize = updateNodeInternals(
        update('e', makeNodeEl(120, 80)),
        nodeLookup,
        parentLookup,
        domNode,
      );
      expect(remeasureDifferentSize.changes).toHaveLength(1);
      expect(remeasureDifferentSize.changes[0]).toMatchObject({ id: 'e', type: 'dimensions', initial: false });
    });
  });
});

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
});

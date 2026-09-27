/**
 * Marquee (box) selection semantics:
 *  - nodes folded away inside a collapsed group are never selected;
 *  - React parity (Pane onPointerMove): selectable edges connected to the
 *    marquee-selected nodes are selected with them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { PaneComponent } from './pane.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node, Edge } from '../../types';

function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

describe('PaneComponent — marquee selection', () => {
  let store: FlowStore;
  let paneEl: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    const fixture = TestBed.createComponent(PaneComponent);
    const inst = fixture.componentInstance;
    store = TestBed.inject(FlowStore);
    setSignalInput(inst, 'selectionOnDrag', true);
    setSignalInput(inst, 'autoPanOnSelection', false);
    fixture.detectChanges();
    inst.initSelectionListener();
    paneEl = fixture.nativeElement as HTMLElement;

    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 2000, bottom: 2000, width: 2000, height: 2000 }),
    });
    store.domNode.set(container as HTMLDivElement);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setGraph(nodes: Node[], edges: Edge[]): void {
    store.setNodes(nodes);
    // Mark every node measured so getNodesInside does real geometry.
    for (const n of store.nodeLookup.values()) {
      n.measured = { width: n.width ?? 50, height: n.height ?? 50 };
      n.internals.handleBounds = { source: [], target: [] };
    }
    store.setEdges(edges);
  }

  function marquee(x1: number, y1: number, x2: number, y2: number): void {
    paneEl.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: x1, clientY: y1, bubbles: true, cancelable: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: x2, clientY: y2, bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: x2, clientY: y2, bubbles: true }));
  }

  const selectedNodeIds = () => store.nodes().filter((n) => n.selected).map((n) => n.id).sort();
  const selectedEdgeIds = () => store.edges().filter((e) => e.selected).map((e) => e.id).sort();

  it('does not select nodes hidden inside a collapsed group', () => {
    setGraph(
      [
        { id: 'g', position: { x: 0, y: 0 }, data: {}, type: 'group', width: 300, height: 300, collapsed: true } as Node,
        { id: 'child', parentId: 'g', position: { x: 10, y: 10 }, data: {} },
        { id: 'free', position: { x: 400, y: 0 }, data: {} },
      ],
      [],
    );
    expect(store.collapsedHiddenIds().has('child')).toBe(true);

    marquee(-10, -10, 1000, 1000);

    expect(selectedNodeIds()).toEqual(['free', 'g']);
  });

  it('selects selectable edges connected to the swept nodes', () => {
    setGraph(
      [
        { id: 'a', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', position: { x: 100, y: 0 }, data: {} },
        { id: 'c', position: { x: 1400, y: 0 }, data: {} },
        { id: 'far', position: { x: 1500, y: 1500 }, data: {} },
      ],
      [
        { id: 'ab', source: 'a', target: 'b' },
        { id: 'a-far', source: 'a', target: 'far' },
        { id: 'locked', source: 'a', target: 'c', selectable: false },
        { id: 'unrelated', source: 'far', target: 'far' },
      ],
    );

    marquee(-10, -10, 200, 100);

    expect(selectedNodeIds()).toEqual(['a', 'b']);
    expect(selectedEdgeIds()).toEqual(['a-far', 'ab']);
  });
});

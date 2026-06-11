import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import * as system from '@angflow/system';
import { SelectionBoxComponent } from './selection-box.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node } from '../../types';

function makeNode(id: string, x: number, y: number, selected = false): Node {
  return { id, position: { x, y }, data: {}, type: 'default', selected };
}

describe('SelectionBoxComponent — selection drag', () => {
  let store: FlowStore;
  let fixture: ComponentFixture<SelectionBoxComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SelectionBoxComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(SelectionBoxComponent);
  });

  it('fires onSelectionDrag* in order and moves both selected nodes', () => {
    // Set up two selected nodes before the component is created.
    store.setNodes([makeNode('a', 0, 0, true), makeNode('b', 100, 0, true)]);
    store.nodesSelectionActive.set(true);

    // Wire real ordered-event callbacks on the store BEFORE detectChanges so
    // that getStoreItems() (captured below) returns these exact references.
    const order: string[] = [];
    store.onSelectionDragStart = (_evt: MouseEvent, _nodes: unknown[]) => order.push('start');
    store.onSelectionDrag    = (_evt: MouseEvent, _nodes: unknown[]) => order.push('drag');
    store.onSelectionDragStop = (_evt: MouseEvent, _nodes: unknown[]) => order.push('stop');

    // Spy on XYDrag to capture the params the component actually passes.
    // Crucially: if the FP1 effect that creates XYDrag is removed, this spy
    // is never called and the assertions below will all fail.
    let capturedGetStoreItems: (() => ReturnType<typeof store.getStoreItems>) | undefined;
    let capturedUpdateParams: Parameters<ReturnType<typeof system.XYDrag>['update']>[0] | undefined;

    const realXYDrag = system.XYDrag;
    const spy = vi.spyOn(system, 'XYDrag').mockImplementation((params) => {
      capturedGetStoreItems = params.getStoreItems as typeof capturedGetStoreItems;
      const inst = realXYDrag(params);
      // Wrap update() to capture the DragUpdateParams the component passes.
      const origUpdate = inst.update.bind(inst);
      return {
        update(updateParams) {
          capturedUpdateParams = updateParams;
          origUpdate(updateParams);
        },
        destroy: inst.destroy.bind(inst),
      };
    });

    fixture.detectChanges(); // FP1 effect runs → XYDrag constructed + update()

    // ── Gate 1: FP1 effect must have run (deleting it breaks everything below) ──
    expect(spy).toHaveBeenCalledTimes(1);
    expect(capturedGetStoreItems).toBeDefined();
    expect(capturedUpdateParams).toBeDefined();

    // ── Gate 2: selection-drag path — nodeId must be absent/undefined ──
    expect(capturedUpdateParams!.nodeId).toBeUndefined();

    // ── Gate 3: getStoreItems() returns the store's live emitters by reference ──
    const items = capturedGetStoreItems!();
    expect(items.onSelectionDragStart).toBe(store.onSelectionDragStart);
    expect(items.onSelectionDrag).toBe(store.onSelectionDrag);
    expect(items.onSelectionDragStop).toBe(store.onSelectionDragStop);

    // ── Gesture simulation ──
    // Build NodeDragItem-shaped entries for both selected nodes — identical to
    // what getDragItems() would produce — then drive the gesture through the
    // CAPTURED updateNodePositions and onSelectionDrag* callbacks.
    const evt = new MouseEvent('mousemove');
    const nodeA = store.nodeLookup.get('a')!;
    const nodeB = store.nodeLookup.get('b')!;

    const dragItems = new Map([
      ['a', {
        id: 'a',
        position: { x: 30, y: 40 },
        distance: { x: 0, y: 0 },
        internals: { positionAbsolute: { x: 30, y: 40 } },
        measured: { width: nodeA.measured?.width ?? 150, height: nodeA.measured?.height ?? 40 },
      }],
      ['b', {
        id: 'b',
        position: { x: 130, y: 40 },
        distance: { x: 0, y: 0 },
        internals: { positionAbsolute: { x: 130, y: 40 } },
        measured: { width: nodeB.measured?.width ?? 150, height: nodeB.measured?.height ?? 40 },
      }],
    ]);

    // Invoke the captured store callbacks in the same order XYDrag does:
    // startDrag → updateNodes (dragging=true) → updateNodes (dragging=false) → end
    items.onSelectionDragStart!(evt, store.selectedNodes() as never);
    items.updateNodePositions(dragItems as Map<string, never>, true);
    items.onSelectionDrag!(evt, store.selectedNodes() as never);
    items.updateNodePositions(dragItems as Map<string, never>, false);
    items.onSelectionDragStop!(evt, store.selectedNodes() as never);

    // ── Assertions ──
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 30, y: 40 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 130, y: 40 });
    expect(order).toEqual(['start', 'drag', 'stop']);

    spy.mockRestore();
  });

  it('destroys the XYDrag binding when the box leaves the DOM (no leak)', () => {
    const destroy = vi.fn();
    const realXYDrag = system.XYDrag;
    const spy = vi.spyOn(system, 'XYDrag').mockImplementation((params) => {
      const inst = realXYDrag(params);
      return { update: inst.update, destroy };
    });

    store.setNodes([makeNode('a', 0, 0, true)]);
    store.nodesSelectionActive.set(true);
    fixture.detectChanges(); // box enters DOM → XYDrag created + update()
    expect(spy).toHaveBeenCalledTimes(1);

    store.nodesSelectionActive.set(false);
    fixture.detectChanges(); // box leaves DOM → effect destroys the binding
    expect(destroy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

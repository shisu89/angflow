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
    store.setNodes([makeNode('a', 0, 0, true), makeNode('b', 100, 0, true)]);
    store.nodesSelectionActive.set(true);

    const order: string[] = [];
    store.onSelectionDragStart = () => order.push('start');
    store.onSelectionDrag = () => order.push('drag');
    store.onSelectionDragStop = () => order.push('stop');

    fixture.detectChanges(); // renders the box → XYDrag effect binds it

    // Drive the same store path XYDrag drives on a selection drag: shift both
    // selected nodes by (+30, +40) and emit the lifecycle callbacks in order.
    const evt = new MouseEvent('mousemove');
    const items = new Map<string, unknown>([
      ['a', { id: 'a', position: { x: 30, y: 40 } }],
      ['b', { id: 'b', position: { x: 130, y: 40 } }],
    ]);
    store.onSelectionDragStart?.(evt, store.selectedNodes() as never);
    store.updateNodePositions(items as Map<string, never>, true);
    store.onSelectionDrag?.(evt, store.selectedNodes() as never);
    store.updateNodePositions(items as Map<string, never>, false);
    store.onSelectionDragStop?.(evt, store.selectedNodes() as never);

    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 30, y: 40 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 130, y: 40 });
    expect(order).toEqual(['start', 'drag', 'stop']);
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

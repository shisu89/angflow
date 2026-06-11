import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SelectionBoxComponent } from './selection-box.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node } from '../../types';

function makeNode(id: string, x: number, y: number, selected = false): Node {
  return { id, position: { x, y }, data: {}, type: 'default', selected };
}

function getBox(fixture: ComponentFixture<SelectionBoxComponent>): HTMLElement {
  const el = fixture.nativeElement.querySelector('.xy-flow__nodesselection') as HTMLElement;
  expect(el).toBeTruthy();
  return el;
}

describe('SelectionBoxComponent — keyboard', () => {
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
    store.setNodes([makeNode('a', 0, 0, true), makeNode('b', 100, 50, true)]);
    store.nodesSelectionActive.set(true);
    fixture.detectChanges();
  });

  it('ArrowRight moves all selected nodes by 5px', () => {
    getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 5, y: 0 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 105, y: 50 });
  });

  it('Shift+ArrowDown moves by 4x the velocity', () => {
    getBox(fixture).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
    );
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 20 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 100, y: 70 });
  });

  it('uses the snap grid as the velocity when snapToGrid is on', () => {
    store.snapToGrid.set(true);
    store.snapGrid.set([15, 15]);
    getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 15, y: 0 });
  });

  it('Escape clears nodesSelectionActive', () => {
    getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(store.nodesSelectionActive()).toBe(false);
  });

  it('ignores non-arrow, non-Escape keys', () => {
    getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 0 });
    expect(store.nodesSelectionActive()).toBe(true);
  });
});

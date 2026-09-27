/**
 * KeyHandlerDirective scoping + action semantics.
 *
 * The directive listens on `document`, so every `<ng-flow>` on a page sees
 * every key press. These tests pin that delete / select-all / Escape / arrow
 * moves only act on the flow the event belongs to, and the per-action rules
 * (draggable, selectable, collapsed, deletable, cascade, onBeforeDelete).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component, inject, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { KeyHandlerDirective } from './key-handler.directive';
import { FlowStore } from '../services/flow-store.service';
import type { Node, Edge } from '../types';

@Component({
  selector: 'test-flow',
  standalone: true,
  imports: [KeyHandlerDirective],
  providers: [FlowStore],
  template: `<div ngFlowKeyHandler class="root"><button class="inside">in</button></div>`,
})
class FlowHostComponent {
  readonly store = inject(FlowStore);
}

@Component({
  standalone: true,
  imports: [FlowHostComponent],
  template: `<test-flow /><test-flow /><button class="outside">out</button>`,
})
class PageComponent {}

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, ...overrides };
}
function makeEdge(id: string, source: string, target: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source, target, ...overrides };
}

function keydown(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function pointerdown(target: EventTarget): void {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

describe('KeyHandlerDirective — scoping and actions', () => {
  let fixture: ComponentFixture<PageComponent>;
  let storeA: FlowStore;
  let storeB: FlowStore;
  let insideA: HTMLElement;
  let insideB: HTMLElement;
  let outside: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PageComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    const flows = fixture.debugElement.queryAll(By.directive(FlowHostComponent));
    storeA = (flows[0].componentInstance as FlowHostComponent).store;
    storeB = (flows[1].componentInstance as FlowHostComponent).store;
    insideA = flows[0].nativeElement.querySelector('.inside');
    insideB = flows[1].nativeElement.querySelector('.inside');
    outside = fixture.nativeElement.querySelector('.outside');

    for (const store of [storeA, storeB]) {
      store.setNodes([makeNode('n1', { selected: true }), makeNode('n2')]);
      store.setEdges([makeEdge('e1', 'n1', 'n2')]);
    }
  });

  afterEach(() => fixture.destroy());

  // ── scoping ────────────────────────────────────────────────────────────

  it('Delete only affects the flow the key event came from', () => {
    keydown(insideA, { key: 'Delete' });
    expect(storeA.nodes().map((n) => n.id)).toEqual(['n2']);
    expect(storeA.edges()).toEqual([]);
    expect(storeB.nodes().map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(storeB.edges()).toHaveLength(1);
  });

  it('Ctrl+A and Escape only affect the focused flow', () => {
    const selectAll = keydown(insideB, { key: 'a', ctrlKey: true });
    expect(selectAll.defaultPrevented).toBe(true);
    expect(storeB.selectedNodes().map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(storeA.selectedNodes().map((n) => n.id)).toEqual(['n1']);

    keydown(insideA, { key: 'Escape' });
    expect(storeA.selectedNodes()).toEqual([]);
    expect(storeB.selectedNodes()).toHaveLength(2);
  });

  it('ignores action keys whose target is outside every flow', () => {
    const arrow = keydown(outside, { key: 'ArrowRight' });
    const selectAll = keydown(outside, { key: 'a', metaKey: true });
    keydown(outside, { key: 'Delete' });
    keydown(outside, { key: 'Escape' });

    expect(arrow.defaultPrevented).toBe(false); // page scroll keeps working
    expect(selectAll.defaultPrevented).toBe(false); // native select-all keeps working
    for (const store of [storeA, storeB]) {
      expect(store.nodeLookup.get('n1')!.position).toEqual({ x: 0, y: 0 });
      expect(store.nodes()).toHaveLength(2);
      expect(store.selectedNodes().map((n) => n.id)).toEqual(['n1']);
    }
  });

  it('routes body-targeted keys to the flow last pointer-downed, and none after clicking outside', () => {
    pointerdown(insideB);
    keydown(document.body, { key: 'ArrowDown' });
    expect(storeB.nodeLookup.get('n1')!.position).toEqual({ x: 0, y: 5 });
    expect(storeA.nodeLookup.get('n1')!.position).toEqual({ x: 0, y: 0 });

    pointerdown(outside);
    const ev = keydown(document.body, { key: 'ArrowDown' });
    expect(ev.defaultPrevented).toBe(false);
    expect(storeB.nodeLookup.get('n1')!.position).toEqual({ x: 0, y: 5 });
  });

  it('still tracks modifier keys page-wide', () => {
    keydown(outside, { key: 'Shift' });
    expect(storeA.selectionKeyActive()).toBe(true);
    expect(storeB.selectionKeyActive()).toBe(true);
  });

  // ── arrow keys ─────────────────────────────────────────────────────────

  it('arrow keys move selected nodes 5px, and Shift multiplies by 4', () => {
    const ev = keydown(insideA, { key: 'ArrowRight' });
    expect(ev.defaultPrevented).toBe(true);
    expect(storeA.nodeLookup.get('n1')!.position).toEqual({ x: 5, y: 0 });

    keydown(insideA, { key: 'ArrowUp', shiftKey: true });
    expect(storeA.nodeLookup.get('n1')!.position).toEqual({ x: 5, y: -20 });
  });

  it('arrow keys skip nodes with draggable: false', () => {
    storeA.setNodes([
      makeNode('fixed', { selected: true, draggable: false }),
      makeNode('free', { selected: true }),
    ]);
    keydown(insideA, { key: 'ArrowLeft' });
    expect(storeA.nodeLookup.get('fixed')!.position).toEqual({ x: 0, y: 0 });
    expect(storeA.nodeLookup.get('free')!.position).toEqual({ x: -5, y: 0 });
  });

  it('arrow keys respect flow-level nodesDraggable=false unless a node opts in', () => {
    storeA.nodesDraggable.set(false);
    storeA.setNodes([
      makeNode('default', { selected: true }),
      makeNode('optIn', { selected: true, draggable: true }),
    ]);
    keydown(insideA, { key: 'ArrowDown' });
    expect(storeA.nodeLookup.get('default')!.position).toEqual({ x: 0, y: 0 });
    expect(storeA.nodeLookup.get('optIn')!.position).toEqual({ x: 0, y: 5 });
  });

  // ── select all ─────────────────────────────────────────────────────────

  it('select-all respects elementsSelectable and per-element selectable', () => {
    storeA.setNodes([makeNode('n1'), makeNode('n2'), makeNode('n3', { selectable: true })]);
    storeA.setEdges([makeEdge('e1', 'n1', 'n2')]);
    storeA.elementsSelectable.set(false);

    keydown(insideA, { key: 'a', ctrlKey: true });

    expect(storeA.selectedNodes().map((n) => n.id)).toEqual(['n3']);
    expect(storeA.selectedEdges()).toEqual([]);
  });

  it('select-all skips nodes hidden inside a collapsed group', () => {
    storeA.setNodes([
      makeNode('g', { type: 'group', collapsed: true } as Partial<Node>),
      makeNode('child', { parentId: 'g' }),
      makeNode('loose'),
    ]);

    keydown(insideA, { key: 'a', ctrlKey: true });

    expect(storeA.selectedNodes().map((n) => n.id).sort()).toEqual(['g', 'loose']);
  });

  // ── delete ─────────────────────────────────────────────────────────────

  it('Delete cascades to descendants and their edges, keeping deletable: false', () => {
    storeA.setNodes([
      makeNode('g', { type: 'group', selected: true }),
      makeNode('child', { parentId: 'g' }),
      makeNode('pinned', { parentId: 'g', deletable: false }),
      makeNode('other'),
    ]);
    storeA.setEdges([makeEdge('e1', 'child', 'other'), makeEdge('e2', 'other', 'other')]);

    keydown(insideA, { key: 'Backspace' });

    expect(storeA.nodes().map((n) => n.id).sort()).toEqual(['other', 'pinned']);
    expect(storeA.edges().map((e) => e.id)).toEqual(['e2']);
  });

  it('Delete applies a reduced { nodes, edges } set returned by onBeforeDelete', () => {
    storeA.onBeforeDelete = ({ edges }) => ({ nodes: [], edges });

    keydown(insideA, { key: 'Delete' });

    expect(storeA.nodes().map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(storeA.edges()).toEqual([]);
  });

  it('Delete is vetoed when onBeforeDelete returns false', () => {
    storeA.onBeforeDelete = () => false;
    keydown(insideA, { key: 'Delete' });
    expect(storeA.nodes()).toHaveLength(2);
    expect(storeA.edges()).toHaveLength(1);
  });
});

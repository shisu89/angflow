/**
 * KeyHandlerDirective select-all tests.
 *
 * Asserts that Ctrl+A (handleSelectAll) respects per-element `selectable`
 * flags and does not add nodes or edges where `selectable === false`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { KeyHandlerDirective } from './key-handler.directive';
import { FlowStore } from '../services/flow-store.service';
import type { Node, Edge } from '../types';

@Component({
  standalone: true,
  imports: [KeyHandlerDirective],
  template: `<div ngFlowKeyHandler></div>`,
})
class HostComponent {}

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, ...overrides };
}
function makeEdge(id: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source: 'n1', target: 'n2', ...overrides };
}

describe('KeyHandlerDirective select-all', () => {
  let store: FlowStore;
  let directive: KeyHandlerDirective;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    directive = fixture.debugElement
      .query(By.directive(KeyHandlerDirective))
      .injector.get(KeyHandlerDirective);
  });

  it('Ctrl+A selects all nodes and edges when none have selectable: false (control)', () => {
    store.setNodes([makeNode('n1'), makeNode('n2')]);
    store.setEdges([makeEdge('e1'), makeEdge('e2')]);

    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

    expect(store.selectedNodes().map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(store.selectedEdges().map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('Ctrl+A skips nodes and edges with selectable: false', () => {
    store.setNodes([makeNode('n1'), makeNode('n2', { selectable: false })]);
    store.setEdges([makeEdge('e1'), makeEdge('e2', { selectable: false })]);

    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

    expect(store.selectedNodes().map((n) => n.id)).toEqual(['n1']);
    expect(store.selectedEdges().map((e) => e.id)).toEqual(['e1']);
  });

  it('resets stuck modifier keys on window blur', () => {
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Shift' }));
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta' }));
    expect(store.selectionKeyActive()).toBe(true);
    expect(store.multiSelectionActive()).toBe(true);

    // Window blur (e.g. Cmd+Tab) never delivers keyup — the reset must clear both.
    directive.onWindowBlur();

    expect(store.selectionKeyActive()).toBe(false);
    expect(store.multiSelectionActive()).toBe(false);
  });
});

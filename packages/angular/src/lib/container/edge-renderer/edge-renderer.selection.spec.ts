/**
 * Edge renderer per-element selectable guard tests.
 *
 * Asserts that click / Enter keydown / focus only select edges when
 * `edge.selectable !== false`, while still emitting outputs (e.g. edgeClick)
 * regardless of the guard.  Methods are called directly on the component
 * instance — same idiom as the existing edge-renderer specs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Edge } from '../../types';

function makeEdge(id: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source: 'a', target: 'b', ...overrides };
}

describe('EdgeRendererComponent selection guards', () => {
  let store: FlowStore;
  let component: EdgeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(EdgeRendererComponent);
    component = fixture.componentInstance;
  });

  it('click selects a selectable edge (control)', () => {
    store.setEdges([makeEdge('e1')]);
    component.onEdgeEvent(new MouseEvent('click'), store.edges()[0], 'click');
    expect(store.selectedEdges().map((e) => e.id)).toEqual(['e1']);
  });

  it('click does not select an edge with selectable: false (but still emits edgeClick)', () => {
    store.setEdges([makeEdge('e1', { selectable: false })]);
    let clicked = false;
    component.edgeClick.subscribe(() => (clicked = true));

    component.onEdgeEvent(new MouseEvent('click'), store.edges()[0], 'click');

    expect(store.selectedEdges()).toHaveLength(0);
    expect(clicked).toBe(true);
  });

  it('Enter keydown does not select an edge with selectable: false', () => {
    store.setEdges([makeEdge('e1', { selectable: false })]);
    component.onEdgeKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), store.edges()[0]);
    expect(store.selectedEdges()).toHaveLength(0);
  });

  it('focus does not select an edge with selectable: false', () => {
    store.setEdges([makeEdge('e1', { selectable: false })]);
    component.onEdgeFocus(store.edges()[0]);
    expect(store.selectedEdges()).toHaveLength(0);
  });
});

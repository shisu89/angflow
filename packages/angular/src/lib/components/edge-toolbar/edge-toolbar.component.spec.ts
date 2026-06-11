import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { EdgeToolbarComponent } from './edge-toolbar.component';

describe('EdgeToolbarComponent', () => {
  let store: FlowStore;
  let component: EdgeToolbarComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeToolbarComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(EdgeToolbarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('edgeId', 'e1');
    fixture.componentRef.setInput('x', 0);
    fixture.componentRef.setInput('y', 0);
  });

  it('shouldShow follows the owning edge selection via edgeLookup', () => {
    store.setEdges([{ id: 'e1', source: 'a', target: 'b' }]);
    expect(component.shouldShow()).toBe(false);

    store.setEdges([{ id: 'e1', source: 'a', target: 'b', selected: true }]);
    expect(component.shouldShow()).toBe(true);
  });

  it('zIndex is the edge zIndex + 1, without an any-cast', () => {
    store.setEdges([{ id: 'e1', source: 'a', target: 'b', zIndex: 7 }]);
    expect(component.zIndex()).toBe(8);
  });

  it('zIndex defaults to 1 when the edge has no zIndex', () => {
    store.setEdges([{ id: 'e1', source: 'a', target: 'b' }]);
    expect(component.zIndex()).toBe(1);
  });

  it('isVisible input overrides edge selection', () => {
    store.setEdges([{ id: 'e1', source: 'a', target: 'b', selected: true }]);
    const fixture = TestBed.createComponent(EdgeToolbarComponent);
    const c = fixture.componentInstance;
    fixture.componentRef.setInput('edgeId', 'e1');
    fixture.componentRef.setInput('x', 0);
    fixture.componentRef.setInput('y', 0);
    fixture.componentRef.setInput('isVisible', false);
    expect(c.shouldShow()).toBe(false);
  });

  it('exposes a resolvedEdge computed sourced from edgeLookup', () => {
    store.setEdges([{ id: 'e1', source: 'a', target: 'b', zIndex: 3 }]);
    expect(component.resolvedEdge()?.zIndex).toBe(3);
  });
});

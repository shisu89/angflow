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

  function setNodes(): void {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 100 } },
    ]);
  }

  it('zIndex equals the edge zIndex (via getElevatedEdgeZIndex) when unselected', () => {
    setNodes();
    store.setEdges([{ id: 'e1', source: 'a', target: 'b', zIndex: 7 }]);
    expect(component.zIndex()).toBe(7);
  });

  it('zIndex is elevated by 1000 when the edge is selected', () => {
    setNodes();
    store.setEdges([{ id: 'e1', source: 'a', target: 'b', zIndex: 7, selected: true }]);
    expect(component.zIndex()).toBe(1007);
  });

  it('zIndex is 0 when the edge has no zIndex', () => {
    setNodes();
    store.setEdges([{ id: 'e1', source: 'a', target: 'b' }]);
    expect(component.zIndex()).toBe(0);
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

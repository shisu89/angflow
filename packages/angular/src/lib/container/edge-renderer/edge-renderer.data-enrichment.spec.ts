/**
 * Edge renderer handle-data enrichment tests.
 *
 * Asserts that `getEdgeInputs(edge)` returns an inputs object where
 * `sourceHandle.data` and `targetHandle.data` are populated from
 * FlowStore's handle data registry. We call the method directly rather
 * than rendering the full flow because JIT doesn't compile signal-input
 * template bindings under Vitest.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { Position, type Handle } from '@angflow/system';
import type { Node, Edge } from '../../types';

describe('edge renderer enriches handles with registry data', () => {
  let store: FlowStore;
  let renderer: EdgeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(EdgeRendererComponent);
    renderer = fixture.componentInstance;
  });

  function seedFlow(): { edge: Edge } {
    const nodes: Node[] = [
      { id: 'a', type: 'default', data: {}, position: { x: 0, y: 0 }, width: 100, height: 50 },
      { id: 'b', type: 'default', data: {}, position: { x: 300, y: 0 }, width: 100, height: 50 },
    ];
    const edge: Edge = { id: 'e1', source: 'a', target: 'b', sourceHandle: 'sh', targetHandle: 'th' };
    store.setNodes(nodes);
    store.setEdges([edge]);

    const nodeA = store.nodeLookup.get('a')!;
    nodeA.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'a', x: 0, y: 0, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    const nodeB = store.nodeLookup.get('b')!;
    nodeB.internals.handleBounds = {
      source: null,
      target: [{ id: 'th', nodeId: 'b', x: 0, y: 0, position: Position.Left, type: 'target', width: 6, height: 6 }],
    };
    return { edge };
  }

  it('enriches sourceHandle with registry data', () => {
    const { edge } = seedFlow();
    store.registerHandleData('a', 'sh', 'source', 'string');

    const inputs = renderer.getEdgeInputs(edge);
    expect((inputs['sourceHandle'] as Handle | null)?.data).toBe('string');
  });

  it('enriches targetHandle with registry data', () => {
    const { edge } = seedFlow();
    store.registerHandleData('b', 'th', 'target', 'number');

    const inputs = renderer.getEdgeInputs(edge);
    expect((inputs['targetHandle'] as Handle | null)?.data).toBe('number');
  });

  it('returns null handles when nodes are missing their handle bounds', () => {
    const edge: Edge = { id: 'e1', source: 'a', target: 'b' };
    store.setNodes([
      { id: 'a', type: 'default', data: {}, position: { x: 0, y: 0 }, width: 100, height: 50 },
      { id: 'b', type: 'default', data: {}, position: { x: 300, y: 0 }, width: 100, height: 50 },
    ]);
    store.setEdges([edge]);

    const inputs = renderer.getEdgeInputs(edge);
    expect(inputs['sourceHandle']).toBeNull();
    expect(inputs['targetHandle']).toBeNull();
  });
});

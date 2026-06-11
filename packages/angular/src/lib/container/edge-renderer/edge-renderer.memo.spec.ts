/**
 * Edge renderer memoization tests.
 *
 * The template evaluates getEdgeInputs(edge) up to 3x per edge per CD pass
 * (main SVG @let, custom-edge overlay @let, label @let) and getEdgePath(ei)
 * twice (interaction + visible). These tests pin that repeated calls within
 * an unchanged frame are identity-stable cache hits with exactly one path
 * computation, and that every input affecting geometry or enrichment still
 * invalidates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import * as system from '@angflow/system';
import { Position, type Handle } from '@angflow/system';
import { EdgeRendererComponent, computeEdgeGeometryKey } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node, Edge, InternalNode } from '../../types';

vi.mock('@angflow/system', { spy: true });

describe('edge renderer memoizes inputs and path per edge', () => {
  let store: FlowStore;
  let renderer: EdgeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    renderer = TestBed.createComponent(EdgeRendererComponent).componentInstance;
  });

  function seedFlow(): { edge: Edge } {
    const nodes: Node[] = [
      { id: 'a', type: 'default', data: {}, position: { x: 0, y: 0 }, width: 100, height: 50 },
      { id: 'b', type: 'default', data: {}, position: { x: 300, y: 0 }, width: 100, height: 50 },
    ];
    const edge: Edge = { id: 'e1', source: 'a', target: 'b', sourceHandle: 'sh', targetHandle: 'th' };
    store.setNodes(nodes);
    store.setEdges([edge]);
    store.nodeLookup.get('a')!.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'a', x: 0, y: 0, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    store.nodeLookup.get('b')!.internals.handleBounds = {
      source: null,
      target: [{ id: 'th', nodeId: 'b', x: 0, y: 0, position: Position.Left, type: 'target', width: 6, height: 6 }],
    };
    return { edge };
  }

  it('PERF: one template pass computes the path exactly once per edge', () => {
    const { edge } = seedFlow();
    const bezier = vi.mocked(system.getBezierPath);
    bezier.mockClear();

    const ei1 = renderer.getEdgeInputs(edge);
    const ei2 = renderer.getEdgeInputs(edge);
    const ei3 = renderer.getEdgeInputs(edge);
    renderer.getEdgePath(ei1);
    renderer.getEdgePath(ei1);

    expect(ei2).toBe(ei1);
    expect(ei3).toBe(ei1);
    expect(bezier).toHaveBeenCalledTimes(1);

    renderer.getEdgePath(renderer.getEdgeInputs(edge));
    expect(bezier).toHaveBeenCalledTimes(1);
  });

  it('REGRESSION: moving the source node invalidates and recomputes once', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    const bezier = vi.mocked(system.getBezierPath);
    bezier.mockClear();

    store.triggerNodeChanges([
      { id: 'a', type: 'position', position: { x: 40, y: 80 }, dragging: true },
    ] as never);

    const after = renderer.getEdgeInputs(edge);
    expect(after).not.toBe(before);
    expect(after['sourceX']).not.toBe(before['sourceX']);
    renderer.getEdgePath(after);
    renderer.getEdgePath(after);
    expect(bezier).toHaveBeenCalledTimes(1);
  });

  it('REGRESSION: registering handle data after a cached read invalidates enrichment', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    expect((before['sourceHandle'] as Handle | null)?.data).toBeUndefined();

    store.registerHandleData('a', 'sh', 'source', 'payload');

    const after = renderer.getEdgeInputs(edge);
    expect(after).not.toBe(before);
    expect((after['sourceHandle'] as Handle | null)?.data).toBe('payload');
  });

  it('REGRESSION: a new edge object (prop change) invalidates', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    const after = renderer.getEdgeInputs({ ...edge, selected: true });
    expect(after).not.toBe(before);
    expect(after['selected']).toBe(true);
  });

  it('REGRESSION: replacing handleBounds (remeasure) invalidates', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    store.nodeLookup.get('a')!.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'a', x: 10, y: 10, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    const after = renderer.getEdgeInputs(edge);
    expect(after).not.toBe(before);
  });
});

describe('computeEdgeGeometryKey (pure)', () => {
  const node = (x: number, y: number, w = 100, h = 50) =>
    ({
      id: 'n',
      position: { x, y },
      measured: { width: w, height: h },
      internals: { positionAbsolute: { x, y }, z: 0 },
    }) as unknown as InternalNode;
  const edge: Edge = { id: 'e', source: 'a', target: 'b' };

  it('changes when position, size, or edge mode changes; stable otherwise', () => {
    const base = computeEdgeGeometryKey(edge, node(0, 0), node(300, 0), 'handles');
    expect(computeEdgeGeometryKey(edge, node(0, 0), node(300, 0), 'handles')).toBe(base);
    expect(computeEdgeGeometryKey(edge, node(5, 0), node(300, 0), 'handles')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, node(0, 0), node(300, 9), 'handles')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, node(0, 0, 120), node(300, 0), 'handles')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, node(0, 0), node(300, 0), 'floating')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, undefined, node(300, 0), 'handles')).not.toBe(base);
  });
});

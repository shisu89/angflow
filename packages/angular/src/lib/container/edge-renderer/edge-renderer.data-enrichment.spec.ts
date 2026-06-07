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

describe('floating endpoints', () => {
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

  function seedNodes() {
    // Source node at (0,0) sized 100x50; target node at (300, 200) sized 100x50.
    const srcHandle: Handle = {
      id: 'auto', nodeId: 'A', type: 'source', position: Position.Right,
      x: 50, y: 25, width: 0, height: 0, floating: true,
    };
    const tgtHandle: Handle = {
      id: 'auto', nodeId: 'B', type: 'target', position: Position.Left,
      x: 50, y: 25, width: 0, height: 0, floating: true,
    };

    // Directly populate nodeLookup to bypass DOM measurement.
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 0, y: 0 },
        handleBounds: { source: [srcHandle], target: null },
        z: 0,
      },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 300, y: 200 },
        handleBounds: { source: null, target: [tgtHandle] },
        z: 0,
      },
    } as any);
  }

  it('computes both endpoints as ray-rect intersections when both handles are floating', () => {
    seedNodes();
    const edge: Edge = { id: 'e', source: 'A', target: 'B', sourceHandle: 'auto', targetHandle: 'auto' };
    const inputs = component.getEdgeInputs(edge);

    // Source node center = (50, 25); target node center = (350, 225).
    // Both endpoints should lie on their respective node's border, on the
    // center-to-center ray.
    // Source node bounds: x in [0,100], y in [0,50].
    // Ray from (50,25) toward (350,225): dx=300, dy=200. halfW=50, halfH=25.
    //   tX = 50/300 ≈ 0.167, tY = 25/200 = 0.125. Min = tY.
    //   Intersection = (50 + 0.125*300, 25 + 0.125*200) = (87.5, 50).
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
    // Target node bounds: x in [300,400], y in [200,250].
    // Ray from (350,225) toward (50,25): dx=-300, dy=-200. halfW=50, halfH=25.
    //   tY = 25/200 = 0.125. Intersection = (350 - 0.125*300, 225 - 0.125*200) = (312.5, 200).
    expect(inputs['targetX']).toBeCloseTo(312.5, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2);
  });

  it('falls back to fixed-handle positions for self-loops even when handles are floating', () => {
    seedNodes();
    // Self-loop: source === target.
    const edge: Edge = { id: 'self', source: 'A', target: 'A', sourceHandle: 'auto', targetHandle: 'auto' };
    const inputs = component.getEdgeInputs(edge);
    // Source handle DOM center: sourcePos (0,0) + handle.x (50) + width/2 (0) = (50, 25).
    expect(inputs['sourceX']).toBeCloseTo(50, 2);
    expect(inputs['sourceY']).toBeCloseTo(25, 2);
  });

  it('uses fixed-handle position on the fixed side and ray-rect on the floating side', () => {
    // Set A's source handle as fixed (no floating flag).
    const srcHandle: Handle = {
      id: 'fixed', nodeId: 'A', type: 'source', position: Position.Right,
      x: 90, y: 20, width: 10, height: 10, // fixed position on right side
    };
    const tgtHandle: Handle = {
      id: 'auto', nodeId: 'B', type: 'target', position: Position.Left,
      x: 50, y: 25, width: 0, height: 0, floating: true,
    };
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 0, y: 0 },
        handleBounds: { source: [srcHandle], target: null },
        z: 0,
      },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 300, y: 200 },
        handleBounds: { source: null, target: [tgtHandle] },
        z: 0,
      },
    } as any);

    const edge: Edge = { id: 'e', source: 'A', target: 'B', sourceHandle: 'fixed', targetHandle: 'auto' };
    const inputs = component.getEdgeInputs(edge);

    // Source: fixed handle center = (0 + 90 + 5, 0 + 20 + 5) = (95, 25).
    expect(inputs['sourceX']).toBeCloseTo(95, 2);
    expect(inputs['sourceY']).toBeCloseTo(25, 2);
    // Target: ray-rect intersection with reference = source fixed handle position.
    //   Ray from target center (350,225) toward (95,25): dx=-255, dy=-200.
    //   halfW=50, halfH=25. tX=50/255 ≈ 0.196, tY=25/200=0.125. Min=tY.
    //   Intersection = (350 - 0.125*255, 225 - 0.125*200) = (318.125, 200).
    expect(inputs['targetX']).toBeCloseTo(318.125, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2);
  });
});

describe('edgeMode="floating"', () => {
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

  /** Two handleless nodes: A at (0,0) 100x50, B at (300,200) 100x50. */
  function seedHandleless() {
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: { positionAbsolute: { x: 0, y: 0 }, handleBounds: null, z: 0 },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 },
      measured: { width: 100, height: 50 },
      internals: { positionAbsolute: { x: 300, y: 200 }, handleBounds: null, z: 0 },
    } as any);
  }

  it('computes ray-rect endpoints for nodes with zero handles', () => {
    store.edgeMode.set('floating');
    seedHandleless();
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B' });
    // Same geometry as the floating-handle test above: centers (50,25)→(350,225).
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
    expect(inputs['targetX']).toBeCloseTo(312.5, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2);
    // inferSide: dx=37.5, dy=25 → |dx| > |dy| → Right (intersection on the right-bottom border region)
    expect(inputs['sourcePosition']).toBe(Position.Right);
    // inferSide on target: dx=-37.5, dy=-25 → |dx| > |dy| → Left
    expect(inputs['targetPosition']).toBe(Position.Left);
  });

  it('default mode keeps the fixed bottom-center/top-center fallback', () => {
    seedHandleless(); // edgeMode left at default 'handles'
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B' });
    expect(inputs['sourceX']).toBeCloseTo(50, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2); // bottom of A
    expect(inputs['targetX']).toBeCloseTo(350, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2); // top of B
  });

  it('ignores declared non-floating handles when mode is floating', () => {
    store.edgeMode.set('floating');
    seedHandleless();
    const nodeA = store.nodeLookup.get('A')! as any;
    nodeA.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'A', x: 0, y: 0, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B', sourceHandle: 'sh' });
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2); // ray-rect, not the handle at (3,3)
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
  });

  it('uses width/height fallbacks for unmeasured (first-frame) nodes', () => {
    store.edgeMode.set('floating');
    // Same rects as seedHandleless, but via `width`/`height` with no `measured`.
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 }, width: 100, height: 50,
      internals: { positionAbsolute: { x: 0, y: 0 }, handleBounds: null, z: 0 },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 }, width: 100, height: 50,
      internals: { positionAbsolute: { x: 300, y: 200 }, handleBounds: null, z: 0 },
    } as any);
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B' });
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
  });

  it('self-loops fall back to fixed endpoints even in floating mode', () => {
    store.edgeMode.set('floating');
    seedHandleless();
    const inputs = component.getEdgeInputs({ id: 'self', source: 'A', target: 'A' });
    expect(inputs['sourceX']).toBeCloseTo(50, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2); // bottom-center fallback
    expect(inputs['targetX']).toBeCloseTo(50, 2);
    expect(inputs['targetY']).toBeCloseTo(0, 2);  // top-center fallback
  });
});

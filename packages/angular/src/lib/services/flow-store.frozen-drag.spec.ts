import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
import type { Node } from '../types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function dragItem(x: number, y: number) {
  return {
    position: { x, y },
    internals: { positionAbsolute: { x, y } },
    measured: { width: 150, height: 40 },
  };
}

describe('FlowStore drag fast path — user node objects are never mutated', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('drags a deep-frozen node without throwing and leaves the original untouched', () => {
    const original: Node = deepFreeze({ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } });
    const other: Node = deepFreeze({ id: 'b', position: { x: 300, y: 0 }, data: { label: 'B' } });
    const input = deepFreeze([original, other]);
    store.setNodes(input as Node[]);

    expect(() => store.updateNodePositions(new Map([['a', dragItem(40, 50)]]), true)).not.toThrow();
    expect(() => store.updateNodePositions(new Map([['a', dragItem(60, 70)]]), false)).not.toThrow();

    // Original objects untouched.
    expect(original.position).toEqual({ x: 0, y: 0 });
    expect(original.dragging).toBeUndefined();
    expect(input[0]).toBe(original);

    // Store reflects the move through fresh objects.
    const moved = store.nodes().find((n) => n.id === 'a')!;
    expect(moved).not.toBe(original);
    expect(moved.position).toEqual({ x: 60, y: 70 });
    expect(moved.dragging).toBe(false);
    expect(moved.data).toBe(original.data);
    expect(store.nodes()).not.toBe(input);
    // Unmoved nodes keep identity.
    expect(store.nodes()[1]).toBe(other);

    const internal = store.nodeLookup.get('a')!;
    expect(internal.internals.userNode).toBe(moved);
    expect(internal.internals.positionAbsolute).toEqual({ x: 60, y: 70 });
    expect(service.getNode('a')).toBe(moved);
  });

  it('drags a frozen child of a frozen parent (recompute path) without throwing', () => {
    const parent: Node = deepFreeze({ id: 'p', position: { x: 100, y: 100 }, data: {} });
    const child: Node = deepFreeze({ id: 'c', parentId: 'p', position: { x: 10, y: 10 }, data: {} });
    store.setNodes(deepFreeze([parent, child]) as Node[]);

    expect(() => store.updateNodePositions(new Map([['c', dragItem(20, 30)]]), true)).not.toThrow();
    expect(child.position).toEqual({ x: 10, y: 10 });
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 120, y: 130 });

    expect(() => store.updateNodePositions(new Map([['p', dragItem(200, 200)]]), true)).not.toThrow();
    expect(parent.position).toEqual({ x: 100, y: 100 });
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 220, y: 230 });
  });

  it('selectInternalNode notifies consumers on every drag frame', () => {
    store.setNodes([{ id: 'a', position: { x: 0, y: 0 }, data: {} }]);
    const sig = service.selectInternalNode('a');
    const first = sig();
    expect(first?.internals.positionAbsolute).toEqual({ x: 0, y: 0 });

    store.updateNodePositions(new Map([['a', dragItem(10, 20)]]), true);
    const second = sig();
    expect(second).not.toBe(first);
    expect(second?.internals.positionAbsolute).toEqual({ x: 10, y: 20 });
    expect(second?.dragging).toBe(true);

    store.updateNodePositions(new Map([['a', dragItem(30, 40)]]), true);
    const third = sig();
    expect(third).not.toBe(second);
    expect(third?.position).toEqual({ x: 30, y: 40 });
  });
});

/**
 * Edge renderer reconnect — isNodeVisible wiring at the XYHandle.onPointerDown
 * call site inside handleEdgeReconnect.
 *
 * Strategy: vi.mock '@angflow/system' with { spy: true } keeps all real
 * implementations but makes every method spyable. We call
 * onReconnectSourceMouseDown / onReconnectTargetMouseDown directly on the
 * component instance (same idiom as edge-renderer.selection.spec.ts), mock
 * XYHandle.onPointerDown to capture params without running DOM logic, then
 * assert:
 *   1. isNodeVisible is a function (the wiring exists at this call site too).
 *   2. The predicate returns false for a collapse-hidden child.
 *   3. The predicate returns true for visible nodes.
 *   4. The predicate reflects signal reactivity after group expansion.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import * as system from '@angflow/system';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Edge } from '../../types';

// Wrap @angflow/system with spies (real implementations kept).
vi.mock('@angflow/system', { spy: true });

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return { id: 'e1', source: 'src', target: 'tgt', ...overrides };
}

describe('EdgeRendererComponent reconnect — isNodeVisible wiring', () => {
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

  function seedCollapsedGroup(): void {
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
      { id: 'visible', position: { x: 200, y: 200 }, data: {} },
    ] as any[]);
  }

  it('onReconnectSourceMouseDown passes isNodeVisible that excludes collapse-hidden children', () => {
    seedCollapsedGroup();
    const edge = makeEdge();
    store.setEdges([edge]);

    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      // button: 0 is required — the method guards on event.button !== 0.
      component.onReconnectSourceMouseDown(
        new MouseEvent('mousedown', { button: 0, bubbles: true }),
        store.edges()[0],
      );

      expect(spy).toHaveBeenCalledOnce();
      const params = spy.mock.calls[0][1] as Record<string, unknown>;

      expect(typeof params['isNodeVisible']).toBe('function');
      const isNodeVisible = params['isNodeVisible'] as (n: { id: string }) => boolean;

      // Collapse-hidden child must be excluded.
      expect(isNodeVisible({ id: 'child' })).toBe(false);
      // Visible nodes must be included.
      expect(isNodeVisible({ id: 'group' })).toBe(true);
      expect(isNodeVisible({ id: 'visible' })).toBe(true);
      expect(isNodeVisible({ id: 'unknown' })).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('onReconnectTargetMouseDown passes isNodeVisible that excludes collapse-hidden children', () => {
    seedCollapsedGroup();
    const edge = makeEdge();
    store.setEdges([edge]);

    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      component.onReconnectTargetMouseDown(
        new MouseEvent('mousedown', { button: 0, bubbles: true }),
        store.edges()[0],
      );

      expect(spy).toHaveBeenCalledOnce();
      const params = spy.mock.calls[0][1] as Record<string, unknown>;

      expect(typeof params['isNodeVisible']).toBe('function');
      const isNodeVisible = params['isNodeVisible'] as (n: { id: string }) => boolean;

      expect(isNodeVisible({ id: 'child' })).toBe(false);
      expect(isNodeVisible({ id: 'group' })).toBe(true);
      expect(isNodeVisible({ id: 'visible' })).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('isNodeVisible predicate reflects signal reactivity: expanding a group makes its child visible', () => {
    // Start collapsed so child is hidden.
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
    ] as any[]);
    const edge = makeEdge();
    store.setEdges([edge]);

    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      component.onReconnectSourceMouseDown(
        new MouseEvent('mousedown', { button: 0, bubbles: true }),
        store.edges()[0],
      );

      const params = spy.mock.calls[0][1] as Record<string, unknown>;
      const isNodeVisible = params['isNodeVisible'] as (n: { id: string }) => boolean;

      // Child hidden while group is collapsed.
      expect(isNodeVisible({ id: 'child' })).toBe(false);

      // Expand the group — predicate closure reads the live store signal.
      store.setNodes([
        { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: false },
        { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
      ] as any[]);

      // Same captured predicate now returns true.
      expect(isNodeVisible({ id: 'child' })).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

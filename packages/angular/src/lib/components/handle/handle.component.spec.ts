/**
 * HandleComponent data registration tests.
 *
 * Angular's JIT compiler (used in Vitest) does not populate ɵcmp.inputs from
 * signal-based input() declarations — that requires the AOT transform.  We
 * therefore bypass template-binding and drive signal inputs directly via the
 * internal ɵSIGNAL node, which is a stable (if private) Angular API exported
 * as an official alias.  All runtime behaviour (effect, ngOnDestroy, store
 * writes) is fully exercised.
 *
 * vi.mock with { spy: true } wraps every @angflow/system export in a spy but
 * keeps real implementations, so the data-registration tests are unaffected.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import * as system from '@angflow/system';
import { HandleComponent } from './handle.component';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';
import type { HandleType } from '@angflow/system';

// Wrap every @angflow/system export in a vi.spy (real implementations kept).
// This lets tests call vi.spyOn(system.XYHandle, 'onPointerDown') to intercept
// the call from HandleComponent.onPointerDown without mocking its logic.
vi.mock('@angflow/system', { spy: true });

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

describe('HandleComponent data registration', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-A' },
      ],
    });
    store = TestBed.inject(FlowStore);
  });

  it('registers data on mount', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'string');
    fixture.detectChanges();
    expect(store.getHandleData('node-A', 'h1', 'source')).toBe('string');
  });

  it('updates the registry when the data input changes', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'string');
    fixture.detectChanges();

    setSignalInput(inst, 'data', 'number');
    fixture.detectChanges();
    expect(store.getHandleData('node-A', 'h1', 'source')).toBe('number');
  });

  it('unregisters on destroy', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'string');
    fixture.detectChanges();
    expect(store.getHandleData('node-A', 'h1', 'source')).toBe('string');

    fixture.destroy();
    expect(store.getHandleData('node-A', 'h1', 'source')).toBeUndefined();
  });

  it('is a no-op when data input is undefined', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-B' },
      ],
    });
    const s = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h2');
    // data left as undefined (default)
    fixture.detectChanges();
    expect(s.getHandleData('node-B', 'h2', 'source')).toBeUndefined();
  });

  it('registers and unregisters correctly when handleId is null', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'target' as HandleType);
    // handleId defaults to null — do not override
    setSignalInput(inst, 'data', 'null-key-data');
    fixture.detectChanges();
    expect(store.getHandleData('node-A', null, 'target')).toBe('null-key-data');

    fixture.destroy();
    expect(store.getHandleData('node-A', null, 'target')).toBeUndefined();
  });

  it('unregisters the previous key when handleId changes', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'payload');
    fixture.detectChanges();
    expect(store.getHandleData('node-A', 'h1', 'source')).toBe('payload');

    setSignalInput(inst, 'handleId', 'h2');
    fixture.detectChanges();

    expect(store.getHandleData('node-A', 'h2', 'source')).toBe('payload');
    expect(store.getHandleData('node-A', 'h1', 'source')).toBeUndefined();
  });

  it('unregisters the previous key when type changes', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'payload');
    fixture.detectChanges();

    setSignalInput(inst, 'type', 'target' as HandleType);
    fixture.detectChanges();

    expect(store.getHandleData('node-A', 'h1', 'target')).toBe('payload');
    expect(store.getHandleData('node-A', 'h1', 'source')).toBeUndefined();
  });

  it('sets the data-floating attribute when the floating input is true', () => {
    // Case 1: floating=true
    const fixture1 = TestBed.createComponent(HandleComponent);
    const inst1 = fixture1.componentInstance;
    setSignalInput(inst1, 'type', 'source' as HandleType);
    setSignalInput(inst1, 'floating', true);
    fixture1.detectChanges();
    expect(fixture1.nativeElement.hasAttribute('data-floating')).toBe(true);

    // Case 2: floating=false (default)
    const fixture2 = TestBed.createComponent(HandleComponent);
    const inst2 = fixture2.componentInstance;
    setSignalInput(inst2, 'type', 'source' as HandleType);
    setSignalInput(inst2, 'floating', false);
    fixture2.detectChanges();
    expect(fixture2.nativeElement.hasAttribute('data-floating')).toBe(false);
  });
});

// ── Integration: isNodeVisible wiring at the XYHandle.onPointerDown call site ──
//
// Strategy: spy on XYHandle.onPointerDown (vi.mock with { spy: true } keeps the
// real implementation but makes every method spyable). Call the component's
// onPointerDown directly — bypassing DOM events so jsdom's missing pointer-event
// infrastructure doesn't interfere — then capture the params object and assert:
//   1. isNodeVisible is a function (the wiring exists).
//   2. The function returns false for a collapse-hidden child id.
//   3. The function returns true for a visible node id.
// This pins the REAL production wiring: deleting the isNodeVisible line in
// handle.component.ts makes these tests fail.

describe('HandleComponent — isNodeVisible wiring to XYHandle.onPointerDown', () => {
  let store: FlowStore;
  let component: HandleComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-source' },
      ],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(HandleComponent);
    component = fixture.componentInstance;
    setSignalInput(component, 'type', 'source' as HandleType);
    setSignalInput(component, 'handleId', 'h1');
    fixture.detectChanges();
  });

  function seedCollapsedGroup(): void {
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
      { id: 'visible', position: { x: 200, y: 200 }, data: {} },
    ] as any[]);
  }

  it('passes isNodeVisible to XYHandle.onPointerDown and it returns false for a collapse-hidden child', () => {
    seedCollapsedGroup();

    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      component.onPointerDown(new MouseEvent('mousedown', { button: 0, bubbles: true }));

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

  it('isNodeVisible predicate reflects signal reactivity: expanding a group makes its child visible', () => {
    // Start with a collapsed group so child is hidden.
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
    ] as any[]);

    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      component.onPointerDown(new MouseEvent('mousedown', { button: 0, bubbles: true }));

      const params = spy.mock.calls[0][1] as Record<string, unknown>;
      const isNodeVisible = params['isNodeVisible'] as (n: { id: string }) => boolean;

      // Child is hidden while group is collapsed.
      expect(isNodeVisible({ id: 'child' })).toBe(false);

      // Expand the group — predicate closure reads the live store signal.
      store.setNodes([
        { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: false },
        { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
      ] as any[]);

      // The same captured predicate now returns true because the signal updated.
      expect(isNodeVisible({ id: 'child' })).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

// ── Pointer trigger: connections must start from a touch-capable pointer event ──
//
// Regression for "connecting nodes on mobile doesn't work": the host bound the
// connection trigger to `mousedown`, which never fires during a touch-drag. The
// whole connection pipeline (XYHandle.onPointerDown attaches mouse AND touch
// move/up listeners; getEventPosition is touch-aware) supports touch — only the
// trigger was mouse-only. The host now binds `pointerdown`, which unifies mouse,
// touch and pen.

describe('HandleComponent — connection trigger uses pointerdown', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-A' },
      ],
    });
    store = TestBed.inject(FlowStore);
  });

  function mountSourceHandle() {
    const fixture = TestBed.createComponent(HandleComponent);
    setSignalInput(fixture.componentInstance, 'type', 'source' as HandleType);
    setSignalInput(fixture.componentInstance, 'isConnectableStart', true);
    fixture.detectChanges();
    return fixture;
  }

  it('starts a connection on pointerdown (covers touch + pen, not just mouse)', () => {
    const fixture = mountSourceHandle();
    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      fixture.nativeElement.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('no longer triggers on a bare mousedown (the mouse-only trigger is gone)', () => {
    const fixture = mountSourceHandle();
    const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
    try {
      fixture.nativeElement.dispatchEvent(new Event('mousedown', { bubbles: true }));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

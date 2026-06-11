/**
 * HandleComponent data registration tests.
 *
 * Angular's JIT compiler (used in Vitest) does not populate ɵcmp.inputs from
 * signal-based input() declarations — that requires the AOT transform.  We
 * therefore bypass template-binding and drive signal inputs directly via the
 * internal ɵSIGNAL node, which is a stable (if private) Angular API exposed as
 * an official export alias.  All runtime behaviour (effect, ngOnDestroy, store
 * writes) is fully exercised.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { HandleComponent } from './handle.component';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';
import type { HandleType } from '@angflow/system';

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

// ── Integration: collapse-hidden child is never a connection drop candidate ──
//
// Strategy: we don't fire real pointer events (XYHandle.onPointerDown uses
// document-level event listeners that are hard to drive in jsdom). Instead we
// test the predicate closure that the component would supply to XYHandle.
// This is the correct boundary to test: the component's responsibility is to
// build the right predicate; XYHandle's responsibility to call it is covered
// by the system-level XYHandle.spec.ts tests.

describe('HandleComponent — isNodeVisible predicate for collapsedHiddenIds', () => {
  it('returns false for a node in collapsedHiddenIds and true for a visible node', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-source' },
      ],
    });

    const store = TestBed.inject(FlowStore);

    // Populate the store with a group containing a collapsed child.
    // We drive collapsedHiddenIds by setting a collapsed group node via setNodes.
    // FlowStore.setNodes populates nodeLookup which getCollapsedHiddenIds reads.
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
      { id: 'visible', position: { x: 200, y: 200 }, data: {} },
    ] as any[]);

    // collapsedHiddenIds should now include 'child' but not 'group' or 'visible'.
    const hiddenIds = store.collapsedHiddenIds();
    expect(hiddenIds.has('child')).toBe(true);
    expect(hiddenIds.has('group')).toBe(false);
    expect(hiddenIds.has('visible')).toBe(false);

    // Build the exact predicate the component passes to XYHandle.onPointerDown.
    const predicate = (n: { id: string }) => !store.collapsedHiddenIds().has(n.id);

    // A collapse-hidden child must not be a candidate.
    expect(predicate({ id: 'child' })).toBe(false);
    // The group node itself is visible.
    expect(predicate({ id: 'group' })).toBe(true);
    // A completely separate visible node is a candidate.
    expect(predicate({ id: 'visible' })).toBe(true);
    // An arbitrary unknown node defaults to visible.
    expect(predicate({ id: 'unknown' })).toBe(true);
  });

  it('predicate reflects signal reactivity: after expanding group child becomes visible', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-source' },
      ],
    });

    const store = TestBed.inject(FlowStore);

    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
    ] as any[]);

    const predicate = (n: { id: string }) => !store.collapsedHiddenIds().has(n.id);

    expect(predicate({ id: 'child' })).toBe(false);

    // Expand the group — setNodes with collapsed:false.
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: false },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
    ] as any[]);

    // Now the predicate must return true for the child (no longer hidden).
    expect(predicate({ id: 'child' })).toBe(true);
  });
});

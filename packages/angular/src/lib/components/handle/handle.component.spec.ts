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

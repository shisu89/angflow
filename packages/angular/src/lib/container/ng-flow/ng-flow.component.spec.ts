import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('NgFlowComponent fitView startup', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NgFlowComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not move the viewport from a timer before nodes are measured', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'fitView', true);
    setSignalInput(inst, 'nodesModel', [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 400, y: 300 }, data: {} },
    ]);
    fixture.detectChanges();

    const before = inst.store.transform();
    vi.advanceTimersByTime(60);

    // Nodes are unmeasured, so the queued fitView must still be pending and
    // no timer fallback may guess dimensions and jump the viewport.
    expect(inst.store.transform()).toEqual(before);
    expect(inst.store.fitViewQueued()).toBe(true);
  });
});

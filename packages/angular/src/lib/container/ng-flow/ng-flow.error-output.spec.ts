/**
 * End-to-end coverage for the `store.onError` → `onErrorWrapper` → `(error)`
 * output bridge, using the codes the mural-copy remediation added.
 *
 * The renderer specs stub `store.onError` with `vi.fn()`, so they verify the
 * *call* but never that a real `<ng-flow>` consumer bound to `(error)` sees
 * `003` / `011`. This renders the real component with an unknown node type and
 * an unknown edge type and asserts both codes arrive at the output.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { resetDevWarnDedupe } from '../../utils/dev-warn';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** Both renderers defer the onError call to a microtask (see getNodeComponent). */
const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('NgFlowComponent (error) output — unknown node/edge types', () => {
  beforeEach(() => {
    resetDevWarnDedupe();
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
  });

  it('delivers error003 and error011 to a bound (error) output', async () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const errors: Array<{ id: string; message: string }> = [];
    fixture.componentInstance.error.subscribe((e) => errors.push(e));

    fixture.componentRef.setInput('nodes', [
      { id: 'a', type: 'stickyNote', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'stickyNote', position: { x: 200, y: 0 }, data: {} },
    ]);
    fixture.componentRef.setInput('edges', [
      { id: 'e1', source: 'a', target: 'b', type: 'arrow' },
    ]);
    fixture.detectChanges();
    await flushMicrotasks();
    fixture.detectChanges();
    await flushMicrotasks();

    const node003 = errors.find((e) => e.id === '003');
    const edge011 = errors.find((e) => e.id === '011');

    expect(node003, `expected error003, got ${JSON.stringify(errors)}`).toBeDefined();
    expect(node003!.message).toContain('Node type "stickyNote" not found');
    expect(edge011, `expected error011, got ${JSON.stringify(errors)}`).toBeDefined();
    expect(edge011!.message).toContain('Edge type "arrow" not found');

    fixture.destroy();
  });

  it('does not emit for known node and edge types', async () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const errors: Array<{ id: string; message: string }> = [];
    fixture.componentInstance.error.subscribe((e) => errors.push(e));

    fixture.componentRef.setInput('nodes', [
      { id: 'a', type: 'default', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'default', position: { x: 200, y: 0 }, data: {} },
    ]);
    fixture.componentRef.setInput('edges', [
      { id: 'e1', source: 'a', target: 'b', type: 'smoothstep' },
    ]);
    fixture.detectChanges();
    await flushMicrotasks();
    fixture.detectChanges();
    await flushMicrotasks();

    expect(errors.filter((e) => e.id === '003' || e.id === '011')).toEqual([]);

    fixture.destroy();
  });
});

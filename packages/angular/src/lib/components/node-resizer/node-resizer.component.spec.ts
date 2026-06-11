/**
 * NodeResizerComponent reactive-configuration tests.
 *
 * Verifies that changing minWidth/minHeight/maxWidth/maxHeight/keepAspectRatio
 * after init causes XYResizer.update() to be called again on all instances
 * with the new values — the "read-once in ngAfterViewInit" regression.
 *
 * We access the private `resizerInstances` array directly and spy on each
 * instance's `update` method, avoiding vi.mock (which breaks Angular JIT).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { NodeResizerComponent } from './node-resizer.component';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

/** Read the private resizerInstances array off the component. */
function getResizerInstances(comp: NodeResizerComponent): Array<{ update: (cfg: unknown) => void; destroy: () => void }> {
  return (comp as unknown as Record<string, unknown>)['resizerInstances'] as Array<{ update: (cfg: unknown) => void; destroy: () => void }>;
}

describe('NodeResizerComponent reactive configuration', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeResizerComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'n1' },
      ],
    });
  });

  it('re-applies boundaries and keepAspectRatio when inputs change after init', async () => {
    const fixture = TestBed.createComponent(NodeResizerComponent);
    const inst = fixture.componentInstance;
    fixture.detectChanges(); // init → 8 XYResizer instances (4 corners + 4 lines)

    const instances = getResizerInstances(inst);
    expect(instances).toHaveLength(8);

    // Spy on each instance's update method, capturing all calls after init.
    const updateSpies = instances.map((r) => vi.spyOn(r, 'update'));

    // Verify the initial minWidth was 10 (default).
    // The effect fires once on creation (synchronously with applyResizerConfig).
    // After detectChanges + whenStable, one initial effect call is expected.
    fixture.detectChanges();
    await fixture.whenStable();

    // Now change inputs.
    setSignalInput(inst, 'minWidth', 42);
    setSignalInput(inst, 'keepAspectRatio', true);
    fixture.detectChanges();
    await fixture.whenStable();

    // Each instance's update must have been called with the new values.
    for (let i = 0; i < 8; i++) {
      const calls = updateSpies[i].mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0] as {
        boundaries: { minWidth: number };
        keepAspectRatio: boolean;
      };
      expect(lastCall.boundaries.minWidth).toBe(42);
      expect(lastCall.keepAspectRatio).toBe(true);
    }
  });
});

/**
 * NodeResizerComponent ↔ FlowStore.nodeResizing ownership tests.
 *
 * `nodeResizing` is a single global flag but there is one NodeResizerComponent
 * per node, so the flag needs an owner:
 *  - the wrapped onResizeStart/onResizeEnd raise and clear it;
 *  - ngOnDestroy clears it ONLY for the instance that raised it, so a resizer
 *    torn down mid-gesture cannot strand the flag at true while an unrelated
 *    sibling unmounting cannot drop it out from under a live resize.
 *
 * We reach the wrapped callbacks the same way node-resizer.component.spec.ts
 * reaches the boundaries config: spy on each XYResizer instance's `update`
 * and read the config the component passed. vi.mock is avoided (breaks JIT).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import type { ResizeDragEvent, ResizeParams } from '@angflow/system';
import { NodeResizerComponent } from './node-resizer.component';
import { FlowStore } from '../../services/flow-store.service';

interface ResizerConfig {
  onResizeStart: (event: ResizeDragEvent, params: ResizeParams) => void;
  onResizeEnd: (event: ResizeDragEvent, params: ResizeParams) => void;
}

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

function getResizerInstances(comp: NodeResizerComponent): Array<{ update: (cfg: unknown) => void }> {
  return (comp as unknown as Record<string, unknown>)['resizerInstances'] as Array<{ update: (cfg: unknown) => void }>;
}

/**
 * Returns the resize callbacks the component installed on its first control.
 * The instances only exist after ngAfterViewInit, so we spy first and then
 * poke an input to force one more applyResizerConfig pass we can capture.
 */
async function captureConfig(fixture: ComponentFixture<NodeResizerComponent>): Promise<ResizerConfig> {
  const inst = fixture.componentInstance;
  const first = getResizerInstances(inst)[0];
  expect(first).toBeDefined();

  const spy = vi.spyOn(first, 'update');
  // Any config input works — the effect re-runs applyResizerConfig wholesale.
  setSignalInput(inst, 'minWidth', 11);
  fixture.detectChanges();
  await fixture.whenStable();

  expect(spy).toHaveBeenCalled();
  return spy.mock.calls[spy.mock.calls.length - 1][0] as ResizerConfig;
}

const fakeEvent = {} as ResizeDragEvent;
const fakeParams = { x: 0, y: 0, width: 100, height: 100 } as ResizeParams;

describe('NodeResizerComponent nodeResizing flag', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeResizerComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  function createResizer(nodeId: string): ComponentFixture<NodeResizerComponent> {
    const fixture = TestBed.createComponent(NodeResizerComponent);
    fixture.componentRef.setInput('nodeId', nodeId);
    fixture.detectChanges();
    return fixture;
  }

  it('raises nodeResizing on resize start and clears it on resize end', async () => {
    const fixture = createResizer('n1');
    const cfg = await captureConfig(fixture);

    expect(store.nodeResizing()).toBe(false);

    cfg.onResizeStart(fakeEvent, fakeParams);
    expect(store.nodeResizing()).toBe(true);
    expect(store.gestureActive()).toBe(true);

    cfg.onResizeEnd(fakeEvent, fakeParams);
    expect(store.nodeResizing()).toBe(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('clears nodeResizing when the instance holding the gesture is destroyed', async () => {
    // Proximity-gated chrome unmounts the resizer WHILE its own resize is in
    // flight. Without the destroy-clear the flag strands at true and every
    // later paneMouseLeave is suppressed forever.
    const fixture = createResizer('n1');
    const cfg = await captureConfig(fixture);

    cfg.onResizeStart(fakeEvent, fakeParams);
    expect(store.nodeResizing()).toBe(true);

    fixture.destroy();
    expect(store.nodeResizing()).toBe(false);
  });

  it('does not clear nodeResizing when an uninvolved sibling resizer is destroyed', async () => {
    // Node A is mid-resize; node B's resizer unmounts (proximity chrome again).
    // B never started a resize, so it must not touch the shared flag.
    const resizerA = createResizer('a');
    const resizerB = createResizer('b');
    const cfgA = await captureConfig(resizerA);

    cfgA.onResizeStart(fakeEvent, fakeParams);
    expect(store.nodeResizing()).toBe(true);

    resizerB.destroy();
    expect(store.nodeResizing()).toBe(true);
    expect(store.gestureActive()).toBe(true);

    // A's own end still clears it.
    cfgA.onResizeEnd(fakeEvent, fakeParams);
    expect(store.nodeResizing()).toBe(false);
  });

  it('does not clear nodeResizing when an instance whose gesture already ended is destroyed', async () => {
    const resizerA = createResizer('a');
    const resizerB = createResizer('b');
    const cfgA = await captureConfig(resizerA);
    const cfgB = await captureConfig(resizerB);

    // B resizes and finishes; A then starts. Destroying B must not clear A's flag.
    cfgB.onResizeStart(fakeEvent, fakeParams);
    cfgB.onResizeEnd(fakeEvent, fakeParams);
    cfgA.onResizeStart(fakeEvent, fakeParams);

    resizerB.destroy();
    expect(store.nodeResizing()).toBe(true);
  });
});

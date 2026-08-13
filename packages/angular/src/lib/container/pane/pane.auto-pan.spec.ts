import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectionMode } from '@angflow/system';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlowStore } from '../../services/flow-store.service';
import { PaneComponent } from './pane.component';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const signal = (instance as Record<string, unknown>)[inputName];
  const node = (signal as Record<symbol, { applyValueToInputSignal(node: unknown, value: unknown): void }>)[
    ɵSIGNAL as unknown as symbol
  ];
  node.applyValueToInputSignal(node, value);
}

let nextFrameId = 1;
let frames = new Map<number, FrameRequestCallback>();

function installFrameHarness(): void {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
}

function flushFrameworkFrames(): void {
  for (const [id, callback] of [...frames]) {
    frames.delete(id);
    callback(performance.now());
  }
}

async function flushFrame(): Promise<void> {
  const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!entry) throw new Error('Expected a scheduled animation frame');
  frames.delete(entry[0]);
  entry[1](performance.now());
  await Promise.resolve();
  await Promise.resolve();
}

function pointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  values: { x: number; y: number; id?: number; pointerType?: string }
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: values.x },
    clientY: { value: values.y },
    button: { value: 0 },
    isPrimary: { value: true },
    pointerId: { value: values.id ?? 1 },
    pointerType: { value: values.pointerType ?? 'mouse' },
  });
  return event;
}

describe('PaneComponent box selection auto-pan', () => {
  let fixture: ComponentFixture<PaneComponent> | null;
  let pane: PaneComponent;
  let store: FlowStore;
  let paneElement: HTMLElement;

  function startSelectionAt(x: number, y: number, pointerType = 'mouse'): void {
    paneElement.dispatchEvent(pointerEvent('pointerdown', { x, y, pointerType }));
    // Box selection has not scheduled auto-pan yet, so callbacks queued by the
    // pointerdown signal writes belong to Angular's zoneless render scheduler.
    // Execute them so Angular resets its scheduler state instead of stranding it.
    flushFrameworkFrames();
    vi.mocked(cancelAnimationFrame).mockClear();
  }

  function moveSelectionTo(x: number, y: number, pointerType = 'mouse'): void {
    document.dispatchEvent(pointerEvent('pointermove', { x, y, pointerType }));
  }

  function endSelectionAt(x: number, y: number, pointerType = 'mouse'): void {
    document.dispatchEvent(pointerEvent('pointerup', { x, y, pointerType }));
  }

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
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });

    fixture = TestBed.createComponent(PaneComponent);
    pane = fixture.componentInstance;
    store = TestBed.inject(FlowStore);
    paneElement = fixture.nativeElement as HTMLElement;
    setSignalInput(pane, 'selectionOnDrag', true);
    fixture.detectChanges();

    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 }),
    });
    store.domNode.set(container as HTMLDivElement);
    // Auto-pan sizes the edge bands off the store's ResizeObserver-backed
    // dimensions, which NgFlowComponent seeds before the pane can start a
    // selection. Match the fake container's 200x200 box.
    store.width.set(200);
    store.height.set(200);

    nextFrameId = 1;
    frames = new Map();
    installFrameHarness();
    vi.spyOn(store, 'panBy').mockImplementation(async ({ x, y }) => {
      store.transform.update(([tx, ty, zoom]) => [tx + x, ty + y, zoom]);
      return x !== 0 || y !== 0;
    });
    pane.initSelectionListener();
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    frames.clear();
  });

  it.each([
    [{ x: 2, y: 100 }, { x: 1, y: 0 }],
    [{ x: 198, y: 100 }, { x: -1, y: 0 }],
    [{ x: 100, y: 2 }, { x: 0, y: 1 }],
    [{ x: 100, y: 198 }, { x: 0, y: -1 }],
  ])('pans in the expected direction at each edge', async (pointer, direction) => {
    startSelectionAt(100, 100);
    moveSelectionTo(pointer.x, pointer.y);
    await flushFrame();
    const delta = vi.mocked(store.panBy).mock.calls[0][0];
    expect(Math.sign(delta.x)).toBe(direction.x);
    expect(Math.sign(delta.y)).toBe(direction.y);
  });

  it('keeps panning while the pointer is stationary at an edge', async () => {
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    await flushFrame();
    await flushFrame();
    expect(store.panBy).toHaveBeenCalledTimes(2);
  });

  it('waits for panBy before scheduling another auto-pan frame', async () => {
    let resolvePan!: (moved: boolean) => void;
    vi.mocked(store.panBy).mockImplementation(
      () => new Promise<boolean>((resolve) => (resolvePan = resolve))
    );
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    await flushFrame();

    moveSelectionTo(197, 100);
    expect(frames.size).toBe(0);

    resolvePan(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(frames.size).toBe(1);
  });

  it('ignores a stale pan completion after a new box selection starts', async () => {
    let resolveOldPan!: (moved: boolean) => void;
    vi.mocked(store.panBy).mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (resolveOldPan = resolve))
    );
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    await flushFrame();

    document.dispatchEvent(pointerEvent('pointercancel', { x: 198, y: 100 }));
    startSelectionAt(50, 50);
    moveSelectionTo(60, 60);
    const newSelectionRect = store.userSelectionRect();
    const newFrameId = frames.keys().next().value as number;

    resolveOldPan(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(store.userSelectionRect()).toBe(newSelectionRect);
    expect([...frames.keys()]).toEqual([newFrameId]);
  });

  it('keeps the origin fixed in flow space while the viewport pans', async () => {
    store.transform.set([20, 10, 2]);
    startSelectionAt(120, 110); // flow origin = (50, 50)
    moveSelectionTo(198, 150);
    await flushFrame();
    const rect = store.userSelectionRect()!;
    const [tx, ty, zoom] = store.transform();
    expect(rect.startX).toBeCloseTo(50 * zoom + tx);
    expect(rect.startY).toBeCloseTo(50 * zoom + ty);
  });

  it('selects a node revealed by auto-pan without another pointermove', async () => {
    store.setNodes([
      {
        id: 'revealed',
        position: { x: 202, y: 90 },
        measured: { width: 6, height: 10 },
        handles: [],
        data: {},
      },
    ]);
    startSelectionAt(100, 80);
    moveSelectionTo(198, 120);
    await flushFrame();
    expect(store.selectedNodes().map(({ id }) => id)).toContain('revealed');
  });

  it('does not pan when box selection auto-pan is disabled', () => {
    setSignalInput(pane, 'autoPanOnSelection', false);
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    expect(frames.size).toBe(0);
    expect(store.panBy).not.toHaveBeenCalled();
  });

  it('keeps box selection active when translate extent rejects movement', async () => {
    vi.mocked(store.panBy).mockResolvedValue(false);
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    await flushFrame();
    expect(store.userSelectionActive()).toBe(true);
    expect(frames.size).toBe(1);
  });

  it('cancels the frame and clears transient state on pointercancel', () => {
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const selectionEnd = vi.fn();
    pane.selectionEnd.subscribe(selectionEnd);
    startSelectionAt(100, 100, 'pen');
    moveSelectionTo(198, 100, 'pen');
    const registrations = new Map(
      addListener.mock.calls
        .filter(([type]) => ['pointermove', 'pointerup', 'pointercancel'].includes(type))
        .map(([type, callback]) => [type, callback])
    );

    document.dispatchEvent(pointerEvent('pointercancel', { x: 198, y: 100, pointerType: 'pen' }));

    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(store.userSelectionActive()).toBe(false);
    expect(store.userSelectionRect()).toBeNull();
    expect(selectionEnd).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith('pointermove', registrations.get('pointermove'));
    expect(removeListener).toHaveBeenCalledWith('pointerup', registrations.get('pointerup'));
    expect(removeListener).toHaveBeenCalledWith('pointercancel', registrations.get('pointercancel'));
  });

  it('preserves Full and Partial box selection semantics', () => {
    store.setNodes([
      {
        id: 'overlap',
        position: { x: 90, y: 90 },
        measured: { width: 30, height: 30 },
        handles: [],
        data: {},
      },
    ]);
    setSignalInput(pane, 'selectionMode', SelectionMode.Full);
    startSelectionAt(100, 100);
    moveSelectionTo(130, 130);
    expect(store.selectedNodes()).toHaveLength(0);
    endSelectionAt(130, 130);

    setSignalInput(pane, 'selectionMode', SelectionMode.Partial);
    startSelectionAt(100, 100);
    moveSelectionTo(130, 130);
    expect(store.selectedNodes().map(({ id }) => id)).toEqual(['overlap']);
  });

  it('never selects nodes whose selectable flag is false', () => {
    store.setNodes([
      {
        id: 'locked',
        position: { x: 110, y: 110 },
        selectable: false,
        measured: { width: 10, height: 10 },
        handles: [],
        data: {},
      },
    ]);
    startSelectionAt(100, 100);
    moveSelectionTo(130, 130);
    expect(store.selectedNodes()).toHaveLength(0);
  });

  it('stops the auto-pan loop when the pointer returns to the center', async () => {
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    await flushFrame();
    vi.mocked(store.panBy).mockClear();
    moveSelectionTo(100, 100);
    await flushFrame();
    // Clear of every edge there is nothing to pan, so the frame neither calls
    // panBy nor re-arms itself. Re-arming would spin a frame callback for the
    // rest of the gesture to compute a zero delta.
    expect(store.panBy).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('resumes auto-pan on the next pointermove back to an edge', async () => {
    startSelectionAt(100, 100);
    moveSelectionTo(198, 100);
    await flushFrame();
    moveSelectionTo(100, 100);
    await flushFrame();
    expect(frames.size).toBe(0);

    // The loop stopped, so pointermove is the only thing that can restart it.
    vi.mocked(store.panBy).mockClear();
    moveSelectionTo(198, 100);
    expect(frames.size).toBe(1);
    await flushFrame();
    expect(store.panBy).toHaveBeenCalledOnce();
    expect(vi.mocked(store.panBy).mock.lastCall?.[0].x).toBeLessThan(0);
  });

  it.each(['mouse', 'touch', 'pen'])('uses the same box selection path for %s', (pointerType) => {
    startSelectionAt(80, 80, pointerType);
    moveSelectionTo(120, 120, pointerType);
    expect(store.userSelectionActive()).toBe(true);
    endSelectionAt(120, 120, pointerType);
    expect(store.userSelectionActive()).toBe(false);
  });

  it('removes the exact document listeners and emits once on pointerup', () => {
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const selectionEnd = vi.fn();
    pane.selectionEnd.subscribe(selectionEnd);
    startSelectionAt(100, 100);
    moveSelectionTo(120, 120);
    const registrations = new Map(
      addListener.mock.calls
        .filter(([type]) => ['pointermove', 'pointerup', 'pointercancel'].includes(type))
        .map(([type, callback]) => [type, callback])
    );

    endSelectionAt(120, 120);

    expect(selectionEnd).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith('pointermove', registrations.get('pointermove'));
    expect(removeListener).toHaveBeenCalledWith('pointerup', registrations.get('pointerup'));
    expect(removeListener).toHaveBeenCalledWith('pointercancel', registrations.get('pointercancel'));
  });

  it('removes the exact document listeners without emitting when destroyed', () => {
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const selectionEnd = vi.fn();
    pane.selectionEnd.subscribe(selectionEnd);
    startSelectionAt(100, 100);
    moveSelectionTo(120, 120);
    const registrations = new Map(
      addListener.mock.calls
        .filter(([type]) => ['pointermove', 'pointerup', 'pointercancel'].includes(type))
        .map(([type, callback]) => [type, callback])
    );

    fixture!.destroy();
    fixture = null;

    expect(selectionEnd).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith('pointermove', registrations.get('pointermove'));
    expect(removeListener).toHaveBeenCalledWith('pointerup', registrations.get('pointerup'));
    expect(removeListener).toHaveBeenCalledWith('pointercancel', registrations.get('pointercancel'));
  });
});

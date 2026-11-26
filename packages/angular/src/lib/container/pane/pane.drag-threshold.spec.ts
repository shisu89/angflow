/**
 * The box-selection marquee waits for paneDragThreshold (#6115), as upstream
 * React's Pane onPointerMove: below the threshold a press is a click, so no
 * rect is drawn, no (selectionStart) / (selectionEnd) is emitted and no
 * selection state is left behind. With the selection key held the threshold is 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { PaneComponent } from './pane.component';
import { FlowStore } from '../../services/flow-store.service';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

/** Stub domNode on a store with a fake container that has getBoundingClientRect. */
function stubDomNode(store: FlowStore): void {
  const fakeContainer = document.createElement('div');
  Object.defineProperty(fakeContainer, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  });
  store.domNode.set(fakeContainer as HTMLDivElement);
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

describe('PaneComponent marquee paneDragThreshold (#6115)', () => {
  let fixture: ComponentFixture<PaneComponent>;
  let pane: PaneComponent;
  let store: FlowStore;
  let el: HTMLElement;
  const starts = vi.fn();
  const ends = vi.fn();
  const down = (x: number, y: number) => el.dispatchEvent(pointerEvent('pointerdown', { x, y }));
  const move = (x: number, y: number) => document.dispatchEvent(pointerEvent('pointermove', { x, y }));
  const up = (x: number, y: number) => document.dispatchEvent(pointerEvent('pointerup', { x, y }));

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
    el = fixture.nativeElement;
    setSignalInput(pane, 'selectionOnDrag', true);
    setSignalInput(pane, 'panOnDrag', [1, 2]);
    setSignalInput(pane, 'autoPanOnSelection', false);
    stubDomNode(store);
    pane.initSelectionListener();
    starts.mockClear();
    ends.mockClear();
    pane.selectionStart.subscribe(starts);
    pane.selectionEnd.subscribe(ends);
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
  });

  it('no rect, no selectionInProgress and no (selectionStart) at or below the threshold', () => {
    store.paneDragThreshold.set(5);
    down(100, 100);
    move(103, 104); // exactly 5px: not past it
    expect(store.userSelectionRect()).toBeNull();
    expect(store.selectionInProgress()).toBe(false);
    expect(starts).not.toHaveBeenCalled();
    expect(store.userSelectionActive()).toBe(true); // kept: set on press
  });

  it('crossing the threshold starts the marquee once; (selectionEnd) follows on release', () => {
    store.paneDragThreshold.set(5);
    down(100, 100);
    move(106, 100);
    move(120, 110);
    expect(starts).toHaveBeenCalledTimes(1);
    expect(store.selectionInProgress()).toBe(true);
    expect(store.userSelectionRect()).toMatchObject({ x: 100, y: 100, width: 20, height: 10 });
    up(120, 110);
    expect(ends).toHaveBeenCalledTimes(1);
  });

  it('a press that never crosses leaves no selection state, so its click is a pane click', () => {
    store.paneDragThreshold.set(5);
    down(100, 100);
    move(102, 100);
    up(102, 100);
    expect(store.userSelectionActive()).toBe(false);
    expect(store.userSelectionRect()).toBeNull();
    expect(store.selectionInProgress()).toBe(false);
    expect(store.nodesSelectionActive()).toBe(false);
    expect(ends).not.toHaveBeenCalled();
  });

  it('with the selection key held the threshold is 0', () => {
    store.paneDragThreshold.set(50);
    store.selectionKeyActive.set(true);
    down(100, 100);
    move(100.5, 100);
    expect(starts).toHaveBeenCalledTimes(1);
  });
});

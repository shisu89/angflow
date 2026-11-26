/**
 * Pane context menu and connectionInProgress forwarding to XYPanZoom.
 *
 * With `panOnDrag` including 2 (right-drag pan) XYPanZoom emits the context menu itself
 * (only for a right-click that did not drag), so the native `contextmenu` handler must not.
 * Mirrors React's `Pane.onContextMenu`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { Position, type ConnectionInProgress } from '@angflow/system';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function makeInProgressConnection(): ConnectionInProgress {
  return {
    inProgress: true,
    isValid: null,
    from: { x: 0, y: 0 },
    fromHandle: { id: null, nodeId: '1', x: 0, y: 0, position: Position.Bottom, type: 'source', width: 10, height: 10 },
    fromPosition: Position.Bottom,
    fromNode: null as never,
    to: { x: 100, y: 100 },
    toHandle: null,
    toPosition: Position.Top,
    toNode: null,
    pointer: { x: 100, y: 100 },
  };
}

interface PanZoomLike {
  update: (opts: Record<string, unknown>) => void;
}

describe('NgFlowComponent pane context menu and pan/zoom options', () => {
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
  });

  async function setup(panOnDrag?: boolean | number[]) {
    const fixture = TestBed.createComponent(NgFlowComponent);
    if (panOnDrag !== undefined) fixture.componentRef.setInput('panOnDrag', panOnDrag);
    fixture.detectChanges();
    await fixture.whenStable();
    const inst = fixture.componentInstance;
    const pz = (inst as unknown as { panZoomInstance: PanZoomLike | null }).panZoomInstance;
    expect(pz).not.toBeNull();
    const update = vi.spyOn(pz as PanZoomLike, 'update');
    const emitted = vi.fn();
    inst.paneContextMenu.subscribe(emitted);
    return { fixture, inst, update, emitted };
  }

  it('passes connectionInProgress to XYPanZoom and updates it when the connection ends', async () => {
    const { fixture, inst, update } = await setup();

    inst.store.rawConnection.set(makeInProgressConnection());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(update).toHaveBeenCalled();
    expect(update.mock.calls.at(-1)![0]['connectionInProgress']).toBe(true);

    inst.store.cancelConnection();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(update.mock.calls.at(-1)![0]['connectionInProgress']).toBe(false);
  });

  it('does not report the click-to-connect preview as a connection in progress (panning stays enabled)', async () => {
    const { fixture, inst, update } = await setup();
    inst.store.updateClickConnectPreview(makeInProgressConnection());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(inst.store.connectionInProgress()).toBe(false);
    const last = update.mock.calls.at(-1);
    expect(last === undefined || last[0]['connectionInProgress'] === false).toBe(true);
  });

  it('does not re-run the pan/zoom update on every pointer move during a connection', async () => {
    const { fixture, inst, update } = await setup();
    inst.store.rawConnection.set(makeInProgressConnection());
    fixture.detectChanges();
    await fixture.whenStable();
    const calls = update.mock.calls.length;

    inst.store.rawConnection.set({ ...makeInProgressConnection(), to: { x: 150, y: 150 } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(update.mock.calls.length).toBe(calls);
  });

  it('native contextmenu emits nothing when panOnDrag includes 2, but XYPanZoom callback emits once and cancels click-connect', async () => {
    const { fixture, inst, update, emitted } = await setup([1, 2]);
    inst.store.connectionClickStartHandle.set({ nodeId: '1', handleId: null, type: 'source' });

    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('.xy-flow__pane').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(emitted).not.toHaveBeenCalled();
    expect(inst.store.connectionClickStartHandle()).not.toBeNull();

    // force a fresh update so the spy captures the callback passed to XYPanZoom
    inst.store.rawConnection.set(makeInProgressConnection());
    fixture.detectChanges();
    await fixture.whenStable();
    const onPaneContextMenu = update.mock.calls.at(-1)![0]['onPaneContextMenu'] as (e: MouseEvent) => void;
    expect(typeof onPaneContextMenu).toBe('function');
    onPaneContextMenu(new MouseEvent('contextmenu'));
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(inst.store.connectionClickStartHandle()).toBeNull();
  });

  it('native contextmenu emits once with the default panOnDrag', async () => {
    const { fixture, emitted } = await setup();
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('.xy-flow__pane').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(emitted).toHaveBeenCalledTimes(1);
  });
});

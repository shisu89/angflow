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
import type { Node } from '../../types';

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

  describe('React Pane parity: target check and nopan', () => {
    async function setupWithElements(nodes: Node[], nodesDraggable = true) {
      const fixture = TestBed.createComponent(NgFlowComponent);
      fixture.componentRef.setInput('nodes', nodes);
      fixture.componentRef.setInput('edges', [{ id: 'e1', source: 'a', target: 'b' }]);
      fixture.componentRef.setInput('nodesDraggable', nodesDraggable);
      fixture.detectChanges();
      await fixture.whenStable();
      const inst = fixture.componentInstance;
      const paneEmitted = vi.fn();
      const nodeEmitted = vi.fn();
      const selectionEmitted = vi.fn();
      inst.paneContextMenu.subscribe(paneEmitted);
      inst.nodeContextMenu.subscribe(nodeEmitted);
      inst.selectionContextMenu.subscribe(selectionEmitted);
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, inst, el, paneEmitted, nodeEmitted, selectionEmitted };
    }

    const twoNodes = (): Node[] => [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 200, y: 0 }, data: {}, draggable: false },
    ];

    it('a native contextmenu on a node fires (nodeContextMenu) and not (paneContextMenu)', async () => {
      const { el, paneEmitted, nodeEmitted } = await setupWithElements(twoNodes());
      const node = el.querySelector('.xy-flow__node[data-id="a"]') as HTMLElement;
      expect(node).not.toBeNull();
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      node.dispatchEvent(ev);
      expect(nodeEmitted).toHaveBeenCalledTimes(1);
      expect(paneEmitted).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(true);
    });

    it('a native contextmenu on the nodes-selection box does not fire (paneContextMenu)', async () => {
      const { fixture, inst, el, paneEmitted, selectionEmitted } = await setupWithElements(twoNodes());
      inst.store.nodesSelectionActive.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const box = el.querySelector('.xy-flow__nodesselection') as HTMLElement;
      expect(box).not.toBeNull();
      box.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(selectionEmitted).toHaveBeenCalledTimes(1);
      expect(paneEmitted).not.toHaveBeenCalled();
    });

    it('draggable nodes carry the nopan class, non-draggable ones do not', async () => {
      const { el } = await setupWithElements(twoNodes());
      expect(el.querySelector('.xy-flow__node[data-id="a"]')!.classList.contains('nopan')).toBe(true);
      expect(el.querySelector('.xy-flow__node[data-id="b"]')!.classList.contains('nopan')).toBe(false);
    });

    it('no node carries nopan when nodesDraggable is off', async () => {
      const { el } = await setupWithElements(twoNodes(), false);
      expect(el.querySelector('.xy-flow__node[data-id="a"]')!.classList.contains('nopan')).toBe(false);
    });

    it('honours a custom noPanClassName', async () => {
      const fixture = TestBed.createComponent(NgFlowComponent);
      fixture.componentRef.setInput('nodes', twoNodes());
      fixture.componentRef.setInput('noPanClassName', 'custom-nopan');
      fixture.detectChanges();
      await fixture.whenStable();
      const node = (fixture.nativeElement as HTMLElement).querySelector('.xy-flow__node[data-id="a"]')!;
      expect(node.classList.contains('custom-nopan')).toBe(true);
      expect(node.classList.contains('nopan')).toBe(false);
    });

    it('edges and the nodes-selection box always carry the nopan class', async () => {
      const { fixture, inst, el } = await setupWithElements(twoNodes());
      inst.store.nodesSelectionActive.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const edge = el.querySelector('.xy-flow__edge');
      expect(edge).not.toBeNull();
      expect(edge!.classList.contains('nopan')).toBe(true);
      const box = el.querySelector('.xy-flow__nodesselection')!;
      expect(box.classList.contains('nopan')).toBe(true);
      expect(box.classList.contains('xy-flow__selection')).toBe(true);
    });
  });
});

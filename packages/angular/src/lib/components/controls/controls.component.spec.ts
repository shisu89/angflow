/**
 * ControlsComponent delete-button tests.
 *
 * The delete button is a touch/mobile affordance for the Delete key. It is
 * opt-in (`showDelete`), disabled until something is selected, and delegates to
 * NgFlowService.deleteElements (the same path the Delete key and programmatic
 * deletes take).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { ControlsComponent } from './controls.component';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';

/** Set an input() signal's value directly without a host template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

describe('ControlsComponent — delete button', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ControlsComponent],
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  /** Mount with only the delete button so `button` unambiguously selects it. */
  function mountDeleteOnly() {
    const fixture = TestBed.createComponent(ControlsComponent);
    setSignalInput(fixture.componentInstance, 'showZoom', false);
    setSignalInput(fixture.componentInstance, 'showFitView', false);
    setSignalInput(fixture.componentInstance, 'showInteractive', false);
    setSignalInput(fixture.componentInstance, 'showDelete', true);
    fixture.detectChanges();
    return fixture;
  }

  it('is hidden unless showDelete is true', () => {
    const fixture = TestBed.createComponent(ControlsComponent);
    setSignalInput(fixture.componentInstance, 'showZoom', false);
    setSignalInput(fixture.componentInstance, 'showFitView', false);
    setSignalInput(fixture.componentInstance, 'showInteractive', false);
    // showDelete left at its default (false)
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders a labelled delete button, disabled when nothing is selected', () => {
    const fixture = mountDeleteOnly();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Delete selected elements');
    expect(btn.disabled).toBe(true);
  });

  it('enables when a node is selected and deletes the selection on click', async () => {
    const del = vi
      .spyOn(service, 'deleteElements')
      .mockResolvedValue({ deletedNodes: [], deletedEdges: [] });

    const fixture = mountDeleteOnly();
    store.setNodes([
      { id: 'a', position: { x: 0, y: 0 }, data: {}, selected: true },
      { id: 'b', position: { x: 10, y: 10 }, data: {} },
    ] as never);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    btn.click();

    expect(del).toHaveBeenCalledOnce();
    const arg = del.mock.calls[0][0] as { nodes: { id: string }[]; edges: unknown[] };
    expect(arg.nodes.map((n) => n.id)).toEqual(['a']);
    expect(arg.edges).toEqual([]);
  });

  it('excludes elements with deletable === false', () => {
    const del = vi
      .spyOn(service, 'deleteElements')
      .mockResolvedValue({ deletedNodes: [], deletedEdges: [] });

    const fixture = mountDeleteOnly();
    store.setNodes([
      { id: 'locked', position: { x: 0, y: 0 }, data: {}, selected: true, deletable: false },
    ] as never);
    fixture.detectChanges();

    // Selected, so the button is enabled...
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    // ...but the only selected node is non-deletable, so nothing is deleted.
    btn.click();
    expect(del).not.toHaveBeenCalled();
  });
});

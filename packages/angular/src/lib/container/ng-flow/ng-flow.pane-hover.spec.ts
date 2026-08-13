import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { FlowStore } from '../../services/flow-store.service';

/** jsdom implements neither of these; NgFlowComponent touches both on construction. */
class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('NgFlowComponent pane hover during gestures', () => {
  let fixture: ComponentFixture<NgFlowComponent>;
  let component: NgFlowComponent;
  let store: FlowStore;
  let leaves: MouseEvent[];
  let enters: MouseEvent[];

  const leaveEvent = new MouseEvent('mouseleave');
  const enterEvent = new MouseEvent('mouseenter');

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
    fixture = TestBed.createComponent(NgFlowComponent);
    component = fixture.componentInstance;
    store = fixture.debugElement.injector.get(FlowStore);
    leaves = [];
    enters = [];
    component.paneMouseLeave.subscribe((e) => leaves.push(e));
    component.paneMouseEnter.subscribe((e) => enters.push(e));
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
  });

  it('emits leave immediately when no gesture is active', () => {
    component.onPaneMouseLeave(leaveEvent);
    expect(leaves).toEqual([leaveEvent]);
  });

  it('emits enter normally when no latch is pending', () => {
    component.onPaneMouseEnter(enterEvent);
    expect(enters).toEqual([enterEvent]);
  });

  it('suppresses leave during a gesture and delivers it when the gesture ends', () => {
    store.nodeDragging.set(true);
    fixture.detectChanges();

    component.onPaneMouseLeave(leaveEvent);
    expect(leaves).toEqual([]);

    store.nodeDragging.set(false);
    fixture.detectChanges();

    expect(leaves).toEqual([leaveEvent]);
  });

  it('never delivers the leave if the pointer came back before the gesture ended', () => {
    store.nodeDragging.set(true);
    fixture.detectChanges();

    component.onPaneMouseLeave(leaveEvent);
    component.onPaneMouseEnter(enterEvent);

    store.nodeDragging.set(false);
    fixture.detectChanges();

    expect(leaves).toEqual([]);
  });

  it('suppresses the re-entry enter that pairs with a suppressed leave', () => {
    // The consumer never saw the leave, so they still believe the pointer is
    // over the pane. An enter here would be an unpaired duplicate.
    store.nodeDragging.set(true);
    fixture.detectChanges();

    component.onPaneMouseLeave(leaveEvent);
    component.onPaneMouseEnter(enterEvent);

    expect(enters).toEqual([]);
  });

  it('delivers the latched leave exactly once', () => {
    store.nodeDragging.set(true);
    fixture.detectChanges();
    component.onPaneMouseLeave(leaveEvent);

    store.nodeDragging.set(false);
    fixture.detectChanges();
    store.nodeDragging.set(true);
    fixture.detectChanges();
    store.nodeDragging.set(false);
    fixture.detectChanges();

    expect(leaves).toEqual([leaveEvent]);
  });

  it('latches for every gesture source', () => {
    const sources: Array<[string, () => void, () => void]> = [
      ['paneDragging', () => store.paneDragging.set(true), () => store.paneDragging.set(false)],
      ['userSelectionActive', () => store.userSelectionActive.set(true), () => store.userSelectionActive.set(false)],
      ['nodeResizing', () => store.nodeResizing.set(true), () => store.nodeResizing.set(false)],
    ];

    // Never reassign `leaves` — the subscription above closes over the original
    // array, so a fresh array would silently stop receiving emissions and every
    // assertion after it would pass vacuously. Compare counts instead.
    for (const [name, start, end] of sources) {
      const before = leaves.length;

      start();
      fixture.detectChanges();
      component.onPaneMouseLeave(leaveEvent);
      expect(leaves.length, `${name}: leave must be suppressed mid-gesture`).toBe(before);

      end();
      fixture.detectChanges();
      expect(leaves.length, `${name}: leave must be delivered at gesture end`).toBe(before + 1);
    }
  });
});

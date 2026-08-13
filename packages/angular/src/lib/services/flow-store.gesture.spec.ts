import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';

describe('FlowStore.gestureActive', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  it('is false with no gesture in progress', () => {
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while the pane is being dragged', () => {
    store.paneDragging.set(true);
    expect(store.gestureActive()).toBe(true);
    store.paneDragging.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a box selection is active', () => {
    store.userSelectionActive.set(true);
    expect(store.gestureActive()).toBe(true);
    store.userSelectionActive.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a node is being dragged', () => {
    store.nodeDragging.set(true);
    expect(store.gestureActive()).toBe(true);
    store.nodeDragging.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a node is being resized', () => {
    store.nodeResizing.set(true);
    expect(store.gestureActive()).toBe(true);
    store.nodeResizing.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a connection is in progress', () => {
    // ConnectionState is a discriminated union: NoConnection has
    // `inProgress: false`, ConnectionInProgress has `inProgress: true` plus
    // several required fields. Spreading the initial value does NOT produce a
    // valid ConnectionInProgress, so cast the whole literal.
    store.connection.set({ inProgress: true } as unknown as ReturnType<typeof store.connection>);
    expect(store.gestureActive()).toBe(true);
  });

  it('stays true while any one source is still active', () => {
    store.paneDragging.set(true);
    store.nodeDragging.set(true);
    store.paneDragging.set(false);
    expect(store.gestureActive()).toBe(true);
    store.nodeDragging.set(false);
    expect(store.gestureActive()).toBe(false);
  });
});

describe('FlowStore.nodeDragging via updateNodePositions', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  it('tracks the dragging flag XYDrag passes through', () => {
    // XYDrag calls updateNodePositions(items, true) per frame while dragging
    // and updateNodePositions(items, false) exactly once at drag end.
    expect(store.nodeDragging()).toBe(false);
    store.updateNodePositions(new Map(), true);
    expect(store.nodeDragging()).toBe(true);
    store.updateNodePositions(new Map(), false);
    expect(store.nodeDragging()).toBe(false);
  });

  it('defaults to not-dragging when the flag is omitted', () => {
    store.nodeDragging.set(true);
    store.updateNodePositions(new Map());
    expect(store.nodeDragging()).toBe(false);
  });
});

describe('NodeResizerComponent nodeResizing flag', () => {
  it('sets the flag on resize start and clears it on resize end', async () => {
    const { NodeResizerComponent } = await import('../components/node-resizer/node-resizer.component');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeResizerComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    const store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeResizerComponent);
    fixture.componentRef.setInput('nodeId', 'n1');
    fixture.detectChanges();

    expect(store.nodeResizing()).toBe(false);

    // The real scenario: proximity-gated chrome unmounts the resizer WHILE a
    // resize is in flight. Without the ngOnDestroy clear, the flag strands at
    // true and every later paneMouseLeave is suppressed forever.
    store.nodeResizing.set(true);
    fixture.destroy();
    expect(store.nodeResizing()).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import type { Viewport } from '@angflow/system';
import { NgFlowComponent } from './ng-flow.component';

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('NgFlowComponent fitView startup', () => {
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
    vi.useRealTimers();
  });

  it('does not move the viewport from a timer before nodes are measured', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'fitView', true);
    setSignalInput(inst, 'nodesModel', [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 400, y: 300 }, data: {} },
    ]);
    fixture.detectChanges();

    const before = inst.store.transform();
    vi.advanceTimersByTime(60);

    // Nodes are unmeasured, so the queued fitView must still be pending and
    // no timer fallback may guess dimensions and jump the viewport.
    expect(inst.store.transform()).toEqual(before);
    expect(inst.store.fitViewQueued()).toBe(true);
  });

  it('seeds store width/height synchronously in ngAfterViewInit (before the ResizeObserver fires)', () => {
    // The ResizeObserver is stubbed to never fire (FakeResizeObserver). React's
    // useResizeHandler reads getDimensions() synchronously on mount before any
    // RO callback; without that, the container dimensions stay 0 and a queued
    // init fitView resolves against a zero-extent viewport — getViewportForBounds
    // returns zoom 0, which clamps to minZoom (0.5) and emits NaN transforms
    // through the animated interpolateZoom. Seed dimensions synchronously instead.
    const sizeSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(800);
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(600);
    try {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      fixture.detectChanges(); // runs ngAfterViewInit

      // FakeResizeObserver never delivers dims, so these are 0 unless seeded
      // synchronously from getBoundingClientRect/offset* in ngAfterViewInit.
      expect(inst.store.width()).toBe(800);
      expect(inst.store.height()).toBe(600);
    } finally {
      sizeSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });
});

describe('NgFlowComponent controlled [viewport]', () => {
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

  afterEach(() => vi.unstubAllGlobals());

  it('applies the [viewport] input to the store', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'viewportModel', { x: 100, y: 50, zoom: 2 } as Viewport);
    fixture.detectChanges();

    expect(inst.store.viewport()).toEqual({ x: 100, y: 50, zoom: 2 });
  });

  it('applies later [viewport] changes', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'viewportModel', { x: 0, y: 0, zoom: 1 } as Viewport);
    fixture.detectChanges();

    setSignalInput(inst, 'viewportModel', { x: -25, y: 10, zoom: 1.5 } as Viewport);
    fixture.detectChanges();

    expect(inst.store.viewport()).toEqual({ x: -25, y: 10, zoom: 1.5 });
  });

  it('skips re-applying an equal viewport (no controlled-mode feedback loop)', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'viewportModel', { x: 100, y: 50, zoom: 2 } as Viewport);
    fixture.detectChanges();

    const pz = inst.store.panZoom();
    expect(pz).not.toBeNull();
    const syncSpy = vi.spyOn(pz!, 'syncViewport');

    // Same values, new object — exactly what a (viewportChange) → [viewport]
    // round-trip re-binds.
    setSignalInput(inst, 'viewportModel', { x: 100, y: 50, zoom: 2 } as Viewport);
    fixture.detectChanges();

    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('does not bump the store version (transform writes are version-free)', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    fixture.detectChanges();
    const v0 = inst.store.version();

    setSignalInput(inst, 'viewportModel', { x: 70, y: 30, zoom: 1.25 } as Viewport);
    fixture.detectChanges();

    expect(inst.store.viewport()).toEqual({ x: 70, y: 30, zoom: 1.25 });
    expect(inst.store.version()).toBe(v0);
  });
});

describe('NgFlowComponent uncontrolled mode', () => {
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

  afterEach(() => vi.unstubAllGlobals());

  it('renders [defaultNodes] when [nodes] is unbound (uncontrolled mode)', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    // Bind defaultNodes only; leave [nodes] unbound. Previously the [nodes] input
    // defaulted to [] and the sync effect wiped the defaults on first CD.
    setSignalInput(inst, 'defaultNodes', [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 100, y: 100 }, data: {} },
    ]);
    fixture.detectChanges();

    expect(inst.store.nodes().length).toBe(2);
    expect(inst.store.nodes().map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('an explicit empty [nodes] binding still controls (stays empty)', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'defaultNodes', [{ id: 'a', position: { x: 0, y: 0 }, data: {} }]);
    setSignalInput(inst, 'nodesModel', []); // controlled empty
    fixture.detectChanges();

    expect(inst.store.nodes().length).toBe(0);
  });
});

describe('NgFlowComponent initial fitView landed transform', () => {
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

  afterEach(() => vi.unstubAllGlobals());

  it('lands the fitted transform in the store and keeps it in sync with d3', async () => {
    const sizeSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
    try {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      setSignalInput(inst, 'fitView', true);
      // Pre-measured nodes (as from a restored toObject() serialization) so
      // nodesInitialized is true and the queued fit resolves during setPanZoom().
      setSignalInput(inst, 'nodesModel', [
        { id: 'a', position: { x: 0, y: 0 }, measured: { width: 100, height: 50 }, data: {} },
        { id: 'b', position: { x: 600, y: 400 }, measured: { width: 100, height: 50 }, data: {} },
      ]);
      fixture.detectChanges();
      // resolveFitView writes the transform in a microtask after the async fit.
      await new Promise((r) => setTimeout(r, 0));

      const t = inst.store.transform();
      // The fit must have landed — not the identity transform.
      expect(t).not.toEqual([0, 0, 1]);

      // Store transform must match d3's internal transform (no desync).
      const pz = inst.store.panZoom()!;
      const vp = pz.getViewport();
      expect(t[0]).toBeCloseTo(vp.x, 5);
      expect(t[1]).toBeCloseTo(vp.y, 5);
      expect(t[2]).toBeCloseTo(vp.zoom, 5);
    } finally {
      sizeSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });
});

describe('NgFlowComponent selectionChange output', () => {
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

  afterEach(() => vi.unstubAllGlobals());

  it('emits (selectionChange) when a node becomes selected', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'nodesModel', [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 100, y: 100 }, data: {} },
    ]);
    fixture.detectChanges();

    const events: { nodes: unknown[]; edges: unknown[] }[] = [];
    inst.selectionChange.subscribe((e) => events.push(e));

    inst.store.setNodes([
      { id: 'a', position: { x: 0, y: 0 }, data: {}, selected: true },
      { id: 'b', position: { x: 100, y: 100 }, data: {} },
    ] as never);
    fixture.detectChanges();

    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1];
    expect(last.nodes.length).toBe(1);
    expect((last.nodes[0] as { id: string }).id).toBe('a');
  });
});

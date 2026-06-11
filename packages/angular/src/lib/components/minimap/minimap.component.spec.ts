/**
 * MiniMapComponent color-input tests.
 *
 * Regression coverage for the "minimap color inputs are dead" bug: the node
 * and mask colors were bound via `[attr.fill]` (an SVG presentation attribute),
 * which the bundled stylesheet's `.xy-flow__minimap-node { fill: … }` rule
 * always overrides — a CSS `fill` *property* beats a `fill` *attribute*. The
 * fix binds them as inline `[style.fill]` (inline styles win over stylesheet
 * rules) and defaults the color inputs to `undefined` so the CSS-variable
 * theming still applies when the user leaves them unset.
 *
 * Like the other component specs we drive signal inputs directly via ɵSIGNAL
 * (JIT does not populate ɵcmp.inputs from signal `input()` declarations).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { XYMinimap, type PanZoomInstance } from '@angflow/system';
import { MiniMapComponent } from './minimap.component';
import { FlowStore } from '../../services/flow-store.service';

// Spy handle the factory closes over, so each test can read the latest instance.
const minimapSpy = {
  update: vi.fn(),
  destroy: vi.fn(),
  pointer: vi.fn(() => [123, 456] as [number, number]),
};

vi.mock('@angflow/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angflow/system')>();
  return {
    ...actual,
    XYMinimap: vi.fn(() => minimapSpy),
  };
});

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

function createMinimap() {
  const fixture = TestBed.createComponent(MiniMapComponent);
  return fixture;
}

describe('MiniMapComponent color inputs', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([
      { id: 'n1', type: 'orchestrator', position: { x: 0, y: 0 }, data: {} },
    ] as never);
  });

  function nodeRect(fixture: ReturnType<typeof createMinimap>): SVGRectElement {
    const rect = fixture.nativeElement.querySelector('rect.xy-flow__minimap-node');
    expect(rect).toBeTruthy();
    return rect as SVGRectElement;
  }

  it('applies a string nodeColor as an inline style (so it beats the stylesheet)', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'nodeColor', '#2563eb');
    fixture.detectChanges();

    const rect = nodeRect(fixture);
    // jsdom normalizes hex colors to rgb() in inline styles.
    expect(rect.style.fill).toBe('rgb(37, 99, 235)');
  });

  it('applies a per-node nodeColor function as an inline style', () => {
    const fixture = createMinimap();
    setSignalInput(
      fixture.componentInstance,
      'nodeColor',
      (n: { type?: string }) => (n.type === 'orchestrator' ? '#ff0000' : '#00ff00')
    );
    fixture.detectChanges();

    const rect = nodeRect(fixture);
    expect(rect.style.fill).toBe('rgb(255, 0, 0)');
  });

  it('applies a string nodeStrokeColor as an inline style', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'nodeStrokeColor', '#123456');
    fixture.detectChanges();

    const rect = nodeRect(fixture);
    expect(rect.style.stroke).toBe('rgb(18, 52, 86)');
  });

  it('leaves the node fill to CSS (no inline style) when nodeColor is unset', () => {
    const fixture = createMinimap();
    fixture.detectChanges();

    const rect = nodeRect(fixture);
    // Unset → defer to the stylesheet (incl. dark-mode theming), so no inline fill.
    expect(rect.style.fill).toBe('');
  });

  it('applies a string maskColor as an inline style on the mask path', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'maskColor', 'rgba(10, 20, 30, 0.5)');
    fixture.detectChanges();

    const path = fixture.nativeElement.querySelector('path.xy-flow__minimap-mask') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.style.fill).toBe('rgba(10, 20, 30, 0.5)');
  });

  it('renders the mask path (deferring fill to CSS) when maskColor is unset', () => {
    const fixture = createMinimap();
    fixture.detectChanges();

    const path = fixture.nativeElement.querySelector('path.xy-flow__minimap-mask') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.style.fill).toBe('');
  });
});

describe('MiniMapComponent excludes collapsed-hidden nodes', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
  });

  it('omits descendants of a collapsed group from minimapNodes', () => {
    store.setNodes([
      { id: 'g', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'a', position: { x: 0, y: 0 }, data: {}, parentId: 'g' },
      { id: 'x', position: { x: 0, y: 0 }, data: {} },
    ] as never);
    const fixture = createMinimap();
    const ids = fixture.componentInstance.minimapNodes().map((n) => n.id).sort();
    expect(ids).toEqual(['g', 'x']);
  });
});

describe('MiniMapComponent viewport indicator reacts to transform writes', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never);
  });

  it('REGRESSION: viewport indicator still reacts to pure transform writes', () => {
    const fixture = createMinimap();
    fixture.detectChanges();
    const viewBoxBefore = fixture.componentInstance.viewBox();
    const maskBefore = fixture.componentInstance.maskPath();

    store.transform.set([-250, -180, 1.6]); // no bump involved

    expect(fixture.componentInstance.viewBox()).not.toBe(viewBoxBefore);
    expect(fixture.componentInstance.maskPath()).not.toBe(maskBefore);
  });
});

/** Minimal panZoom stub: only the members XYMinimap/MiniMap touch. */
function fakePanZoom(): PanZoomInstance {
  return {
    setViewportConstrained: vi.fn(),
    scaleTo: vi.fn(),
    setViewport: vi.fn(),
    syncViewport: vi.fn(),
    setScaleExtent: vi.fn(),
    setTranslateExtent: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  } as unknown as PanZoomInstance;
}

describe('MiniMapComponent adopts XYMinimap', () => {
  let store: FlowStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never);
  });

  it('does NOT create the XYMinimap instance until panZoom exists', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      // panZoom() is still null → guard effect waits → factory not called.
      expect(XYMinimap).not.toHaveBeenCalled();
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('creates the XYMinimap instance once panZoom is set, and calls update()', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();

      expect(XYMinimap).toHaveBeenCalledTimes(1);
      const params = (XYMinimap as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(params.domNode).toBeInstanceOf(SVGSVGElement);
      expect(typeof params.getTransform).toBe('function');
      expect(typeof params.getViewScale).toBe('function');
      // getTransform returns the live store transform.
      store.transform.set([3, 4, 1.5]);
      expect(params.getTransform()).toEqual([3, 4, 1.5]);

      expect(minimapSpy.update).toHaveBeenCalled();
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('forwards the exact update params (defaults: pannable/zoomable false, zoomStep 1)', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.setTranslateExtent([[-100, -200], [300, 400]]);
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();

      const lastArgs = minimapSpy.update.mock.calls.at(-1)![0];
      expect(lastArgs).toEqual({
        translateExtent: [[-100, -200], [300, 400]],
        width: 800,
        height: 600,
        inversePan: false,
        zoomStep: 1,
        pannable: false,
        zoomable: false,
      });
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('re-invokes update() with the new value when an input changes (extent clamp / inversePan / pannable / zoomable / zoomStep)', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();
      minimapSpy.update.mockClear();

      setSignalInput(fixture.componentInstance, 'pannable', true);
      setSignalInput(fixture.componentInstance, 'zoomable', true);
      setSignalInput(fixture.componentInstance, 'inversePan', true);
      setSignalInput(fixture.componentInstance, 'zoomStep', 25);
      fixture.detectChanges();
      await fixture.whenStable();

      const lastArgs = minimapSpy.update.mock.calls.at(-1)![0];
      expect(lastArgs.pannable).toBe(true);
      expect(lastArgs.zoomable).toBe(true);
      expect(lastArgs.inversePan).toBe(true);
      expect(lastArgs.zoomStep).toBe(25);
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('re-invokes update() when the store translateExtent changes (extent clamp wiring)', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();
      minimapSpy.update.mockClear();

      store.setTranslateExtent([[0, 0], [500, 500]]);
      fixture.detectChanges();
      await fixture.whenStable();

      const lastArgs = minimapSpy.update.mock.calls.at(-1)![0];
      expect(lastArgs.translateExtent).toEqual([[0, 0], [500, 500]]);
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('tolerates a zero-size minimap (display:none) — update() still called, no throw', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      // Force the container to zero box.
      fixture.nativeElement.querySelector('.ng-flow__minimap')!.setAttribute('style', 'display:none');
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
      await fixture.whenStable();
      expect(minimapSpy.update).toHaveBeenCalled();
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('calls destroy() on teardown', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    store.panZoom.set(fakePanZoom());
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();
    fixture.nativeElement.remove();
    expect(minimapSpy.destroy).toHaveBeenCalledTimes(1);
  });
});

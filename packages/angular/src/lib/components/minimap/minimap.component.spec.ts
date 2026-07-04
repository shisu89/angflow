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
import { provideZonelessChangeDetection, ɵSIGNAL, Component as NgComponent, input as ngInput } from '@angular/core';
import { XYMinimap, type PanZoomInstance } from '@angflow/system';
import { MiniMapComponent } from './minimap.component';
import { FlowStore } from '../../services/flow-store.service';

// ── Stub custom minimap-node component (top-level in the spec file) ──
@NgComponent({
  selector: 'test-mm-node',
  standalone: true,
  template: `<rect class="test-mm-node" [attr.x]="x()" [attr.y]="y()"
    [attr.width]="width()" [attr.height]="height()" [attr.rx]="borderRadius()"
    [attr.data-id]="id()" [attr.data-selected]="selected()"
    [attr.data-color]="color()" [attr.data-stroke]="strokeColor()"
    [attr.data-stroke-width]="strokeWidth()" [attr.data-class]="className()"
    [attr.shape-rendering]="shapeRendering()" />`,
})
class TestMiniMapNode {
  readonly id = ngInput<string>('');
  readonly x = ngInput<number>(0);
  readonly y = ngInput<number>(0);
  readonly width = ngInput<number>(0);
  readonly height = ngInput<number>(0);
  readonly selected = ngInput<boolean>(false);
  readonly color = ngInput<string | undefined>(undefined);
  readonly strokeColor = ngInput<string | undefined>(undefined);
  readonly strokeWidth = ngInput<number | undefined>(undefined);
  readonly borderRadius = ngInput<number>(5);
  readonly shapeRendering = ngInput<string>('');
  readonly className = ngInput<string>('');
}

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

  it('omits node.hidden nodes from minimapNodes (parity with the node renderer)', () => {
    store.setNodes([
      { id: 'visible', position: { x: 0, y: 0 }, data: {} },
      { id: 'ghost', position: { x: 10, y: 10 }, data: {}, hidden: true },
    ] as never);
    const fixture = createMinimap();
    const ids = fixture.componentInstance.minimapNodes().map((n) => n.id).sort();
    expect(ids).toEqual(['visible']);
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

  it('click-to-center: pointer() is called with the SVG node and forwards returned flow coordinates to setCenter', async () => {
    // PINS THE CONTRACT: pointer() must receive the SVG element (not the outer
    // div) so d3 maps through the SVG viewBox → flow coordinates. The mock
    // returns [123, 456]; setCenter must be called with those exact values at
    // the current zoom and the 300 ms duration.
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();

      minimapSpy.pointer.mockClear();
      const setCenterSpy = vi.spyOn(store, 'setCenter').mockResolvedValue(undefined as never);

      // Enable pannable so onMinimapClick actually calls setCenter.
      setSignalInput(fixture.componentInstance, 'pannable', true);
      fixture.detectChanges();

      // Dispatch a synthetic click on the SVG element (not the outer div).
      const svgEl = fixture.nativeElement.querySelector('svg.xy-flow__minimap-svg') as SVGSVGElement;
      expect(svgEl).toBeTruthy();
      const clickEvent = new MouseEvent('click', { bubbles: true });
      svgEl.dispatchEvent(clickEvent);

      // pointer() must have been called with (event, svgNode) so that jsdom
      // and real browsers both yield viewBox = flow coordinates.
      expect(minimapSpy.pointer).toHaveBeenCalledTimes(1);
      const pointerCall = minimapSpy.pointer.mock.calls[0] as unknown as [MouseEvent, SVGSVGElement];
      expect(pointerCall[0]).toBe(clickEvent);
      expect(pointerCall[1]).toBe(svgEl);

      // The mock returns [123, 456]; setCenter must receive those coordinates.
      expect(setCenterSpy).toHaveBeenCalledWith(123, 456, { zoom: store.transform()[2], duration: 300 });
    } finally {
      fixture.nativeElement.remove();
    }
  });
});

// ── Appended describe block ──
describe('MiniMapComponent nodeComponent wiring', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent, TestMiniMapNode],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([
      { id: 'n1', type: 'orchestrator', position: { x: 10, y: 20 }, data: {}, selected: true },
    ] as never);
  });

  it('renders the default <rect> (no custom component) when nodeComponent is unset', () => {
    const fixture = createMinimap();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('rect.xy-flow__minimap-node')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('rect.test-mm-node')).toBeNull();
  });

  it('renders the custom nodeComponent with the React MiniMapNode prop set', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'nodeComponent', TestMiniMapNode);
    setSignalInput(fixture.componentInstance, 'nodeColor', '#abcdef');
    setSignalInput(fixture.componentInstance, 'nodeStrokeColor', '#112233');
    setSignalInput(fixture.componentInstance, 'nodeStrokeWidth', 3);
    setSignalInput(fixture.componentInstance, 'nodeBorderRadius', 7);
    setSignalInput(fixture.componentInstance, 'nodeClassName', 'my-node');
    fixture.detectChanges();

    const rect = fixture.nativeElement.querySelector('rect.test-mm-node') as SVGRectElement;
    expect(rect).toBeTruthy();
    // Default <rect> path must NOT also render.
    expect(fixture.nativeElement.querySelector('rect.xy-flow__minimap-node')).toBeNull();

    expect(rect.getAttribute('data-id')).toBe('n1');
    expect(rect.getAttribute('x')).toBe('10');
    expect(rect.getAttribute('y')).toBe('20');
    expect(rect.getAttribute('data-selected')).toBe('true');
    expect(rect.getAttribute('data-color')).toBe('#abcdef');
    expect(rect.getAttribute('data-stroke')).toBe('#112233');
    expect(rect.getAttribute('data-stroke-width')).toBe('3');
    expect(rect.getAttribute('rx')).toBe('7');
    expect(rect.getAttribute('data-class')).toBe('my-node');
    expect(rect.getAttribute('shape-rendering')).toBeTruthy();
  });

  it('excludes collapsed-hidden nodes from the custom-component path too', () => {
    store.setNodes([
      { id: 'g', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'a', position: { x: 0, y: 0 }, data: {}, parentId: 'g' },
      { id: 'x', position: { x: 0, y: 0 }, data: {} },
    ] as never);
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'nodeComponent', TestMiniMapNode);
    fixture.detectChanges();

    const ids = Array.from(fixture.nativeElement.querySelectorAll('rect.test-mm-node'))
      .map((r) => (r as Element).getAttribute('data-id'))
      .sort();
    expect(ids).toEqual(['g', 'x']);
  });
});

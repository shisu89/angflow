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
import { MiniMapComponent } from './minimap.component';
import { FlowStore } from '../../services/flow-store.service';

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

describe('MiniMapComponent pan/zoom interactions do not bump the store version', () => {
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

  it('wheel zoom updates the transform without bumping version', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'zoomable', true);
    fixture.detectChanges();

    const v0 = store.version();
    const t0 = store.transform();
    fixture.componentInstance.onMinimapWheel(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));

    expect(store.transform()).not.toEqual(t0);
    expect(store.version()).toBe(v0);
  });

  it('drag pan updates the transform without bumping version', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'pannable', true);
    fixture.detectChanges();

    const v0 = store.version();
    fixture.componentInstance.onMinimapMouseDown(new MouseEvent('mousedown'));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 90 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(store.transform()).not.toEqual([0, 0, 1]);
    expect(store.version()).toBe(v0);
  });

  it('click-pan animation frames update the transform without bumping version', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    const fixture = createMinimap();
    // Attach to the live DOM so the #minimapContainer viewChild resolves and
    // the click handler actually schedules the pan animation (otherwise it
    // returns early at the container guard and never reaches the rAF closure).
    document.body.appendChild(fixture.nativeElement);
    try {
      setSignalInput(fixture.componentInstance, 'pannable', true);
      fixture.detectChanges();
      // Move the viewport off-origin so the pan target differs and the frame
      // produces an observable transform change.
      store.transform.set([10, 10, 1]);

      // Drain any rAF callbacks the framework scheduled before the click so the
      // next frame we run is unambiguously the pan animation closure.
      frames.length = 0;

      const v0 = store.version();
      fixture.componentInstance.onMinimapClick(new MouseEvent('click', { clientX: 100, clientY: 75 }));
      // The animation must actually have been scheduled — otherwise the frame
      // closure (which is what we're asserting doesn't bump) never runs and the
      // version assertion below would pass vacuously.
      expect(frames.length).toBeGreaterThan(0);
      nowSpy.mockReturnValue(50);
      frames.shift()!(50); // run one animation frame: writes transform, must not bump

      expect(store.version()).toBe(v0);
    } finally {
      fixture.nativeElement.remove();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('REGRESSION: viewport indicator still reacts to pure transform writes', () => {
    const fixture = createMinimap();
    fixture.detectChanges();
    const v0 = store.version();
    const viewBoxBefore = fixture.componentInstance.viewBox();
    const maskBefore = fixture.componentInstance.maskPath();

    store.transform.set([-250, -180, 1.6]); // no bump involved

    expect(store.version()).toBe(v0);
    expect(fixture.componentInstance.viewBox()).not.toBe(viewBoxBefore);
    expect(fixture.componentInstance.maskPath()).not.toBe(maskBefore);
  });
});

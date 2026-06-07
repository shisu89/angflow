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
import { describe, it, expect, beforeEach } from 'vitest';
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

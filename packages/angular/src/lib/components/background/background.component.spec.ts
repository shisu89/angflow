/**
 * BackgroundComponent tests.
 *
 * Fill: regression coverage for the "lines background renders as triangles"
 * bug. The `lines` and `cross` patterns draw a `<path>` with only a `stroke`.
 * An SVG `<path>` fills with black by default, and nothing in the stylesheet
 * sets `fill: none` for `.xy-flow__background-pattern` (only edge/connection
 * paths get that rule), so an open path would fill. The pattern paths carry
 * `fill="none"`.
 *
 * Geometry: pattern ids, x/y, patternTransform and shapes as upstream
 * `Background.tsx` / `Patterns.tsx`; colours travel as upstream's
 * `--xy-background(-pattern)-color-props` custom properties.
 *
 * Like the other component specs we drive signal inputs directly via ɵSIGNAL
 * (JIT does not populate ɵcmp.inputs from signal `input()` declarations).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { BackgroundComponent } from './background.component';
import { FlowStore } from '../../services/flow-store.service';

function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

describe('BackgroundComponent pattern fill', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BackgroundComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
  });

  function render(variant: 'dots' | 'lines' | 'cross') {
    const fixture = TestBed.createComponent(BackgroundComponent);
    setSignalInput(fixture.componentInstance, 'variant', variant);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the lines pattern with fill="none" so it does not fill as a triangle', () => {
    const fixture = render('lines');
    const path = fixture.nativeElement.querySelector('path.xy-flow__background-pattern.lines') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.getAttribute('fill')).toBe('none');
  });

  it('renders the cross pattern with fill="none"', () => {
    const fixture = render('cross');
    const path = fixture.nativeElement.querySelector('path.xy-flow__background-pattern.cross') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.getAttribute('fill')).toBe('none');
  });
});

/**
 * Pattern ids, x/y and patternTransform as upstream `Background.tsx`, and the
 * upstream `DotPattern` / `LinePattern` shapes (Open question 4: full parity).
 */
describe('BackgroundComponent pattern geometry', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BackgroundComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.rfId.set('flow-a');
  });

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(BackgroundComponent);
    for (const [k, v] of Object.entries(inputs)) setSignalInput(fixture.componentInstance, k, v);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const pattern = el.querySelector('pattern') as SVGPatternElement;
    const rects = [...el.querySelectorAll('rect')];
    return { fixture, el, pattern, fillRect: rects[rects.length - 1] };
  }

  it('ids the pattern pattern-<flowId><id> and fills the rect with it', () => {
    const { pattern, fillRect, el } = render({ bgId: '0' });
    expect(el.querySelectorAll('pattern').length).toBe(1);
    expect(pattern.getAttribute('id')).toBe('pattern-flow-a0');
    expect(fillRect.getAttribute('fill')).toBe('url(#pattern-flow-a0)');
  });

  it('ids the pattern pattern-<flowId> without an id', () => {
    const { pattern, fillRect } = render();
    expect(pattern.getAttribute('id')).toBe('pattern-flow-a');
    expect(fillRect.getAttribute('fill')).toBe('url(#pattern-flow-a)');
  });

  it('centres the default dots by half the gap at zoom 1, transform 0', () => {
    const { pattern } = render();
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-10,-10)');
    expect(pattern.getAttribute('x')).toBe('0');
    expect(pattern.getAttribute('y')).toBe('0');
    expect(pattern.getAttribute('width')).toBe('20');
    expect(pattern.getAttribute('height')).toBe('20');
  });

  it('adds the offset to the half-cell translation (lines, gap 100, offset 2)', () => {
    const { pattern } = render({ variant: 'lines', gap: 100, offset: 2 });
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-52,-52)');
  });

  it('uses the scaled size as the cross pattern dimension (size 6, offset 4)', () => {
    const { pattern } = render({ variant: 'cross', size: 6, offset: 4 });
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-7,-7)');
  });

  it('defaults the cross size to 6, and size 0 falls back to the default', () => {
    expect(render({ variant: 'cross' }).pattern.getAttribute('patternTransform')).toBe('translate(-3,-3)');
    expect(render({ variant: 'cross', size: 0 }).pattern.getAttribute('patternTransform')).toBe('translate(-3,-3)');
  });

  it('tracks the transform modulo the gap in x/y; the offset no longer feeds them', () => {
    store.transform.set([15, 7, 1]);
    const { pattern } = render({ gap: 20, offset: 3 });
    expect(pattern.getAttribute('x')).toBe('15');
    expect(pattern.getAttribute('y')).toBe('7');
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-13,-13)');
  });

  it('scales gap, size and offset with zoom', () => {
    store.transform.set([45, 30, 2]);
    const { pattern } = render({ gap: 20, offset: 1 });
    expect(pattern.getAttribute('x')).toBe('5');
    expect(pattern.getAttribute('y')).toBe('30');
    expect(pattern.getAttribute('width')).toBe('40');
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-22,-22)');
  });

  it('draws dots as upstream DotPattern: circle at (r, r) with r = scaledSize / 2', () => {
    store.transform.set([0, 0, 2]);
    const { el } = render({ size: 3 });
    const circle = el.querySelector('circle.xy-flow__background-pattern.dots') as SVGCircleElement;
    expect(circle.getAttribute('cx')).toBe('3');
    expect(circle.getAttribute('cy')).toBe('3');
    expect(circle.getAttribute('r')).toBe('3');
  });

  it('draws lines as upstream LinePattern over the scaled gap, with unscaled lineWidth 1', () => {
    store.transform.set([0, 0, 2]);
    const { el } = render({ variant: 'lines', gap: [50, 30] });
    const path = el.querySelector('path.xy-flow__background-pattern.lines') as SVGPathElement;
    expect(path.getAttribute('d')).toBe('M50 0 V60 M0 30 H100');
    expect(path.getAttribute('stroke-width')).toBe('1');
    expect(path.getAttribute('fill')).toBe('none');
  });

  it('draws the cross over scaledSize, and lineWidth 0 stays 0', () => {
    store.transform.set([0, 0, 2]);
    const { el } = render({ variant: 'cross', lineWidth: 0 });
    const path = el.querySelector('path.xy-flow__background-pattern.cross') as SVGPathElement;
    expect(path.getAttribute('d')).toBe('M6 0 V12 M0 6 H12');
    expect(path.getAttribute('stroke-width')).toBe('0');
  });

  it('keeps patternClassName on the shape', () => {
    const { el } = render({ variant: 'dots', patternClassName: 'extra' });
    const circle = el.querySelector('circle') as SVGCircleElement;
    expect(circle.classList.contains('extra')).toBe(true);
  });

  it('passes color and bgColor as upstream CSS custom properties, not fill/stroke attributes', () => {
    const { el } = render({ variant: 'lines', color: 'red', bgColor: 'blue' });
    expect(el.style.getPropertyValue('--xy-background-pattern-color-props')).toBe('red');
    expect(el.style.getPropertyValue('--xy-background-color-props')).toBe('blue');
    const path = el.querySelector('path') as SVGPathElement;
    expect(path.hasAttribute('stroke')).toBe(false);
    expect(el.querySelectorAll('rect').length).toBe(1);
  });

  it('leaves the colour properties unset without color/bgColor', () => {
    const { el } = render();
    expect(el.style.getPropertyValue('--xy-background-pattern-color-props')).toBe('');
    expect(el.style.getPropertyValue('--xy-background-color-props')).toBe('');
  });

  it('applies an uneven array offset per axis', () => {
    const { pattern } = render({ offset: [3, 7] });
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-13,-17)');
  });

  it('halves each axis of an array gap in patternTransform', () => {
    const { pattern } = render({ variant: 'lines', gap: [50, 30] });
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-25,-15)');
    expect(pattern.getAttribute('width')).toBe('50');
    expect(pattern.getAttribute('height')).toBe('30');
  });

  it('falls back to a 1px cell when the scaled gap is 0', () => {
    const { pattern } = render({ variant: 'lines', gap: 0 });
    expect(pattern.getAttribute('width')).toBe('1');
    expect(pattern.getAttribute('height')).toBe('1');
    expect(pattern.getAttribute('patternTransform')).toBe('translate(-0.5,-0.5)');
  });
});

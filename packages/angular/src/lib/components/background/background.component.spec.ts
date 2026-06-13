/**
 * BackgroundComponent fill tests.
 *
 * Regression coverage for the "lines background renders as triangles" bug: the
 * `lines` and `cross` patterns draw a `<path>` with only a `stroke`, no `fill`.
 * An SVG `<path>` fills with black by default, and nothing in the stylesheet
 * sets `fill: none` for `.xy-flow__background-pattern` (only edge/connection
 * paths get that rule). So the open `lines` path `M gap 0 L 0 0 0 gap` was
 * implicitly closed and filled as a triangle. The fix sets `fill="none"` on the
 * pattern paths.
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

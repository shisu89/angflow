/**
 * BaseEdgeComponent renders an edge label like upstream `BaseEdge`: an
 * `EdgeText` `<g>` inside its inline `<svg>`, only when `label` is set and
 * `labelX`/`labelY` are numbers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { BaseEdgeComponent } from './base-edge.component';
import { BezierEdgeComponent } from './bezier-edge.component';
import { StraightEdgeComponent } from './straight-edge.component';
import { StepEdgeComponent } from './step-edge.component';
import { SmoothStepEdgeComponent } from './smooth-step-edge.component';
import { SimpleBezierEdgeComponent } from './simple-bezier-edge.component';
import { Position } from '@angflow/system';

@Component({
  standalone: true,
  imports: [BaseEdgeComponent],
  template: `
    <ng-flow-base-edge
      path="M0,0 L100,100"
      [label]="label"
      [labelX]="labelX"
      [labelY]="labelY"
      [labelShowBg]="labelShowBg"
    />
  `,
})
class HostComponent {
  label: string | undefined = 'hi';
  labelX: number | undefined = 10;
  labelY: number | undefined = 20;
  labelShowBg: boolean | undefined = undefined;
}

describe('BaseEdgeComponent labels', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  async function render(patch: Partial<HostComponent> = {}): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(HostComponent);
    Object.assign(fixture.componentInstance, patch);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the label as SVG text inside its <svg> when label, labelX and labelY are set', async () => {
    const root = await render();
    const text = root.querySelector('svg g.xy-flow__edge-textwrapper text');
    expect(text).not.toBeNull();
    expect(text!.textContent?.trim()).toBe('hi');
    expect(root.querySelector('svg rect.xy-flow__edge-textbg')).not.toBeNull();
  });

  it('renders no label when labelX is not a number', async () => {
    const root = await render({ labelX: undefined });
    expect(root.querySelector('.xy-flow__edge-textwrapper')).toBeNull();
  });

  it('renders no label when there is no label text', async () => {
    const root = await render({ label: undefined });
    expect(root.querySelector('.xy-flow__edge-textwrapper')).toBeNull();
  });

  it('labelShowBg: false renders no background rect', async () => {
    const root = await render({ labelShowBg: false });
    expect(root.querySelector('.xy-flow__edge-textwrapper text')).not.toBeNull();
    expect(root.querySelector('rect.xy-flow__edge-textbg')).toBeNull();
  });
});

describe.each([
  ['bezier', BezierEdgeComponent],
  ['straight', StraightEdgeComponent],
  ['step', StepEdgeComponent],
  ['smooth-step', SmoothStepEdgeComponent],
  ['simple-bezier', SimpleBezierEdgeComponent],
] as const)('%s edge component label forwarding', (_name, Cmp) => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Cmp], providers: [provideZonelessChangeDetection()] });
  });

  function make(inputs: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(Cmp as never);
    const base = { sourceX: 0, sourceY: 0, targetX: 100, targetY: 100, sourcePosition: Position.Bottom, targetPosition: Position.Top };
    for (const [k, v] of Object.entries({ ...base, ...inputs })) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('forwards label, explicit labelX/labelY and style inputs', () => {
    const root = make({ label: 'fwd', labelX: 30, labelY: 40, labelShowBg: false, labelStyle: { fill: 'red' } });
    const text = root.querySelector('svg g.xy-flow__edge-textwrapper text');
    expect(text?.textContent?.trim()).toBe('fwd');
    expect(text?.getAttribute('style')).toContain('fill: red');
    expect(root.querySelector('rect.xy-flow__edge-textbg')).toBeNull();
    // bbox is zero in jsdom, so the transform is translate(x y).
    expect(root.querySelector('g.xy-flow__edge-textwrapper')?.getAttribute('transform')).toBe('translate(30 40)');
  });

  it('falls back to the path-generator anchor when labelX/labelY are unset', () => {
    const root = make({ label: 'auto' });
    const g = root.querySelector('g.xy-flow__edge-textwrapper');
    expect(g).not.toBeNull();
    // Symmetric (0,0)->(100,100) paths all have their anchor at the midpoint.
    expect(g!.getAttribute('transform')).toBe('translate(50 50)');
  });

  it('renders nothing without a label', () => {
    expect(make({}).querySelector('.xy-flow__edge-textwrapper')).toBeNull();
  });
});

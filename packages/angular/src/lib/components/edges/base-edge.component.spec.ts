/**
 * BaseEdgeComponent renders an edge label like upstream `BaseEdge`: an
 * `EdgeText` `<g>` inside its inline `<svg>`, only when `label` is set and
 * `labelX`/`labelY` are numbers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { BaseEdgeComponent } from './base-edge.component';

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

/**
 * Built-in edge labels render like upstream `EdgeText`: an SVG
 * `<g class="xy-flow__edge-textwrapper">` inside the edge's `<g data-id>`,
 * not an HTML overlay div that duplicates `data-id`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { BezierEdgeComponent } from '../../components/edges/bezier-edge.component';
import type { Edge } from '../../types';

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return { id: 'e1', source: 'a', target: 'b', label: 'hello', ...overrides };
}

describe('EdgeRendererComponent built-in edge labels', () => {
  let store: FlowStore;
  let fixture: ComponentFixture<EdgeRendererComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 200 } },
    ]);
    fixture = TestBed.createComponent(EdgeRendererComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  async function render(edge: Edge): Promise<void> {
    store.setEdges([edge]);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renders the label as SVG text inside the edge <g data-id>, with a single data-id element', async () => {
    await render(makeEdge());

    expect(root.querySelectorAll('[data-id="e1"]')).toHaveLength(1);
    const text = root.querySelector('g[data-id="e1"] g.xy-flow__edge-textwrapper text.xy-flow__edge-text');
    expect(text).not.toBeNull();
    expect(text!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(text!.textContent?.trim()).toBe('hello');
    expect(root.querySelector('.xy-flow__edge-label')).toBeNull();
    expect(root.querySelector('.xy-flow__edgelabel-renderer')).toBeNull();
  });

  it('draws the background rect by default, honouring labelBgPadding, labelBgBorderRadius and labelBgStyle', async () => {
    await render(makeEdge({ labelBgPadding: [6, 3], labelBgBorderRadius: 5, labelBgStyle: { fill: 'blue' } }));

    const rect = root.querySelector('g[data-id="e1"] rect.xy-flow__edge-textbg');
    expect(rect).not.toBeNull();
    expect(rect!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(rect!.getAttribute('x')).toBe('-6');
    expect(rect!.getAttribute('y')).toBe('-3');
    expect(rect!.getAttribute('rx')).toBe('5');
    expect(rect!.getAttribute('style')).toContain('fill: blue');
  });

  it('uses upstream defaults (padding [2, 4], radius 2) when the label options are unset', async () => {
    await render(makeEdge());

    const rect = root.querySelector('g[data-id="e1"] rect.xy-flow__edge-textbg');
    expect(rect!.getAttribute('x')).toBe('-2');
    expect(rect!.getAttribute('y')).toBe('-4');
    expect(rect!.getAttribute('rx')).toBe('2');
  });

  it('labelShowBg: false renders no background rect', async () => {
    await render(makeEdge({ labelShowBg: false }));

    expect(root.querySelector('g[data-id="e1"] text.xy-flow__edge-text')).not.toBeNull();
    expect(root.querySelector('rect.xy-flow__edge-textbg')).toBeNull();
  });

  it('labelStyle lands in the text element style', async () => {
    await render(makeEdge({ labelStyle: { fill: 'red' } }));

    const text = root.querySelector('g[data-id="e1"] text.xy-flow__edge-text');
    expect(text!.getAttribute('style')).toContain('fill: red');
  });

  it('renders no label wrapper for an edge without a label', async () => {
    await render(makeEdge({ label: undefined }));

    expect(root.querySelector('g[data-id="e1"]')).not.toBeNull();
    expect(root.querySelector('.xy-flow__edge-textwrapper')).toBeNull();
  });

  it('clicking the label selects its edge', async () => {
    await render(makeEdge());

    const text = root.querySelector('g[data-id="e1"] text.xy-flow__edge-text') as SVGTextElement;
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(store.selectedEdges().map((e) => e.id)).toEqual(['e1']);
  });

  it('a custom edge type mapped to BezierEdgeComponent renders exactly one label, inside the custom-edge overlay', async () => {
    fixture.componentRef.setInput('customEdgeTypes', { fancy: BezierEdgeComponent });
    await render(makeEdge({ type: 'fancy', label: 'custom' }));

    const labels = root.querySelectorAll('.xy-flow__edge-textwrapper');
    expect(labels).toHaveLength(1);
    expect(labels[0].closest('.ng-flow__custom-edge')).not.toBeNull();
    expect(labels[0].textContent?.trim()).toBe('custom');
    expect(labels[0].closest('.ng-flow__custom-edge')!.getAttribute('data-edge-label-for')).toBe('e1');
  });
});

/**
 * Edge renderer: defaultEdgeOptions merge, edge style normalization, label
 * styling props and built-in pathOptions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { getBezierPath, getSmoothStepPath, MarkerType, Position } from '@angflow/system';
import {
  EdgeRendererComponent,
  computeEdgeLabelStyle,
  computeEdgePathData,
  mergeDefaultEdgeOptions,
} from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Edge } from '../../types';

describe('mergeDefaultEdgeOptions', () => {
  it('returns the edge untouched without defaults', () => {
    const e: Edge = { id: 'e', source: 'a', target: 'b' };
    expect(mergeDefaultEdgeOptions(e, undefined)).toBe(e);
  });

  it('lets edge props override defaults; undefined edge props fall back', () => {
    const merged = mergeDefaultEdgeOptions(
      { id: 'e', source: 'a', target: 'b', type: 'step', animated: undefined },
      { type: 'smoothstep', animated: true, style: { stroke: 'red' } },
    );
    expect(merged).toMatchObject({ id: 'e', type: 'step', animated: true, style: { stroke: 'red' } });
  });
});

describe('computeEdgePathData pathOptions', () => {
  const base = {
    sourceX: 0, sourceY: 0, targetX: 200, targetY: 150,
    sourcePosition: Position.Bottom, targetPosition: Position.Top,
  };

  it('honors curvature for bezier edges', () => {
    // Curvature only bends the control points when the target sits "behind"
    // the source handle, so place the target above a bottom source handle.
    const back = { ...base, targetY: -150 };
    const d = computeEdgePathData({ ...back, type: 'default', pathOptions: { curvature: 0.9 } }).path;
    expect(d).toBe(getBezierPath({ ...back, curvature: 0.9 })[0]);
    expect(d).not.toBe(getBezierPath(back)[0]);
  });

  it('honors borderRadius / offset for smoothstep and offset for step', () => {
    const smooth = computeEdgePathData({ ...base, type: 'smoothstep', pathOptions: { borderRadius: 20, offset: 40 } }).path;
    expect(smooth).toBe(getSmoothStepPath({ ...base, borderRadius: 20, offset: 40 })[0]);
    const step = computeEdgePathData({ ...base, type: 'step', pathOptions: { offset: 40, borderRadius: 99 } }).path;
    expect(step).toBe(getSmoothStepPath({ ...base, offset: 40, borderRadius: 0 })[0]);
  });
});

describe('computeEdgeLabelStyle', () => {
  const e: Edge = { id: 'e', source: 'a', target: 'b', label: 'x' };

  it('emits nothing when no label props are set (stylesheet defaults apply)', () => {
    expect(computeEdgeLabelStyle(e)).toBeNull();
  });

  it('maps label props to inline CSS', () => {
    const css = computeEdgeLabelStyle({
      ...e,
      labelStyle: { fill: 'white', fontWeight: 700, fontSize: 12 },
      labelBgStyle: { fill: '#333', fillOpacity: 0.7 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 6,
    });
    expect(css).toBe(
      'padding: 4px 8px; border-radius: 6px; background-color: #333; fill-opacity: 0.7; color: white; font-weight: 700; font-size: 12px',
    );
  });

  it('labelShowBg: false removes the background', () => {
    expect(computeEdgeLabelStyle({ ...e, labelShowBg: false, labelBgStyle: { fill: 'red' } })).toBe(
      'background: transparent; padding: 0; border-radius: 0',
    );
  });
});

describe('EdgeRendererComponent rendering', () => {
  let store: FlowStore;
  let fixture: ComponentFixture<EdgeRendererComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.setNodes([
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 300, y: 200 }, data: {} },
    ]);
    fixture = TestBed.createComponent(EdgeRendererComponent);
  });

  async function render(): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('normalizes edge.style on the visible path', async () => {
    store.setEdges([{ id: 'e1', source: 'a', target: 'b', style: { stroke: '#f00', strokeWidth: 3, opacity: 0.5 } }]);
    const el = await render();
    const path = el.querySelector('path.xy-flow__edge-path') as SVGPathElement;
    expect(path.getAttribute('style')).toBe('stroke: #f00; stroke-width: 3px; opacity: 0.5');
  });

  it('applies defaultEdgeOptions to paths, classes and marker definitions', async () => {
    store.defaultEdgeOptions.set({
      animated: true,
      style: { strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
    });
    store.setEdges([
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a', animated: false, style: { stroke: 'blue' } },
    ]);
    const el = await render();

    const svgs = Array.from(el.querySelectorAll('svg.xy-flow__edge'));
    expect(svgs[0].classList.contains('animated')).toBe(true);
    expect(svgs[1].classList.contains('animated')).toBe(false);

    const paths = Array.from(el.querySelectorAll('path.xy-flow__edge-path'));
    expect(paths[0].getAttribute('style')).toBe('stroke-width: 2px');
    expect(paths[1].getAttribute('style')).toBe('stroke: blue');
    expect(paths[0].getAttribute('marker-end')).toMatch(/^url\('#.*arrowclosed/);

    const markers = el.querySelectorAll('defs marker');
    expect(markers.length).toBe(1);
    expect(markers[0].querySelector('polyline')?.getAttribute('stroke')).toBe('#b1b1b7');
  });

  it('keeps merged edge identity stable across renders (memo keeps hitting)', async () => {
    store.defaultEdgeOptions.set({ animated: true });
    store.setEdges([{ id: 'e1', source: 'a', target: 'b' }]);
    await render();
    const first = fixture.componentInstance.renderedEdges()[0];
    store.bumpVersion();
    await render();
    expect(fixture.componentInstance.renderedEdges()[0]).toBe(first);
  });

  it('renders label styling props on the HTML label', async () => {
    store.setEdges([
      { id: 'e1', source: 'a', target: 'b', label: 'hi', labelStyle: { fill: 'red', fontSize: 14 }, labelBgPadding: [6, 3] },
    ]);
    const el = await render();
    const label = el.querySelector('.xy-flow__edge-label') as HTMLElement;
    expect(label.style.color).toBe('red');
    expect(label.style.fontSize).toBe('14px');
    expect(label.style.padding).toBe('3px 6px');
    expect(label.style.position).toBe('absolute');
    expect(label.style.transform).toContain('translate(-50%, -50%)');
  });
});

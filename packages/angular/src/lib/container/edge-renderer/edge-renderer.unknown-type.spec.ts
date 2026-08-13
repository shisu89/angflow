import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { BezierEdgeComponent } from '../../components/edges/bezier-edge.component';
import { resetDevWarnDedupe } from '../../utils/dev-warn';

const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('EdgeRendererComponent unknown edge type', () => {
  let store: FlowStore;
  let component: EdgeRendererComponent;

  beforeEach(() => {
    resetDevWarnDedupe();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(EdgeRendererComponent);
    component = fixture.componentInstance;
  });

  it('reports error011 once for an unknown type, however many times it renders', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    // 'arrow' is the real mural-copy case: an arrowhead style was passed as an
    // edge type, so every connector silently rendered as a bezier for months.
    expect(component.getEdgeComponent('arrow')).toBe(BezierEdgeComponent);
    expect(component.getEdgeComponent('arrow')).toBe(BezierEdgeComponent);
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      '011',
      'Edge type "arrow" not found. Using fallback type "default".'
    );
  });

  it('reports each distinct unknown type separately', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getEdgeComponent('arrow');
    component.getEdgeComponent('line');
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('does not report for built-in or absent types', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    for (const t of ['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier']) {
      component.getEdgeComponent(t);
    }
    component.getEdgeComponent(undefined);
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it('does not emit during the synchronous call', () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getEdgeComponent('arrow');

    expect(onError).not.toHaveBeenCalled();
  });
});

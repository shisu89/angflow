import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NodeRendererComponent } from './node-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { DefaultNodeComponent } from '../../components/nodes/default-node.component';
import { resetDevWarnDedupe } from '../../utils/dev-warn';

/** Lets the queueMicrotask in getNodeComponent run before assertions. */
const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('NodeRendererComponent unknown node type', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    resetDevWarnDedupe();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  it('reports error003 once for an unknown type, however many times it renders', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      '003',
      'Node type "nope" not found. Using fallback type "default".'
    );
  });

  it('reports each distinct unknown type separately', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getNodeComponent('typoA');
    component.getNodeComponent('typoB');
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('does not report for built-in or absent types', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getNodeComponent('default');
    component.getNodeComponent('input');
    component.getNodeComponent(undefined);
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it('does not report for an agent-registered template type', async () => {
    const onError = vi.fn();
    store.onError.set(onError);
    store.nodeTemplates.set(new Map([['agentCard', { template: '<div></div>' } as never]]));

    component.getNodeComponent('agentCard');
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it('does not emit during the synchronous call', () => {
    // The emission must be deferred: getNodeComponent runs inside an
    // *ngComponentOutlet binding, and onError emits the public (error) output.
    const onError = vi.fn();
    store.onError.set(onError);

    component.getNodeComponent('nope');

    expect(onError).not.toHaveBeenCalled();
  });
});

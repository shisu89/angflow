/**
 * Node renderer per-node injector integration tests.
 *
 * Verifies that `NodeRendererComponent.getNodeInjector()` creates a per-node
 * Injector with `NG_FLOW_NODE_CONTEXT` provided, and that the provided context
 * reflects FlowStore state reactively. This closes the integration path that
 * the unit tests in `../../utils/inject-ng-flow-node.spec.ts` cannot exercise
 * (those tests provide the context manually via a stub).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NodeRendererComponent } from './node-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { NG_FLOW_NODE_CONTEXT } from '../../services/tokens';
import type { Node } from '../../types';

describe('NodeRendererComponent.getNodeInjector', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  it('provides NG_FLOW_NODE_CONTEXT on the per-node injector', () => {
    const node: Node = {
      id: 'n1',
      position: { x: 10, y: 20 },
      data: { label: 'Alpha' },
      type: 'default',
    };
    store.setNodes([node]);

    const injector = component.getNodeInjector('n1');
    const context = injector.get(NG_FLOW_NODE_CONTEXT);

    expect(context).toBeDefined();
    expect(context.id()).toBe('n1');
    expect(context.data()).toEqual({ label: 'Alpha' });
    expect(context.type()).toBe('default');
  });

  it('returns a cached injector on repeat calls for the same node id', () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' },
    ]);

    const first = component.getNodeInjector('n1');
    const second = component.getNodeInjector('n1');

    expect(first).toBe(second);
  });

  it('returns a context whose signals reflect FlowStore state changes', () => {
    store.setNodes([
      { id: 'n1', position: { x: 5, y: 5 }, data: { label: 'A' }, type: 'default' },
    ]);

    const context = component
      .getNodeInjector('n1')
      .get(NG_FLOW_NODE_CONTEXT);

    expect(context.data()).toEqual({ label: 'A' });
    expect(context.selected()).toBe(false);

    // Mutate the node in the store; the context's computed signals should re-read.
    store.setNodes([
      {
        id: 'n1',
        position: { x: 5, y: 5 },
        data: { label: 'B' },
        type: 'default',
        selected: true,
      },
    ]);

    expect(context.data()).toEqual({ label: 'B' });
    expect(context.selected()).toBe(true);
  });
});

describe('NodeRendererComponent.getNodeInputs / context isConnectable', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  it('getNodeInputs.isConnectable reflects store.nodesConnectable when node.connectable is unset', () => {
    const node: Node = { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' };
    store.setNodes([node]);
    const internal = store.nodeLookup.get('n1')!;

    store.nodesConnectable.set(true);
    expect(component.getNodeInputs(internal)['isConnectable']).toBe(true);

    store.nodesConnectable.set(false);
    expect(component.getNodeInputs(internal)['isConnectable']).toBe(false);
  });

  it('getNodeInputs.isConnectable honors per-node connectable override', () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default', connectable: false } as Node,
    ]);
    const internal = store.nodeLookup.get('n1')!;

    store.nodesConnectable.set(true);
    expect(component.getNodeInputs(internal)['isConnectable']).toBe(false);
  });

  it('context.isConnectable is reactive to store.nodesConnectable', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const context = component.getNodeInjector('n1').get(NG_FLOW_NODE_CONTEXT);

    store.nodesConnectable.set(true);
    expect(context.isConnectable()).toBe(true);

    store.nodesConnectable.set(false);
    expect(context.isConnectable()).toBe(false);
  });
});

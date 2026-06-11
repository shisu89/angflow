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
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NodeRendererComponent, computeNodeInputsKey } from './node-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { NG_FLOW_NODE_CONTEXT } from '../../services/tokens';
import { TemplateNodeComponent } from '../../components/nodes/template-node.component';
import { DefaultNodeComponent } from '../../components/nodes/default-node.component';
import { InputNodeComponent } from '../../components/nodes/input-node.component';
import type { Node, InternalNode } from '../../types';

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

describe('node template resolution', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;
  let fixture: ComponentFixture<NodeRendererComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  it('resolves a registered template type to TemplateNodeComponent', () => {
    store.nodeTemplates.set(new Map([['service', { title: 'svc' }]]));
    expect(component.getNodeComponent('service')).toBe(TemplateNodeComponent);
  });

  it('falls back to DefaultNodeComponent for unknown types', () => {
    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
  });

  it('host component types take precedence over registry templates', () => {
    store.nodeTemplates.set(new Map([['service', {}]]));
    fixture.componentRef.setInput('customNodeTypes', { service: DefaultNodeComponent });
    expect(component.getNodeComponent('service')).toBe(DefaultNodeComponent);
  });

  it('built-in types are never shadowed by registry templates', () => {
    store.nodeTemplates.set(new Map([['input', {}]]));
    expect(component.getNodeComponent('input')).toBe(InputNodeComponent);
  });

  it('unregistering live falls back to DefaultNodeComponent', () => {
    store.nodeTemplates.set(new Map([['service', {}]]));
    expect(component.getNodeComponent('service')).toBe(TemplateNodeComponent);
    store.nodeTemplates.set(new Map());
    expect(component.getNodeComponent('service')).toBe(DefaultNodeComponent);
  });

  it('busts the inputs cache when a template is registered for an existing type', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'service' } as Node]);
    const internal = store.nodeLookup.get('n1')!;
    const before = component.getNodeInputs(internal);
    store.nodeTemplates.set(new Map([['service', { title: 't' }]]));
    const after = component.getNodeInputs(internal);
    // A registry change switches the resolved component class, so cached inputs
    // (filtered against the old class) must not be reused.
    expect(after).not.toBe(before);
  });
});

describe('entry animation tracking', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;
  let fixture: ComponentFixture<NodeRendererComponent>;

  beforeEach(() => {
    // jsdom doesn't provide ResizeObserver/MutationObserver — stub them so
    // fixture.whenStable() (which triggers ngAfterViewInit) doesn't throw.
    if (typeof (globalThis as any).ResizeObserver === 'undefined') {
      (globalThis as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (typeof (globalThis as any).MutationObserver === 'undefined') {
      (globalThis as any).MutationObserver = class {
        observe() {}
        disconnect() {}
      };
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  const node = (id: string) => ({ id, data: {}, position: { x: 0, y: 0 } });

  it('does not mark the initial batch as entering', async () => {
    store.animate.set(true);
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable(); // flush effects
    expect(component.enteringNodeIds().size).toBe(0);
  });

  it('marks nodes added after the initial render as entering', async () => {
    store.animate.set(true);
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    expect(component.enteringNodeIds().has('b')).toBe(true);
    expect(component.enteringNodeIds().has('a')).toBe(false);
  });

  it('does nothing when animation is disabled', async () => {
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    expect(component.enteringNodeIds().size).toBe(0);
  });

  it('clears the entering flag when its enter animation ends', async () => {
    store.animate.set(true);
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    component.onNodeAnimationEnd({ animationName: 'xy-flow-node-enter' } as AnimationEvent, 'b');
    expect(component.enteringNodeIds().has('b')).toBe(false);
  });

  it('ignores animationend from other animations', async () => {
    store.animate.set(true);
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    component.onNodeAnimationEnd({ animationName: 'some-user-anim' } as AnimationEvent, 'b');
    expect(component.enteringNodeIds().has('b')).toBe(true);
  });

  it('enabling animation later only animates nodes added after the toggle', async () => {
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]); // added while disabled
    await fixture.whenStable();
    store.animate.set(true);
    store.setNodes([node('a'), node('b'), node('c')]); // added while enabled
    await fixture.whenStable();
    expect(component.enteringNodeIds().has('c')).toBe(true);
    expect(component.enteringNodeIds().has('b')).toBe(false);
    expect(component.enteringNodeIds().has('a')).toBe(false);
  });
});

describe('getNodeInputs cache keying (per-node, not global version)', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    component = TestBed.createComponent(NodeRendererComponent).componentInstance;
  });

  it('PERF: a version bump alone does not rebuild a node inputs object', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.bumpVersion();
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).toBe(before);
  });

  it('PERF: dragging one node does not rebuild other nodes inputs (O(1) invalidation)', () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' },
      { id: 'n2', position: { x: 100, y: 0 }, data: {}, type: 'default' },
    ]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.triggerNodeChanges([
      { id: 'n2', type: 'position', position: { x: 150, y: 50 }, dragging: true },
    ] as never);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).toBe(before);
  });

  it('REGRESSION: moving the node itself rebuilds its inputs', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.triggerNodeChanges([
      { id: 'n1', type: 'position', position: { x: 30, y: 40 }, dragging: true },
    ] as never);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).not.toBe(before);
  });

  it('REGRESSION: selection change rebuilds inputs', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.addSelectedNodes(['n1']);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).not.toBe(before);
  });

  it('REGRESSION: data identity change rebuilds inputs', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: { v: 1 }, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: { v: 2 }, type: 'default' }]);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).not.toBe(before);
  });
});

describe('onNodeKeyDown selection guards', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    component = TestBed.createComponent(NodeRendererComponent).componentInstance;
  });

  it('Enter keydown selects a normal node', () => {
    store.elementsSelectable.set(true);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }]);
    const node = store.nodeLookup.get('n1')!.internals.userNode;
    component.onNodeKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), node);
    expect(store.selectedNodes()).toHaveLength(1);
  });

  it('Enter keydown does not select a node with selectable: false', () => {
    store.elementsSelectable.set(true);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, selectable: false }]);
    const node = store.nodeLookup.get('n1')!.internals.userNode;
    component.onNodeKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), node);
    expect(store.selectedNodes()).toHaveLength(0);
  });

  it('Space keydown selects a normal node (parity with Enter)', () => {
    store.elementsSelectable.set(true);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }]);
    const node = store.nodeLookup.get('n1')!.internals.userNode;
    component.onNodeKeyDown(new KeyboardEvent('keydown', { key: ' ' }), node);
    expect(store.selectedNodes()).toHaveLength(1);
  });

  it('Enter on an already-selected node is a no-op without multi-selection', () => {
    store.elementsSelectable.set(true);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }]);
    store.addSelectedNodes(['n1']);
    expect(store.selectedNodes()).toHaveLength(1);
    const node = store.nodeLookup.get('n1')!.internals.userNode;
    component.onNodeKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), node);
    // Still selected — Enter neither re-selects (no-op) nor deselects.
    expect(store.selectedNodes()).toHaveLength(1);
  });

  it('Enter on an already-selected node toggles off when multiSelectionActive', () => {
    store.elementsSelectable.set(true);
    store.multiSelectionActive.set(true);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }]);
    store.addSelectedNodes(['n1']);
    const selected = store.nodeLookup.get('n1')!.internals.userNode;
    component.onNodeKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), selected);
    expect(store.selectedNodes()).toHaveLength(0);
  });
});

describe('computeNodeInputsKey (pure)', () => {
  const internal = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'n',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {},
      internals: { positionAbsolute: { x: 0, y: 0 }, z: 0 },
      ...overrides,
    }) as unknown as InternalNode;

  it('changes for every field that feeds the inputs object', () => {
    const base = computeNodeInputsKey(internal(), true, false);
    expect(computeNodeInputsKey(internal({ internals: { positionAbsolute: { x: 1, y: 0 }, z: 0 } }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ internals: { positionAbsolute: { x: 0, y: 0 }, z: 5 } }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ selected: true }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ dragging: true }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ type: 'custom' }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ connectable: false }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal(), false, false)).not.toBe(base); // nodesConnectable
    expect(computeNodeInputsKey(internal(), true, true)).not.toBe(base);   // template registered
    expect(computeNodeInputsKey(internal({ sourcePosition: 'left' }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ targetPosition: 'right' }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ dragHandle: '.h' }), true, false)).not.toBe(base);
  });

  it('is stable for identical state', () => {
    expect(computeNodeInputsKey(internal(), true, false)).toBe(computeNodeInputsKey(internal(), true, false));
  });
});

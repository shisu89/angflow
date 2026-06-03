import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
import type { NodeTemplateSpec } from '../types/node-template';

function newFlow(): { flow: NgFlowService; store: FlowStore } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const child = Injector.create({
    providers: [FlowStore, NgFlowService],
    parent: TestBed.inject(Injector),
  });
  return { flow: child.get(NgFlowService), store: child.get(FlowStore) };
}

describe('NgFlowService node templates', () => {
  let flow: NgFlowService;
  let store: FlowStore;

  beforeEach(() => {
    ({ flow, store } = newFlow());
  });

  it('registerNodeTemplate adds a template readable via getNodeTemplates', () => {
    const spec: NodeTemplateSpec = { title: '{{data.name}}' };
    flow.registerNodeTemplate('service', spec);
    expect(flow.getNodeTemplates()).toEqual([{ name: 'service', spec }]);
    expect(store.nodeTemplates().get('service')).toBe(spec);
  });

  it('re-registering the same name overwrites the spec', () => {
    flow.registerNodeTemplate('service', { title: 'v1' });
    flow.registerNodeTemplate('service', { title: 'v2' });
    expect(flow.getNodeTemplates()).toEqual([{ name: 'service', spec: { title: 'v2' } }]);
  });

  it('unregisterNodeTemplate removes and reports whether it existed', () => {
    flow.registerNodeTemplate('service', {});
    expect(flow.unregisterNodeTemplate('service')).toBe(true);
    expect(flow.unregisterNodeTemplate('service')).toBe(false);
    expect(flow.getNodeTemplates()).toEqual([]);
  });

  it('unregisterNodeTemplate returns false on a fresh (empty) registry', () => {
    expect(flow.unregisterNodeTemplate('ghost')).toBe(false);
  });

  it('registry writes replace the map reference (signal consumers re-fire)', () => {
    const before = store.nodeTemplates();
    flow.registerNodeTemplate('a', {});
    expect(store.nodeTemplates()).not.toBe(before);
  });

  it('two flows have isolated registries', () => {
    const other = newFlow();
    other.flow.registerNodeTemplate('only-there', {});
    expect(flow.getNodeTemplates()).toEqual([]);
  });
});

describe('NgFlowService type discovery', () => {
  let flow: NgFlowService;
  let store: FlowStore;

  beforeEach(() => {
    ({ flow, store } = newFlow());
  });

  it('reports built-in node types', () => {
    const types = flow.getNodeTypeNames();
    for (const name of ['default', 'input', 'output', 'group']) {
      expect(types).toContainEqual({ name, source: 'builtin' });
    }
  });

  it('reports host node types from the store signal', () => {
    store.hostNodeTypeNames.set(['decision']);
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'decision', source: 'host' });
  });

  it('reports content-projected template types as host', () => {
    store.contentNodeTemplateNames.set(['card']);
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'card', source: 'host' });
  });

  it('host overrides builtin for the same name (mirrors renderer precedence)', () => {
    store.hostNodeTypeNames.set(['default']);
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'default', source: 'host' });
    expect(
      flow.getNodeTypeNames().filter((t) => t.name === 'default'),
    ).toHaveLength(1);
  });

  it('reports registered templates with source "template"', () => {
    flow.registerNodeTemplate('service', {});
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'service', source: 'template' });
  });

  it('reports built-in and host edge types', () => {
    store.hostEdgeTypeNames.set(['wavy']);
    const types = flow.getEdgeTypeNames();
    for (const name of ['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier']) {
      expect(types).toContainEqual({ name, source: 'builtin' });
    }
    expect(types).toContainEqual({ name: 'wavy', source: 'host' });
  });
});

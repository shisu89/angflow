/**
 * Built-in nodes honour `sourcePosition` / `targetPosition` (upstream parity: React's
 * DefaultNode/InputNode/OutputNode take them as props, defaulting to Bottom / Top).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Position } from '@angflow/system';
import { NodeRendererComponent } from '../../container/node-renderer/node-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node } from '../../types';

describe('built-in nodes: handle positions', () => {
  let store: FlowStore;
  let fixture: ComponentFixture<NodeRendererComponent>;

  beforeEach(() => {
    const g = globalThis as Record<string, unknown>;
    g['ResizeObserver'] ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(NodeRendererComponent);
  });

  async function handleClasses(nodes: Node[]): Promise<Record<string, string[]>> {
    store.setNodes(nodes);
    await fixture.whenStable();
    fixture.detectChanges();
    const out: Record<string, string[]> = {};
    for (const node of nodes) {
      const handles = fixture.nativeElement.querySelectorAll(`[data-id="${node.id}"] .xy-flow__handle`);
      out[node.id] = Array.from(handles as NodeListOf<HTMLElement>).map((h) =>
        [h.classList.contains('source') ? 'source' : 'target', h.className.match(/xy-flow__handle-(\w+)/)?.[1]].join(':')
      );
    }
    return out;
  }

  it('default/input/output use sourcePosition and targetPosition when set', async () => {
    const result = await handleClasses([
      { id: 'd', type: 'default', position: { x: 0, y: 0 }, data: {}, sourcePosition: Position.Right, targetPosition: Position.Left },
      { id: 'i', type: 'input', position: { x: 0, y: 100 }, data: {}, sourcePosition: Position.Right },
      { id: 'o', type: 'output', position: { x: 0, y: 200 }, data: {}, targetPosition: Position.Left },
    ]);
    expect(result['d'].sort()).toEqual(['source:right', 'target:left']);
    expect(result['i']).toEqual(['source:right']);
    expect(result['o']).toEqual(['target:left']);
  });

  it('defaults to target top / source bottom', async () => {
    const result = await handleClasses([
      { id: 'd', type: 'default', position: { x: 0, y: 0 }, data: {} },
      { id: 'i', type: 'input', position: { x: 0, y: 100 }, data: {} },
      { id: 'o', type: 'output', position: { x: 0, y: 200 }, data: {} },
    ]);
    expect(result['d'].sort()).toEqual(['source:bottom', 'target:top']);
    expect(result['i']).toEqual(['source:bottom']);
    expect(result['o']).toEqual(['target:top']);
  });
});

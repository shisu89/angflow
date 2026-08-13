import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { MiniMapComponent } from './minimap.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node } from '../../types';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', width: 100, height: 50, ...overrides };
}

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

describe('MiniMapComponent includeHiddenNodes', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
  });

  it('excludes hidden nodes by default', () => {
    store.setNodes([
      makeNode('visible'),
      makeNode('domHidden', { hidden: true, position: { x: 500, y: 500 } }),
    ] as never);
    const fixture = TestBed.createComponent(MiniMapComponent);
    expect(fixture.componentInstance.minimapNodes().map((n) => n.id)).toEqual(['visible']);
  });

  it('includes hidden nodes when the input is set', () => {
    store.setNodes([
      makeNode('visible'),
      makeNode('domHidden', { hidden: true, position: { x: 500, y: 500 } }),
    ] as never);
    const fixture = TestBed.createComponent(MiniMapComponent);
    setSignalInput(fixture.componentInstance, 'includeHiddenNodes', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.minimapNodes().map((n) => n.id).sort()).toEqual(['domHidden', 'visible']);
  });

  it('still excludes collapse-hidden nodes when the input is set', () => {
    // A collapsed group's own rect already represents its descendants; drawing
    // them too would double-draw the region and inflate the viewBox.
    //
    // `collapsedHiddenIds` is a COMPUTED (flow-store.service.ts:345) derived
    // from getCollapsedHiddenIds(nodeLookup) — it has no .set(). Drive it the
    // only way the real feature does: a parent marked `collapsed: true` hides
    // every descendant that points at it via `parentId`.
    store.setNodes([
      makeNode('group', { collapsed: true } as Partial<Node>),
      makeNode('child', { parentId: 'group' } as Partial<Node>),
      makeNode('domHidden', { hidden: true, position: { x: 500, y: 500 } }),
    ] as never);
    expect(store.collapsedHiddenIds().has('child')).toBe(true);

    const fixture = TestBed.createComponent(MiniMapComponent);
    setSignalInput(fixture.componentInstance, 'includeHiddenNodes', true);
    fixture.detectChanges();

    const ids = fixture.componentInstance.minimapNodes().map((n) => n.id).sort();
    expect(ids).toContain('domHidden'); // node.hidden revealed by the input
    expect(ids).not.toContain('child'); // collapse-hidden stays excluded
  });
});

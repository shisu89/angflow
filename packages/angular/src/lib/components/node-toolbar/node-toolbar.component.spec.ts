import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NodeToolbarComponent } from './node-toolbar.component';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

describe('NodeToolbarComponent toolbarTransform', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeToolbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'n1' },
      ],
    });
    store = TestBed.inject(FlowStore);
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
    ]);
  });

  it('recomputes when the node is measured (version bump)', () => {
    const fixture = TestBed.createComponent(NodeToolbarComponent);
    const inst = fixture.componentInstance;

    // Default position=Top, align=center, offset=10 → x offset is width/2.
    expect(inst.toolbarTransform()).toBe('translate(50px, -10px) translate(-50%, -100%)');

    // Simulate ResizeObserver measurement: nodeLookup mutated in place,
    // version bumped (this is exactly what updateNodeInternals does).
    const internal = store.nodeLookup.get('n1')!;
    internal.measured = { width: 200, height: 80 };
    store.bumpVersion();

    expect(inst.toolbarTransform()).toBe('translate(100px, -10px) translate(-50%, -100%)');
  });
});

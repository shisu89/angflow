import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
import { FlowHistoryService } from './flow-history.service';
import type { Node } from '../types';

function node(id: string, x = 0): Node {
  return { id, position: { x, y: 0 }, data: {} };
}

describe('FlowHistoryService', () => {
  let store: FlowStore;
  let service: NgFlowService;
  let history: FlowHistoryService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService, FlowHistoryService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
    history = TestBed.inject(FlowHistoryService);
  });

  it('starts with nothing to undo or redo', () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('undoes and redoes a transactional change', () => {
    service.setNodes([node('a')]);

    history.transaction(() => service.setNodes([node('a'), node('b')]));
    expect(store.nodes().map((n) => n.id)).toEqual(['a', 'b']);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    expect(history.undo()).toBe(true);
    expect(store.nodes().map((n) => n.id)).toEqual(['a']);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    expect(history.redo()).toBe(true);
    expect(store.nodes().map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('a new commit clears the redo stack', () => {
    service.setNodes([node('a')]);
    history.transaction(() => service.setNodes([node('a'), node('b')]));
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.transaction(() => service.setNodes([node('a'), node('c')]));
    expect(history.canRedo()).toBe(false);
    expect(store.nodes().map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('undo/redo are no-ops at the ends of the stack', () => {
    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
  });

  it('clear() drops both stacks', () => {
    service.setNodes([node('a')]);
    history.transaction(() => service.setNodes([node('a'), node('b')]));
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('respects maxDepth', () => {
    history.maxDepth = 2;
    service.setNodes([node('a')]);
    history.transaction(() => service.setNodes([node('a', 1)]));
    history.transaction(() => service.setNodes([node('a', 2)]));
    history.transaction(() => service.setNodes([node('a', 3)]));
    // Only 2 undo steps retained.
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
  });
});

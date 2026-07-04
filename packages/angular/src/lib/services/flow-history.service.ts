import { Injectable, signal } from '@angular/core';
import { injectFlowStore, injectNgFlowService } from '../utils/inject-flow-store';
import type { Node, Edge } from '../types';

type HistorySnapshot<N, E> = { nodes: N[]; edges: E[] };

/**
 * Public undo/redo for a flow, built on snapshot checkpoints. Provide it at the
 * same level as `<ng-flow>` (it injects the flow's `FlowStore` / `NgFlowService`)
 * and wrap mutations in `transaction(...)` (or call `commit()` just before a
 * change) to record restore points.
 *
 * React Flow core does not ship undo/redo — this is an Angular-native addition.
 * It is independent of the agent bridge's own history (which tracks agent tool
 * calls); use this for user-driven undo/redo in the app UI.
 *
 * @example
 * ```ts
 * private history = inject(FlowHistoryService);
 *
 * addNode(node: Node) {
 *   this.history.transaction(() => this.service.addNode(node));
 * }
 * // bind buttons:
 * // <button [disabled]="!history.canUndo()" (click)="history.undo()">Undo</button>
 * ```
 */
@Injectable()
export class FlowHistoryService<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  private readonly store = injectFlowStore<NodeType, EdgeType>();
  private readonly service = injectNgFlowService<NodeType, EdgeType>();

  private past: HistorySnapshot<NodeType, EdgeType>[] = [];
  private future: HistorySnapshot<NodeType, EdgeType>[] = [];

  /** Maximum number of undo steps retained. Older checkpoints are discarded. */
  maxDepth = 100;

  private readonly _canUndo = signal(false);
  private readonly _canRedo = signal(false);
  /** Reactive: whether an `undo()` would do anything. */
  readonly canUndo = this._canUndo.asReadonly();
  /** Reactive: whether a `redo()` would do anything. */
  readonly canRedo = this._canRedo.asReadonly();

  private snapshot(): HistorySnapshot<NodeType, EdgeType> {
    // Shallow-clone each element so later in-place mutations (e.g. the drag
    // fast-path writing node.position) can't corrupt a captured checkpoint.
    return {
      nodes: this.store.nodes().map((n) => ({ ...n })),
      edges: this.store.edges().map((e) => ({ ...e })),
    };
  }

  private syncFlags(): void {
    this._canUndo.set(this.past.length > 0);
    this._canRedo.set(this.future.length > 0);
  }

  private restore(snap: HistorySnapshot<NodeType, EdgeType>): void {
    this.service.setNodes(snap.nodes.map((n) => ({ ...n })));
    this.service.setEdges(snap.edges.map((e) => ({ ...e })));
  }

  /**
   * Record the current state as a restore point (discarding any redo stack).
   * Call this immediately BEFORE applying a change you want to be undoable.
   * Prefer `transaction(...)`, which does this for you.
   */
  commit(): void {
    this.past.push(this.snapshot());
    while (this.past.length > this.maxDepth) this.past.shift();
    this.future = [];
    this.syncFlags();
  }

  /** Record a restore point, then run `fn` (which performs the mutation). */
  transaction(fn: () => void): void {
    this.commit();
    fn();
  }

  /** Undo the last committed change. Returns true if something was undone. */
  undo(): boolean {
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(this.snapshot());
    this.restore(previous);
    this.syncFlags();
    return true;
  }

  /** Redo the last undone change. Returns true if something was redone. */
  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.snapshot());
    this.restore(next);
    this.syncFlags();
    return true;
  }

  /** Drop all history (both undo and redo stacks). */
  clear(): void {
    this.past = [];
    this.future = [];
    this.syncFlags();
  }
}

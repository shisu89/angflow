import type { Node, Edge } from '../types';

export interface AgentHistoryOptions {
  maxDepth?: number;
}

export type Snapshot = { nodes: readonly Node[]; edges: readonly Edge[] };

export type HistoryStatus = {
  canUndo: boolean;
  canRedo: boolean;
  pastDepth: number;
  futureDepth: number;
};

/**
 * Per-flow snapshot-based undo/redo stack. Bridge-only — tracks mutations
 * that came through bridge tool calls; user-driven changes are not captured.
 */
export class AgentHistory {
  private readonly past = new Map<string, Snapshot[]>();
  private readonly future = new Map<string, Snapshot[]>();
  private readonly maxDepth: number;

  constructor(options: AgentHistoryOptions = {}) {
    this.maxDepth = options.maxDepth ?? 100;
  }

  capture(flowId: string, snapshot: Snapshot): void {
    const stack = this.past.get(flowId) ?? [];
    stack.push(snapshot);
    while (stack.length > this.maxDepth) stack.shift();
    this.past.set(flowId, stack);
    this.future.delete(flowId);
  }

  /**
   * Pop up to `steps` snapshots; return the deepest popped snapshot, the
   * actual number consumed (may be less than `steps` if past was shorter),
   * and push intermediates onto `future`. Returns `null` when there is
   * nothing to undo.
   */
  undo(
    flowId: string,
    steps: number,
    currentSnapshot: Snapshot,
  ): { snapshot: Snapshot; consumed: number } | null {
    const past = this.past.get(flowId);
    if (!past || past.length === 0) return null;
    const future = this.future.get(flowId) ?? [];

    let popped: Snapshot | null = null;
    let consumed = 0;
    let remaining = Math.max(1, Math.floor(steps));
    // Push current onto future so a redo returns here.
    future.push(currentSnapshot);
    while (remaining > 0 && past.length > 0) {
      const next = past.pop()!;
      if (popped !== null) future.push(popped);
      popped = next;
      consumed++;
      remaining--;
    }
    if (popped === null) {
      future.pop();
    }
    this.past.set(flowId, past);
    this.future.set(flowId, future);
    return popped ? { snapshot: popped, consumed } : null;
  }

  /** Inverse of undo. */
  redo(
    flowId: string,
    steps: number,
    currentSnapshot: Snapshot,
  ): { snapshot: Snapshot; consumed: number } | null {
    const future = this.future.get(flowId);
    if (!future || future.length === 0) return null;
    const past = this.past.get(flowId) ?? [];

    let target: Snapshot | null = null;
    let consumed = 0;
    let remaining = Math.max(1, Math.floor(steps));
    past.push(currentSnapshot);
    while (remaining > 0 && future.length > 0) {
      const next = future.pop()!;
      if (target !== null) past.push(target);
      target = next;
      consumed++;
      remaining--;
    }
    if (target === null) {
      past.pop();
    }
    this.past.set(flowId, past);
    this.future.set(flowId, future);
    return target ? { snapshot: target, consumed } : null;
  }

  status(flowId: string): HistoryStatus {
    const past = this.past.get(flowId)?.length ?? 0;
    const future = this.future.get(flowId)?.length ?? 0;
    return { canUndo: past > 0, canRedo: future > 0, pastDepth: past, futureDepth: future };
  }

  clear(flowId: string): void {
    this.past.delete(flowId);
    this.future.delete(flowId);
  }

  /** Called when a flow unregisters. */
  dropFlow(flowId: string): void {
    this.clear(flowId);
  }
}

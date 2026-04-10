import { Injectable } from '@angular/core';
import type { NgFlowService } from '@angflow/angular';
import type { Node, Edge } from '@angflow/angular';

export type RunState = 'running' | 'done' | null;

/**
 * Visual-only execution simulator.
 * Topologically sorts nodes by edge dependencies and highlights each in turn.
 * Does not actually compute anything — purely a presentation animation.
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  async run(flow: NgFlowService, nodes: Node[], edges: Edge[]): Promise<void> {
    if (this.running) return;
    if (nodes.length === 0) return;

    const order = this.topologicalSort(nodes, edges);
    if (!order) {
      throw new Error('Cycle detected — cannot simulate a graph with cycles.');
    }

    this.running = true;
    try {
      // Clear previous state
      for (const node of nodes) {
        flow.updateNodeData(node.id, { _runState: null });
      }
      await this.delay(40);

      for (const id of order) {
        flow.updateNodeData(id, { _runState: 'running' });
        await this.delay(320);
        flow.updateNodeData(id, { _runState: 'done' });
      }
    } finally {
      this.running = false;
    }
  }

  clearState(flow: NgFlowService, nodes: Node[]): void {
    for (const node of nodes) {
      flow.updateNodeData(node.id, { _runState: null });
    }
  }

  private topologicalSort(nodes: Node[], edges: Edge[]): string[] | null {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const n of nodes) {
      inDegree.set(n.id, 0);
      adj.set(n.id, []);
    }
    for (const e of edges) {
      if (!adj.has(e.source) || !inDegree.has(e.target)) continue;
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      result.push(id);
      for (const next of adj.get(id) ?? []) {
        const deg = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }

    return result.length === nodes.length ? result : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

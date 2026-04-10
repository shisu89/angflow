import type { Node, Edge } from '@angflow/angular';

const LAYER_GAP_Y = 170;
const NODE_GAP_X = 280;

/**
 * Simple BFS-from-roots layered layout.
 * Places root nodes (no incoming edges) on the top layer, children below.
 * Good enough for small-to-medium graphs without an external library.
 */
export function layoutLayered(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return [];

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

  const layers: string[][] = [];
  const visited = new Set<string>();

  let current: string[] = nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  if (current.length === 0) {
    // No roots (cycle or all-self-referencing) — just use the first node as a root
    current = [nodes[0].id];
  }

  current.forEach((id) => visited.add(id));

  while (current.length > 0) {
    layers.push(current);
    const next: string[] = [];
    for (const id of current) {
      for (const child of adj.get(id) ?? []) {
        if (!visited.has(child)) {
          visited.add(child);
          next.push(child);
        }
      }
    }
    current = next;
  }

  // Any leftover nodes (disconnected) go in their own layer
  const leftover = nodes.map((n) => n.id).filter((id) => !visited.has(id));
  if (leftover.length > 0) {
    layers.push(leftover);
  }

  // Width of widest layer determines horizontal centering
  const widest = Math.max(...layers.map((l) => l.length));
  const totalWidth = (widest - 1) * NODE_GAP_X;
  const baseX = 80;

  return nodes.map((n) => {
    const layerIndex = layers.findIndex((l) => l.includes(n.id));
    const layer = layers[layerIndex];
    const indexInLayer = layer.indexOf(n.id);
    const layerWidth = (layer.length - 1) * NODE_GAP_X;
    const xOffset = (totalWidth - layerWidth) / 2;
    return {
      ...n,
      position: {
        x: baseX + xOffset + indexInLayer * NODE_GAP_X,
        y: 40 + layerIndex * LAYER_GAP_Y,
      },
    };
  });
}

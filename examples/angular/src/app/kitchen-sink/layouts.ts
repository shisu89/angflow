import type { Node, Edge } from '@angflow/angular';

const NODE_W = 220;
const NODE_H = 100;
const GAP = 60;

/** Group nodes by BFS depth from roots. */
function toLayers(nodes: Node[], edges: Edge[]): string[][] {
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

  const visited = new Set<string>();
  const layers: string[][] = [];

  let current: string[] = nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  if (current.length === 0 && nodes.length > 0) {
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

  const leftover = nodes.map((n) => n.id).filter((id) => !visited.has(id));
  if (leftover.length > 0) layers.push(leftover);

  return layers;
}

/** Left-to-right: roots on the left, children flowing right. */
export function layoutLR(nodes: Node[], edges: Edge[]): Node[] {
  const layers = toLayers(nodes, edges);
  const widest = Math.max(1, ...layers.map((l) => l.length));
  const totalH = (widest - 1) * (NODE_H + GAP);

  return nodes.map((n) => {
    const layerIndex = layers.findIndex((l) => l.includes(n.id));
    if (layerIndex < 0) return n;
    const layer = layers[layerIndex];
    const idxInLayer = layer.indexOf(n.id);
    const layerH = (layer.length - 1) * (NODE_H + GAP);
    const yOffset = (totalH - layerH) / 2;
    return {
      ...n,
      position: {
        x: 60 + layerIndex * (NODE_W + GAP),
        y: 60 + yOffset + idxInLayer * (NODE_H + GAP),
      },
    };
  });
}

/** Top-to-bottom: roots at the top, children flowing down. */
export function layoutTB(nodes: Node[], edges: Edge[]): Node[] {
  const layers = toLayers(nodes, edges);
  const widest = Math.max(1, ...layers.map((l) => l.length));
  const totalW = (widest - 1) * (NODE_W + GAP);

  return nodes.map((n) => {
    const layerIndex = layers.findIndex((l) => l.includes(n.id));
    if (layerIndex < 0) return n;
    const layer = layers[layerIndex];
    const idxInLayer = layer.indexOf(n.id);
    const layerW = (layer.length - 1) * (NODE_W + GAP);
    const xOffset = (totalW - layerW) / 2;
    return {
      ...n,
      position: {
        x: 60 + xOffset + idxInLayer * (NODE_W + GAP),
        y: 60 + layerIndex * (NODE_H + GAP),
      },
    };
  });
}

/** Radial: concentric rings from centroid. Layer 0 at the center, then rings outward. */
export function layoutRadial(nodes: Node[], edges: Edge[]): Node[] {
  const layers = toLayers(nodes, edges);
  if (layers.length === 0) return [];

  const CX = 400;
  const CY = 300;
  const RING_STEP = 160;

  return nodes.map((n) => {
    const layerIndex = layers.findIndex((l) => l.includes(n.id));
    if (layerIndex < 0) return n;

    if (layerIndex === 0 && layers[0].length === 1) {
      return { ...n, position: { x: CX - NODE_W / 2, y: CY - NODE_H / 2 } };
    }

    const layer = layers[layerIndex];
    const idxInLayer = layer.indexOf(n.id);
    const radius = (layerIndex + (layers[0].length > 1 ? 0 : 0)) * RING_STEP + (layers[0].length > 1 ? 120 : 0);
    const actualRadius = layerIndex === 0 && layers[0].length > 1 ? 120 : layerIndex * RING_STEP;
    const angleStep = (2 * Math.PI) / layer.length;
    const angle = idxInLayer * angleStep - Math.PI / 2;

    return {
      ...n,
      position: {
        x: CX + Math.cos(angle) * actualRadius - NODE_W / 2,
        y: CY + Math.sin(angle) * actualRadius - NODE_H / 2,
      },
    };
  });
}

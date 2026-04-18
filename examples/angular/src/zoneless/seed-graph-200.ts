import type { Edge, Node } from '@angflow/angular';

export function makeSeedGraph(nodeCount = 200): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.ceil(Math.sqrt(nodeCount));
  const spacingX = 180;
  const spacingY = 110;
  const nodes: Node[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    type: 'default',
    position: { x: (i % cols) * spacingX, y: Math.floor(i / cols) * spacingY },
    data: { label: `Node ${i}` },
    width: 140,
    height: 40,
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    if (i % cols !== cols - 1) {
      edges.push({ id: `e${i}-${i + 1}`, source: `n${i}`, target: `n${i + 1}` });
    }
    if (i + cols < nodeCount) {
      edges.push({ id: `e${i}-${i + cols}`, source: `n${i}`, target: `n${i + cols}` });
    }
  }
  return { nodes, edges };
}

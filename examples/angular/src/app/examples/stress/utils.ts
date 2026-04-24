import type { Node, Edge } from '@angflow/angular';

export interface ElementsCollection {
  nodes: Node[];
  edges: Edge[];
}

export function getNodesAndEdges(xElements = 10, yElements = 10): ElementsCollection {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let nodeId = 1;
  let recentNodeId: number | null = null;

  for (let y = 0; y < yElements; y++) {
    for (let x = 0; x < xElements; x++) {
      const node: Node = {
        id: nodeId.toString(),
        style: { width: 50, height: 30, fontSize: 11 } as any,
        data: { label: `Node ${nodeId}` },
        position: { x: x * 100, y: y * 50 },
      };
      nodes.push(node);

      if (recentNodeId !== null && nodeId <= xElements * yElements) {
        edges.push({
          id: `${x}-${y}`,
          source: recentNodeId.toString(),
          target: nodeId.toString(),
        });
      }

      recentNodeId = nodeId;
      nodeId++;
    }
  }

  return { nodes, edges };
}

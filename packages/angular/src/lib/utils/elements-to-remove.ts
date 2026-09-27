import type { Node, Edge } from '../types';

/** What an `onBeforeDelete` hook may return: a veto flag or a reduced set. */
export type BeforeDeleteResult<NodeType extends Node = Node, EdgeType extends Edge = Edge> =
  | boolean
  | { nodes: NodeType[]; edges: EdgeType[] };

export interface CollectElementsToRemoveParams<NodeType extends Node, EdgeType extends Edge> {
  nodesToRemove: readonly { id: string }[];
  edgesToRemove: readonly { id: string }[];
  nodes: readonly NodeType[];
  edges: readonly EdgeType[];
  /**
   * Also remove descendants of removed nodes (system `getElementsToRemove`
   * semantics). Default `true`. `dissolveGroup` turns it off so a group's
   * children survive it.
   */
  cascadeChildren?: boolean;
}

/**
 * Synchronous port of `@angflow/system`'s `getElementsToRemove` selection step
 * (without the `onBeforeDelete` gate, so callers can keep a synchronous path
 * when the hook is synchronous):
 *
 * - nodes with `deletable: false` are never removed;
 * - children of a removed node are removed too (recursively). A non-deletable
 *   child stops the cascade on its branch, exactly like the system helper;
 * - edges connected to removed nodes are removed, plus the requested edges,
 *   skipping any edge with `deletable: false`.
 *
 * Unlike the system helper the cascade does not depend on parents preceding
 * their children in the `nodes` array.
 */
export function collectElementsToRemove<NodeType extends Node, EdgeType extends Edge>({
  nodesToRemove,
  edgesToRemove,
  nodes,
  edges,
  cascadeChildren = true,
}: CollectElementsToRemoveParams<NodeType, EdgeType>): { nodes: NodeType[]; edges: EdgeType[] } {
  const removeIds = new Set<string>();
  for (const n of nodesToRemove) {
    const node = nodes.find((candidate) => candidate.id === n.id);
    if (node && node.deletable !== false) removeIds.add(node.id);
  }

  if (cascadeChildren && removeIds.size > 0) {
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of nodes) {
        if (removeIds.has(node.id) || node.deletable === false) continue;
        if (node.parentId && removeIds.has(node.parentId)) {
          removeIds.add(node.id);
          grew = true;
        }
      }
    }
  }

  const matchingNodes = nodes.filter((n) => removeIds.has(n.id));
  const edgeIds = new Set(edgesToRemove.map((e) => e.id));
  const matchingEdges = edges.filter(
    (e) =>
      e.deletable !== false &&
      (edgeIds.has(e.id) || removeIds.has(e.source) || removeIds.has(e.target)),
  );

  return { nodes: matchingNodes, edges: matchingEdges };
}

/**
 * Normalize an `onBeforeDelete` result (React parity): `true` keeps the full
 * set, `false` vetoes everything, an object replaces the set.
 */
export function resolveBeforeDeleteResult<NodeType extends Node, EdgeType extends Edge>(
  result: BeforeDeleteResult<NodeType, EdgeType> | null | undefined,
  matching: { nodes: NodeType[]; edges: EdgeType[] },
): { nodes: NodeType[]; edges: EdgeType[] } {
  if (typeof result === 'object' && result !== null) {
    return { nodes: result.nodes ?? [], edges: result.edges ?? [] };
  }
  return result ? matching : { nodes: [], edges: [] };
}

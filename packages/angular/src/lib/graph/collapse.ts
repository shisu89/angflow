import type { Edge } from '../types';

/** Minimal node shape the collapse helpers read. */
interface CollapseNode {
  id: string;
  parentId?: string;
  collapsed?: boolean;
}

/** A display edge: an `Edge` plus the original ids it represents (length 1 = passthrough). */
export type DisplayEdge<EdgeType extends Edge = Edge> = EdgeType & { collapsedFrom?: string[] };

/**
 * Ids of nodes hidden because an ancestor (via `parentId` chain) is `collapsed`.
 * The collapsed node itself is NOT included. Nesting-correct and O(n) via memoized
 * ancestry walks.
 */
export function getCollapsedHiddenIds(nodeLookup: ReadonlyMap<string, CollapseNode>): Set<string> {
  const hidden = new Set<string>();
  for (const node of nodeLookup.values()) {
    let parentId = node.parentId;
    while (parentId) {
      const parent = nodeLookup.get(parentId);
      if (!parent) break;
      if (parent.collapsed) {
        hidden.add(node.id);
        break;
      }
      parentId = parent.parentId;
    }
  }
  return hidden;
}

/** The outermost (highest) collapsed ancestor of `id`, or `id` itself if none. */
function outermostCollapsedAncestor(id: string, nodeLookup: ReadonlyMap<string, CollapseNode>): string {
  let result = id;
  let parentId = nodeLookup.get(id)?.parentId;
  while (parentId) {
    const parent = nodeLookup.get(parentId);
    if (!parent) break;
    if (parent.collapsed) result = parent.id;
    parentId = parent.parentId;
  }
  return result;
}

/**
 * Rewrite edges for the current collapsed state:
 *  - map each hidden endpoint to its outermost collapsed ancestor;
 *  - drop edges whose endpoints map to the same node (internal to a collapsed box);
 *  - dedupe parallels created by rewriting, keyed (source,target,sourceHandle,targetHandle).
 * Untouched edges pass through with original identity (no `collapsedFrom`).
 */
export function rewriteEdgesForCollapse<EdgeType extends Edge>(
  edges: EdgeType[],
  nodeLookup: ReadonlyMap<string, CollapseNode>,
  hiddenIds: Set<string>,
): DisplayEdge<EdgeType>[] {
  if (hiddenIds.size === 0) return edges as DisplayEdge<EdgeType>[];

  const byKey = new Map<string, { edge: EdgeType; source: string; target: string; from: string[] }>();
  const order: string[] = [];

  for (const edge of edges) {
    const source = hiddenIds.has(edge.source) ? outermostCollapsedAncestor(edge.source, nodeLookup) : edge.source;
    const target = hiddenIds.has(edge.target) ? outermostCollapsedAncestor(edge.target, nodeLookup) : edge.target;
    if (source === target) continue; // internal to one collapsed box

    const key = `${source} ${target} ${edge.sourceHandle ?? ''} ${edge.targetHandle ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.from.push(edge.id);
    } else {
      byKey.set(key, { edge, source, target, from: [edge.id] });
      order.push(key);
    }
  }

  return order.map((key) => {
    const { edge, source, target, from } = byKey.get(key)!;
    const merged = from.length > 1;
    return {
      ...edge,
      id: merged ? `__collapsed:${source}->${target}` : edge.id,
      source,
      target,
      collapsedFrom: from,
    } as DisplayEdge<EdgeType>;
  });
}

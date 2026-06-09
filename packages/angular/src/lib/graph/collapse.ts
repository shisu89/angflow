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
 * The collapsed node itself is NOT included. Nesting-correct; each node's ancestry
 * is walked with a cycle guard so a malformed parentId loop can't hang.
 */
export function getCollapsedHiddenIds(nodeLookup: ReadonlyMap<string, CollapseNode>): Set<string> {
  const hidden = new Set<string>();
  for (const node of nodeLookup.values()) {
    const seen = new Set<string>();
    let parentId = node.parentId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
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

/** The outermost (highest) collapsed ancestor of `id`, or `id` itself if none. Cycle-guarded. */
function outermostCollapsedAncestor(id: string, nodeLookup: ReadonlyMap<string, CollapseNode>): string {
  let result = id;
  const seen = new Set<string>();
  let parentId = nodeLookup.get(id)?.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
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
 * Edges unaffected by collapse (neither endpoint rewritten, not merged) pass through with
 * original identity and no `collapsedFrom`. Rerouted or merged edges carry `collapsedFrom`
 * (the original edge ids); a merged edge also gets a synthetic `__collapsed:src->tgt` id.
 */
export function rewriteEdgesForCollapse<EdgeType extends Edge>(
  edges: EdgeType[],
  nodeLookup: ReadonlyMap<string, CollapseNode>,
  hiddenIds: Set<string>,
): DisplayEdge<EdgeType>[] {
  if (hiddenIds.size === 0) return edges as DisplayEdge<EdgeType>[];

  const byKey = new Map<string, { edge: EdgeType; source: string; target: string; from: string[] }>();

  for (const edge of edges) {
    const source = hiddenIds.has(edge.source) ? outermostCollapsedAncestor(edge.source, nodeLookup) : edge.source;
    const target = hiddenIds.has(edge.target) ? outermostCollapsedAncestor(edge.target, nodeLookup) : edge.target;
    if (source === target) continue; // internal to one collapsed box

    const key = `${source}\0${target}\0${edge.sourceHandle ?? ''}\0${edge.targetHandle ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.from.push(edge.id);
    } else {
      byKey.set(key, { edge, source, target, from: [edge.id] });
    }
  }

  return Array.from(byKey.values(), ({ edge, source, target, from }) => {
    const merged = from.length > 1;
    const rewritten = merged || source !== edge.source || target !== edge.target;
    return {
      ...edge,
      id: merged ? `__collapsed:${source}->${target}` : edge.id,
      source,
      target,
      ...(rewritten ? { collapsedFrom: from } : {}),
    } as DisplayEdge<EdgeType>;
  });
}

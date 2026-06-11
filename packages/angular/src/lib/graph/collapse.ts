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
 *  - dedupe parallels CREATED BY REWRITING, keyed (source,target,sourceHandle,targetHandle).
 *
 * Edges whose NEITHER endpoint is hidden pass through verbatim (original identity, no
 * `collapsedFrom`), so unrelated parallel edges are never merged. Only edges with at least
 * one rewritten endpoint enter the dedupe map.
 *
 * Rerouted or merged edges carry `collapsedFrom` (the original edge ids); a merged edge also
 * gets a synthetic `__collapsed:src->tgt` id.
 *
 * Accepted trade-off: a pre-existing real `x→g` edge no longer absorbs an `x→a` edge
 * rerouted to `x→g`; they render as parallels.
 */
export function rewriteEdgesForCollapse<EdgeType extends Edge>(
  edges: EdgeType[],
  nodeLookup: ReadonlyMap<string, CollapseNode>,
  hiddenIds: Set<string>,
): DisplayEdge<EdgeType>[] {
  if (hiddenIds.size === 0) return edges as DisplayEdge<EdgeType>[];

  const untouched: DisplayEdge<EdgeType>[] = [];
  const byKey = new Map<string, { edge: EdgeType; source: string; target: string; from: string[] }>();

  for (const edge of edges) {
    const sourceHidden = hiddenIds.has(edge.source);
    const targetHidden = hiddenIds.has(edge.target);

    if (!sourceHidden && !targetHidden) {
      // Neither endpoint is hidden — pass through verbatim, no dedupe
      untouched.push(edge as DisplayEdge<EdgeType>);
      continue;
    }

    const source = sourceHidden ? outermostCollapsedAncestor(edge.source, nodeLookup) : edge.source;
    const target = targetHidden ? outermostCollapsedAncestor(edge.target, nodeLookup) : edge.target;
    if (source === target) continue; // internal to one collapsed box

    const key = `${source}\0${target}\0${edge.sourceHandle ?? ''}\0${edge.targetHandle ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.from.push(edge.id);
    } else {
      byKey.set(key, { edge, source, target, from: [edge.id] });
    }
  }

  const rewritten = Array.from(byKey.values(), ({ edge, source, target, from }) => {
    const merged = from.length > 1;
    return {
      ...edge,
      id: merged ? `__collapsed:${source}->${target}` : edge.id,
      source,
      target,
      collapsedFrom: from,
    } as DisplayEdge<EdgeType>;
  });

  return [...untouched, ...rewritten];
}

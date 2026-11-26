import type { NodeChangeset } from '@angflow/system';
import type { Node } from '../types';

/**
 * Apply only `dimensions`-type changes from a `(nodesChange)` changeset,
 * writing `{ width, height }` into each affected node's `measured`. All other
 * change types are ignored. Returns a **new** array when at least one dimension
 * change applied, otherwise the **original `nodes` reference** (so it is a
 * no-op for change detection when there is nothing to update).
 *
 * For controlled-mode apps that keep authority over `position`/`data` themselves
 * (e.g. a journal) but still want `measured` to flow back so that layout
 * (`applyLayout`), floating edges, and `fitView` stay correct.
 *
 * The `setAttributes` and `resizing` fields of a dimensions change are
 * intentionally NOT applied (unlike `changes.applyTo`) — this helper only
 * syncs `measured`; use `changes.applyTo` if you need the width/height
 * write-back. If multiple dimension changes target the same node, the last
 * one wins.
 *
 * Takes the same `(nodes, changeset)` argument order as `applyNodeChanges`.
 *
 * @example
 * ```typescript
 * onNodesChange(changes: NodeChangeset) {
 *   this.nodes.update((ns) => applyDimensionChanges(ns, changes));
 *   // ...your own position/data handling on top...
 * }
 * ```
 */
export function applyDimensionChanges<NodeType extends Node = Node>(
  nodes: NodeType[],
  changes: NodeChangeset<NodeType>,
): NodeType[] {
  const dims = new Map<string, { width: number; height: number }>();
  for (const change of changes.getByType('dimensions')) {
    if (change.dimensions) {
      dims.set(change.id, change.dimensions);
    }
  }
  if (dims.size === 0) return nodes;

  let changed = false;
  const next = nodes.map((node) => {
    const d = dims.get(node.id);
    if (!d) return node;
    changed = true;
    return { ...node, measured: { width: d.width, height: d.height } };
  });
  return changed ? next : nodes;
}

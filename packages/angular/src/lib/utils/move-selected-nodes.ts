import { calculateNodePosition, snapPosition, type XYPosition } from '@angflow/system';
import type { FlowStore } from '../services/flow-store.service';

/** Per-key unit direction vectors for arrow-key node movement (React parity). */
export const ARROW_KEY_DIFFS: Readonly<Record<string, XYPosition>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Ports React's `useMoveSelectedNodes`: shift every selected *and draggable*
 * node (per-node `draggable`, falling back to flow-level `nodesDraggable`) by a
 * snap-grid-aware velocity (5px by default, one grid cell when snapping) times
 * `factor` (4 while Shift is held), then push the batch through the same
 * `updateNodePositions` path a drag uses.
 *
 * The `dragging` argument is deliberately omitted: this is a keyboard nudge,
 * not a pointer gesture, so it must neither raise nor clear
 * `FlowStore.nodeDragging`.
 *
 * @returns the number of nodes moved.
 */
export function moveSelectedNodes(store: FlowStore, direction: XYPosition, factor: number): number {
  const snapToGrid = store.snapToGrid();
  const snapGrid = store.snapGrid();
  const nodeExtent = store.nodeExtent();
  const nodeOrigin = store.nodeOrigin();
  const nodesDraggable = store.nodesDraggable();
  const onError = store.onError();
  const nodeLookup = store.nodeLookup;

  const xVelo = snapToGrid ? snapGrid[0] : 5;
  const yVelo = snapToGrid ? snapGrid[1] : 5;
  const xDiff = direction.x * xVelo * factor;
  const yDiff = direction.y * yVelo * factor;

  const nodeUpdates = new Map<string, unknown>();

  for (const [, node] of nodeLookup) {
    const userDraggable = node.draggable;
    const isSelectedDraggable =
      node.selected && (userDraggable || (nodesDraggable && typeof userDraggable === 'undefined'));
    if (!isSelectedDraggable) continue;

    let nextPosition = {
      x: node.internals.positionAbsolute.x + xDiff,
      y: node.internals.positionAbsolute.y + yDiff,
    };
    if (snapToGrid) {
      nextPosition = snapPosition(nextPosition, snapGrid);
    }

    const { position, positionAbsolute } = calculateNodePosition({
      nodeId: node.id,
      nextPosition,
      nodeLookup,
      nodeExtent,
      nodeOrigin,
      onError,
    });

    node.position = position;
    node.internals.positionAbsolute = positionAbsolute;
    nodeUpdates.set(node.id, node);
  }

  if (nodeUpdates.size > 0) {
    store.updateNodePositions(nodeUpdates as Map<string, never>);
  }
  return nodeUpdates.size;
}

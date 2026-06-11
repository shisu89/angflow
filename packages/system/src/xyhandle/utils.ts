import { getHandlePosition, getOverlappingArea, nodeToRect } from '../utils';
import type { HandleType, XYPosition, Handle, InternalNodeBase, NodeLookup, ConnectionMode } from '../types';
import { Position } from '../types';

function getNodesWithinDistance(position: XYPosition, nodeLookup: NodeLookup, distance: number): InternalNodeBase[] {
  const nodes: InternalNodeBase[] = [];
  const rect = {
    x: position.x - distance,
    y: position.y - distance,
    width: distance * 2,
    height: distance * 2,
  };

  for (const node of nodeLookup.values()) {
    // Hidden nodes remain in nodeLookup (visibility filtering is render-level);
    // an invisible node must not capture connection snapping or highlights.
    if (node.hidden) continue;
    if (getOverlappingArea(rect, nodeToRect(node)) > 0) {
      nodes.push(node);
    }
  }

  return nodes;
}

/*
 * this distance is used for the area around the user pointer
 * while doing a connection for finding the closest nodes
 */
const ADDITIONAL_DISTANCE = 250;

export function getClosestHandle(
  position: XYPosition,
  connectionRadius: number,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null }
): Handle | null {
  let closestHandles: Handle[] = [];
  let minDistance = Infinity;

  const closeNodes = getNodesWithinDistance(position, nodeLookup, connectionRadius + ADDITIONAL_DISTANCE);

  for (const node of closeNodes) {
    const allHandles = [...(node.internals.handleBounds?.source ?? []), ...(node.internals.handleBounds?.target ?? [])];

    for (const handle of allHandles) {
      // if the handle is the same as the fromHandle we skip it
      if (fromHandle.nodeId === handle.nodeId && fromHandle.type === handle.type && fromHandle.id === handle.id) {
        continue;
      }

      // determine absolute position of the handle
      const { x, y } = getHandlePosition(node, handle, handle.position, true);

      const distance = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (distance > connectionRadius) {
        continue;
      }

      if (distance < minDistance) {
        closestHandles = [{ ...handle, x, y }];
        minDistance = distance;
      } else if (distance === minDistance) {
        // when multiple handles are on the same distance we collect all of them
        closestHandles.push({ ...handle, x, y });
      }
    }
  }

  if (!closestHandles.length) {
    return null;
  }
  // when multiple handles overlay each other we prefer the opposite handle
  if (closestHandles.length > 1) {
    const oppositeHandleType = fromHandle.type === 'source' ? 'target' : 'source';
    return closestHandles.find((handle) => handle.type === oppositeHandleType) ?? closestHandles[0];
  }

  return closestHandles[0];
}

/**
 * Stage 2 drop-target resolver for connection drags.
 *
 * Called when Stage 1 (`getClosestHandle`) returns null. Finds a node whose bounding
 * rectangle contains the pointer and has at least one compatible floating handle, then
 * returns the best floating handle on that node.
 *
 * Disambiguation when multiple floating handles exist on the same node:
 *   - If a handle's declared position matches the pointer's side of the node, that handle wins.
 *   - Otherwise, fall back to iteration order.
 *
 * Does not apply per-handle `isValidConnection` validation — that is the caller's
 * responsibility. If the validator rejects, the caller returns null (no cascade).
 */
export function getFloatingDropTarget(
  position: XYPosition,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null }
): Handle | null {
  const oppositeType: HandleType = fromHandle.type === 'source' ? 'target' : 'source';

  let bestNode: InternalNodeBase | null = null;
  let bestZ = -Infinity;

  for (const node of nodeLookup.values()) {
    if (node.id === fromHandle.nodeId) continue;
    // Hidden nodes remain in nodeLookup (visibility filtering is render-level);
    // an invisible node must not capture connection drops or highlights.
    if (node.hidden) continue;

    const nx = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
    const ny = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
    const nw = node.measured?.width ?? node.width ?? 0;
    const nh = node.measured?.height ?? node.height ?? 0;

    if (position.x < nx || position.x > nx + nw) continue;
    if (position.y < ny || position.y > ny + nh) continue;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const oppositeList = (node.internals?.handleBounds?.[oppositeType] ?? []) as Handle[];
    const hasFloating = oppositeList.some((h) => h.floating === true);
    if (!hasFloating) continue;

    const z = node.internals?.z ?? 0;
    if (z > bestZ) {
      bestZ = z;
      bestNode = node;
    }
  }

  if (!bestNode) return null;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const candidates = ((bestNode.internals?.handleBounds?.[oppositeType] ?? []) as Handle[])
    .filter((h) => h.floating === true);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Disambiguate by position-side match.
  const nx = bestNode.internals?.positionAbsolute?.x ?? bestNode.position?.x ?? 0;
  const ny = bestNode.internals?.positionAbsolute?.y ?? bestNode.position?.y ?? 0;
  const nw = bestNode.measured?.width ?? bestNode.width ?? 0;
  const nh = bestNode.measured?.height ?? bestNode.height ?? 0;
  const cx = nx + nw / 2;
  const cy = ny + nh / 2;
  const dx = position.x - cx;
  const dy = position.y - cy;
  const pointerSide: Position = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? Position.Right : Position.Left)
    : (dy > 0 ? Position.Bottom : Position.Top);

  const sideMatch = candidates.find((h) => h.position === pointerSide);
  return sideMatch ?? candidates[0];
}

export function getHandle(
  nodeId: string,
  handleType: HandleType,
  handleId: string | null,
  nodeLookup: NodeLookup,
  connectionMode: ConnectionMode,
  withAbsolutePosition = false
): Handle | null {
  const node = nodeLookup.get(nodeId);
  if (!node) {
    return null;
  }

  const handles =
    connectionMode === 'strict'
      ? node.internals.handleBounds?.[handleType]
      : [...(node.internals.handleBounds?.source ?? []), ...(node.internals.handleBounds?.target ?? [])];
  const handle = (handleId ? handles?.find((h) => h.id === handleId) : handles?.[0]) ?? null;

  return handle && withAbsolutePosition
    ? { ...handle, ...getHandlePosition(node, handle, handle.position, true) }
    : handle;
}

export function getHandleType(
  edgeUpdaterType: HandleType | undefined,
  handleDomNode: Element | null
): HandleType | null {
  if (edgeUpdaterType) {
    return edgeUpdaterType;
  } else if (handleDomNode?.classList.contains('target')) {
    return 'target';
  } else if (handleDomNode?.classList.contains('source')) {
    return 'source';
  }

  return null;
}

export function isConnectionValid(isInsideConnectionRadius: boolean, isHandleValid: boolean) {
  let isValid: boolean | null = null;

  if (isHandleValid) {
    isValid = true;
  } else if (isInsideConnectionRadius && !isHandleValid) {
    isValid = false;
  }

  return isValid;
}

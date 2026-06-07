import { Position } from '../../types/utils';

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Compute a ray-rect intersection point.
 *
 * Given a node rectangle and a reference point outside (or inside) the rectangle,
 * casts a ray from the rectangle's center toward the reference point and returns
 * the point at which that ray exits the rectangle's border.
 *
 * Used to position floating-edge endpoints dynamically on the border of a node.
 */
export function getFloatingEndpoint(nodeRect: NodeRect, referencePoint: Point): Point {
  const cx = nodeRect.x + nodeRect.width / 2;
  const cy = nodeRect.y + nodeRect.height / 2;
  const dx = referencePoint.x - cx;
  const dy = referencePoint.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const halfW = nodeRect.width / 2;
  const halfH = nodeRect.height / 2;
  const tX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);

  return { x: cx + t * dx, y: cy + t * dy };
}

/**
 * Infer which side of the node a given intersection point lies on.
 *
 * Used to choose sourcePosition/targetPosition for path-shape helpers (bezier, step)
 * when the endpoint is floating rather than anchored to a handle with a declared position.
 *
 * Tiebreak: at exact corners (normalized |dx| === |dy|), the Y axis wins via strict `>`,
 * so the function returns Top or Bottom rather than Left or Right.
 */
export function inferSide(intersection: Point, nodeRect: NodeRect): Position {
  const cx = nodeRect.x + nodeRect.width / 2;
  const cy = nodeRect.y + nodeRect.height / 2;
  // Normalize by half-extents so the comparison identifies the border segment
  // the point actually lies on (matches getFloatingEndpoint's crossing-axis
  // choice); raw deltas misclassify top/bottom points on non-square nodes.
  const nx = (intersection.x - cx) / (nodeRect.width / 2);
  const ny = (intersection.y - cy) / (nodeRect.height / 2);

  return Math.abs(nx) > Math.abs(ny)
    ? (nx > 0 ? Position.Right : Position.Left)
    : (ny > 0 ? Position.Bottom : Position.Top);
}

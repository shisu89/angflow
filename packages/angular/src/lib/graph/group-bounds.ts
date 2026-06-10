/** Options for {@link getGroupBounds}. */
export interface GroupBoundsOptions {
  /** Inset on left, right, and bottom. Default 0. */
  padding?: number;
  /** Extra inset on top (for a header/title bar). Default 0. */
  headerHeight?: number;
  /** Minimum box width. Default 0. */
  minWidth?: number;
  /** Minimum box height. Default 0. */
  minHeight?: number;
}

/** A computed group box. */
export interface GroupBounds {
  position: { x: number; y: number };
  width: number;
  height: number;
}

/** Minimal member shape {@link getGroupBounds} reads. */
interface GroupMember {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number | null;
  height?: number | null;
}

/**
 * Compute the box that wraps `members` with padding and an optional header
 * inset. Coordinate-agnostic: members' positions and the returned position are
 * in the same space (pass absolute members → absolute bounds). Member sizes
 * resolve `measured → width → 0`. With no members, returns a min-sized box at
 * `{0,0}` (the caller positions it).
 */
export function getGroupBounds(members: ReadonlyArray<GroupMember>, opts: GroupBoundsOptions = {}): GroupBounds {
  const p = opts.padding ?? 0;
  const hh = opts.headerHeight ?? 0;
  const minWidth = opts.minWidth ?? 0;
  const minHeight = opts.minHeight ?? 0;

  if (members.length === 0) {
    return { position: { x: 0, y: 0 }, width: Math.max(minWidth, 2 * p), height: Math.max(minHeight, hh + p) };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of members) {
    const w = m.measured?.width ?? m.width ?? 0;
    const h = m.measured?.height ?? m.height ?? 0;
    minX = Math.min(minX, m.position.x);
    minY = Math.min(minY, m.position.y);
    maxX = Math.max(maxX, m.position.x + w);
    maxY = Math.max(maxY, m.position.y + h);
  }

  return {
    position: { x: minX - p, y: minY - hh },
    width: Math.max(minWidth, maxX - minX + 2 * p),
    height: Math.max(minHeight, maxY - minY + hh + p),
  };
}

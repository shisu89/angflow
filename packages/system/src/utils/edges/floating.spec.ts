import { describe, it, expect } from 'vitest';
import { getFloatingEndpoint, inferSide } from './floating';
import { Position } from '../../types/utils';

const rect = { x: 0, y: 0, width: 100, height: 50 };

describe('getFloatingEndpoint', () => {
  it('returns east midpoint for reference point due east', () => {
    const p = getFloatingEndpoint(rect, { x: 500, y: 25 });
    expect(p).toEqual({ x: 100, y: 25 });
  });

  it('returns west midpoint for reference point due west', () => {
    const p = getFloatingEndpoint(rect, { x: -500, y: 25 });
    expect(p).toEqual({ x: 0, y: 25 });
  });

  it('returns south midpoint for reference point due south', () => {
    const p = getFloatingEndpoint(rect, { x: 50, y: 500 });
    expect(p).toEqual({ x: 50, y: 50 });
  });

  it('returns north midpoint for reference point due north', () => {
    const p = getFloatingEndpoint(rect, { x: 50, y: -500 });
    expect(p).toEqual({ x: 50, y: 0 });
  });

  it('returns center for reference point exactly at center (degenerate)', () => {
    const p = getFloatingEndpoint(rect, { x: 50, y: 25 });
    expect(p).toEqual({ x: 50, y: 25 });
  });

  it('picks the correct border for an off-center reference (tX > tY case)', () => {
    // Reference point far above — ray should hit top border first.
    const p = getFloatingEndpoint(rect, { x: 60, y: -1000 });
    expect(p.y).toBe(0);
    expect(p.x).toBeCloseTo(50 + (25 / 1025) * 10, 2); // cx + (halfH/|dy|) * dx
  });

  it('handles tall rectangles (halfW/halfH asymmetry)', () => {
    const tall = { x: 0, y: 0, width: 20, height: 200 };
    // Reference point to the right — should hit right border at (20, 100).
    const p = getFloatingEndpoint(tall, { x: 500, y: 100 });
    expect(p).toEqual({ x: 20, y: 100 });
  });
});

describe('inferSide', () => {
  it('returns Right for intersection on right border', () => {
    expect(inferSide({ x: 100, y: 25 }, rect)).toBe(Position.Right);
  });

  it('returns Left for intersection on left border', () => {
    expect(inferSide({ x: 0, y: 25 }, rect)).toBe(Position.Left);
  });

  it('returns Bottom for intersection on bottom border', () => {
    expect(inferSide({ x: 50, y: 50 }, rect)).toBe(Position.Bottom);
  });

  it('returns Top for intersection on top border', () => {
    expect(inferSide({ x: 50, y: 0 }, rect)).toBe(Position.Top);
  });

  it('prefers Y axis at exact corners (|dx| === |dy| tie breaks to Top/Bottom)', () => {
    // On a square, corner has equal |dx| and |dy|.
    const square = { x: 0, y: 0, width: 100, height: 100 };
    // Top-right corner: dx=50, dy=-50. Strict > means Y branch wins → Top.
    expect(inferSide({ x: 100, y: 0 }, square)).toBe(Position.Top);
    // Bottom-left corner: dx=-50, dy=50. Y branch wins → Bottom.
    expect(inferSide({ x: 0, y: 100 }, square)).toBe(Position.Bottom);
  });

  it('returns Bottom for point on bottom border of a wide rect (not Right)', () => {
    // Wide rect (0,0,100,50): center=(50,25), halfW=50, halfH=25.
    // Point (87.5, 50) — on the bottom edge.
    // raw dx=37.5, raw dy=25 → raw |dx| > |dy| → WRONG (would return Right).
    // normalized nx=37.5/50=0.75, ny=25/25=1.0 → |ny| > |nx| → Bottom (correct).
    const wide = { x: 0, y: 0, width: 100, height: 50 };
    expect(inferSide({ x: 87.5, y: 50 }, wide)).toBe(Position.Bottom);
  });

  it('returns Top for point on top border of a wide rect (not Left/Right)', () => {
    // Wide rect (0,0,100,50): center=(50,25), halfW=50, halfH=25.
    // Point (87.5, 0) — on the top edge.
    // raw dx=37.5, raw dy=-25 → raw |dx| > |dy| → WRONG (would return Right).
    // normalized nx=37.5/50=0.75, ny=-25/25=-1.0 → |ny| > |nx| → Top (correct).
    const wide = { x: 0, y: 0, width: 100, height: 50 };
    expect(inferSide({ x: 87.5, y: 0 }, wide)).toBe(Position.Top);
  });

  it('returns Right for point on right border of a tall rect (not Top/Bottom)', () => {
    // Tall rect (0,0,50,100): center=(25,50), halfW=25, halfH=50.
    // Point (50, 87.5) — on the right edge.
    // raw dx=25, raw dy=37.5 → raw |dy| > |dx| → WRONG (would return Bottom).
    // normalized nx=25/25=1.0, ny=37.5/50=0.75 → |nx| > |ny| → Right (correct).
    const tall = { x: 0, y: 0, width: 50, height: 100 };
    expect(inferSide({ x: 50, y: 87.5 }, tall)).toBe(Position.Right);
  });

  it('returns Bottom at exact corner of a wide rect (normalized tie, Y wins)', () => {
    // Wide rect (0,0,100,50): center=(50,25), halfW=50, halfH=25.
    // Point (100, 50) — bottom-right corner.
    // normalized nx=50/50=1.0, ny=25/25=1.0 → tie → strict > means Y branch wins → Bottom.
    const wide = { x: 0, y: 0, width: 100, height: 50 };
    expect(inferSide({ x: 100, y: 50 }, wide)).toBe(Position.Bottom);
  });
});

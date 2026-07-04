import { describe, it, expect } from 'vitest';
import { getSimpleBezierPath } from './simple-bezier-edge';
import { Position } from '../../types';

describe('getSimpleBezierPath', () => {
  it('returns [path, labelX, labelY, offsetX, offsetY]', () => {
    const result = getSimpleBezierPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
    });
    expect(result).toHaveLength(5);
    expect(typeof result[0]).toBe('string');
    expect(result[0].startsWith('M0,0 C')).toBe(true);
  });

  it('places control points at the source/target midpoint', () => {
    // Vertical handles: control x stays on each endpoint, control y at midpoint 50.
    const [simplePath] = getSimpleBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 200,
      targetY: 100,
      targetPosition: Position.Top,
    });
    expect(simplePath).toBe('M0,0 C0,50 200,50 200,100');
  });

  it('uses the plain midpoint control (independent of curvature)', () => {
    // Horizontal handles: control y stays on each endpoint, control x at midpoint 150.
    const [simplePath] = getSimpleBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 300,
      targetY: 20,
      targetPosition: Position.Left,
    });
    expect(simplePath).toBe('M0,0 C150,0 150,20 300,20');
  });

  it('label anchor sits between the endpoints', () => {
    const [, labelX, labelY] = getSimpleBezierPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 40,
    });
    expect(labelX).toBeGreaterThanOrEqual(0);
    expect(labelX).toBeLessThanOrEqual(100);
    expect(labelY).toBeGreaterThanOrEqual(0);
    expect(labelY).toBeLessThanOrEqual(40);
  });
});

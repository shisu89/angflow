import { describe, it, expect } from 'vitest';
import { getSmoothStepPath } from './smoothstep-edge';
import { Position } from '../../types';

describe('getSmoothStepPath (#6036)', () => {
  it('keeps the full borderRadius when a gap point lies on a straight segment', () => {
    const [path] = getSmoothStepPath({
      sourceX: 0, sourceY: 0, sourcePosition: Position.Top,
      targetX: -60, targetY: -50, targetPosition: Position.Bottom,
    });
    expect(path).toBe('M0 0L 0,-20Q 0,-25 -5,-25L -55,-25Q -60,-25 -60,-30L-60 -50');
    // before: 'M0 0L0 -20L 0,-22.5Q 0,-25 -2.5,-25L -57.5,-25Q -60,-25 -60,-27.5L-60 -30L-60 -50'
  });
});

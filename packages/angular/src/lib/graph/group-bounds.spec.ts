import { describe, it, expect } from 'vitest';
import { getGroupBounds } from './group-bounds';

describe('getGroupBounds', () => {
  it('wraps members with padding and an asymmetric header inset', () => {
    const b = getGroupBounds(
      [
        { position: { x: 110, y: 110 }, width: 40, height: 20 },
        { position: { x: 160, y: 130 }, width: 40, height: 20 },
      ],
      { padding: 10, headerHeight: 20 },
    );
    expect(b.position).toEqual({ x: 100, y: 90 });
    expect(b.width).toBe(110);
    expect(b.height).toBe(70);
  });

  it('prefers measured size, then width/height, then 0', () => {
    const b = getGroupBounds([
      { position: { x: 0, y: 0 }, measured: { width: 30, height: 30 }, width: 999, height: 999 },
    ]);
    expect(b.width).toBe(30);
    expect(b.height).toBe(30);
  });

  it('clamps to minWidth/minHeight', () => {
    const b = getGroupBounds([{ position: { x: 0, y: 0 }, width: 5, height: 5 }], { minWidth: 100, minHeight: 80 });
    expect(b.width).toBe(100);
    expect(b.height).toBe(80);
  });

  it('returns a min box at origin for no members', () => {
    const b = getGroupBounds([], { padding: 10, headerHeight: 20, minWidth: 50, minHeight: 40 });
    expect(b.position).toEqual({ x: 0, y: 0 });
    expect(b.width).toBe(50);
    expect(b.height).toBe(40);
  });

  it('defaults padding/header to 0 (tight wrap)', () => {
    const b = getGroupBounds([{ position: { x: 5, y: 7 }, width: 40, height: 20 }]);
    expect(b.position).toEqual({ x: 5, y: 7 });
    expect(b.width).toBe(40);
    expect(b.height).toBe(20);
  });
});

import { describe, it, expect } from 'vitest';
import { dagreLayout } from './dagre-layout';

const N = (id: string) => ({ id, width: 100, height: 40, position: { x: 0, y: 0 } });

describe('dagreLayout', () => {
  it('returns a top-left position for every input node', async () => {
    const positions = await dagreLayout(
      [N('a'), N('b'), N('c')],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
      { direction: 'TB' },
    );
    expect(Object.keys(positions).sort()).toEqual(['a', 'b', 'c']);
    for (const pos of Object.values(positions)) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('TB puts the source above its targets', async () => {
    const positions = await dagreLayout([N('a'), N('b')], [{ source: 'a', target: 'b' }], {
      direction: 'TB',
    });
    expect(positions['a'].y).toBeLessThan(positions['b'].y);
  });

  it('LR puts the source left of its targets', async () => {
    const positions = await dagreLayout([N('a'), N('b')], [{ source: 'a', target: 'b' }], {
      direction: 'LR',
    });
    expect(positions['a'].x).toBeLessThan(positions['b'].x);
  });

  it('siblings in the same rank do not overlap', async () => {
    const positions = await dagreLayout(
      [N('a'), N('b'), N('c')],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
      { direction: 'TB', nodeSep: 50 },
    );
    expect(Math.abs(positions['b'].x - positions['c'].x)).toBeGreaterThanOrEqual(100);
  });

  it('handles a graph with no edges', async () => {
    const positions = await dagreLayout([N('a'), N('b')], [], { direction: 'TB' });
    expect(Object.keys(positions).sort()).toEqual(['a', 'b']);
  });
});

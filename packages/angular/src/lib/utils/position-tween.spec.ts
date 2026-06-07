import { describe, it, expect } from 'vitest';
import { easeInOutCubic, sampleTween, type TweenEntry } from './position-tween';

describe('easeInOutCubic', () => {
  it('anchors 0→0, 0.5→0.5, 1→1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('eases (slower than linear early, faster late)', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe('sampleTween', () => {
  const entry: TweenEntry = { from: { x: 0, y: 100 }, to: { x: 200, y: 300 }, start: 1000, duration: 100 };

  it('returns from at start and is not done', () => {
    const s = sampleTween(entry, 1000);
    expect(s.position).toEqual({ x: 0, y: 100 });
    expect(s.done).toBe(false);
  });
  it('returns exactly to at/after the end and is done', () => {
    expect(sampleTween(entry, 1100)).toEqual({ position: { x: 200, y: 300 }, done: true });
    expect(sampleTween(entry, 1500)).toEqual({ position: { x: 200, y: 300 }, done: true });
  });
  it('is mid-flight halfway through', () => {
    const s = sampleTween(entry, 1050);
    expect(s.position.x).toBeGreaterThan(0);
    expect(s.position.x).toBeLessThan(200);
    expect(s.position.y).toBeGreaterThan(100);
    expect(s.position.y).toBeLessThan(300);
    expect(s.done).toBe(false);
  });
  it('clamps a time before start to from', () => {
    expect(sampleTween(entry, 0).position).toEqual({ x: 0, y: 100 });
  });
  it('treats duration <= 0 as instantly complete', () => {
    for (const duration of [0, -50]) {
      const s = sampleTween({ ...entry, duration }, entry.start);
      expect(s.position).toEqual({ x: 200, y: 300 });
      expect(s.done).toBe(true);
    }
  });
});

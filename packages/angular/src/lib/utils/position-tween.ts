import type { XYPosition } from '@angflow/system';

/** Fixed easing for node position tweens (matches CSS ease-in-out feel). Input domain [0, 1]; callers must clamp (sampleTween does). */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface TweenEntry {
  from: XYPosition;
  to: XYPosition;
  /** Timestamp (performance.now() domain) when the tween started. */
  start: number;
  /** Milliseconds. */
  duration: number;
}

/** Sample one tween at time `now`. `done` means the target was reached exactly. */
export function sampleTween(entry: TweenEntry, now: number): { position: XYPosition; done: boolean } {
  // duration <= 0 would divide to NaN/-Infinity and never report done — treat as instant.
  if (entry.duration <= 0) {
    return { position: { x: entry.to.x, y: entry.to.y }, done: true };
  }
  const t = Math.min(1, Math.max(0, (now - entry.start) / entry.duration));
  const e = easeInOutCubic(t);
  return {
    position: {
      x: entry.from.x + (entry.to.x - entry.from.x) * e,
      y: entry.from.y + (entry.to.y - entry.from.y) * e,
    },
    done: t >= 1,
  };
}

/** True when the OS asks for reduced motion — disables all flow animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

declare function requestIdleCallback(cb: () => void): number;

interface Frame {
  duration: number;
  stage: string;
}

/**
 * Measures the duration of every frame between construction and `endRecordingAsync()`.
 *
 * Usage:
 * ```ts
 * const recorder = new FrameRecorder();
 * // ...do perf-intensive work...
 * await recorder.endRecordingAsync();
 * console.log(recorder.getFrames());
 * ```
 */
export class FrameRecorder {
  private frames: Frame[] = [];
  private animationFrameId: number;
  private stage = '<no stage>';

  constructor() {
    let lastFrameTimestamp = performance.now();

    const measureFrame = () => {
      const timestamp = performance.now();

      // Annotate each frame in the Performance pane (collapsed "Timings" section).
      performance.measure(`frame (${this.stage})`, {
        start: lastFrameTimestamp,
        end: timestamp,
      });

      this.frames.push({
        duration: timestamp - lastFrameTimestamp,
        stage: this.stage,
      });

      lastFrameTimestamp = timestamp;
      this.animationFrameId = requestAnimationFrame(measureFrame);
    };

    this.animationFrameId = requestAnimationFrame(measureFrame);
  }

  /**
   * Method is `async` to remind callers to `await` it — otherwise some events get lost.
   */
  async endRecordingAsync(): Promise<void> {
    this.setStage('waiting for idle');
    await new Promise<void>((resolve) => requestIdleCallback(() => resolve()));
    requestAnimationFrame(() => cancelAnimationFrame(this.animationFrameId));
  }

  setStage(stage: string): void {
    this.stage = stage;
  }

  getFramesForObservable(): Array<Frame & { index: number }> {
    return this.frames.map((frame, index) => ({ ...frame, index }));
  }

  getFrames(): Record<string, number[]> {
    const framesPerStage: Record<string, number[]> = {};
    for (const frame of this.frames) {
      (framesPerStage[frame.stage] ??= []).push(frame.duration);
    }
    return framesPerStage;
  }
}

/**
 * Resolves on the next macrotask — equivalent to `setTimeout(..., 0)`.
 * Use to yield between synthesized DOM events so the previous one finishes processing.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Generates `MouseEvent` constructor params targeting a node DOM element.
 * Click/drag will land 5px inside the node's top-left corner.
 */
export function generateMouseEventParamsTargetingNode(node: Element): MouseEventInit & {
  clientX: number;
  clientY: number;
  movementX: number;
  movementY: number;
} {
  const rect = node.getBoundingClientRect();
  const inset = { left: 5, top: 5 };

  return {
    clientX: Math.round(rect.left + inset.left),
    clientY: Math.round(rect.top + inset.top),
    movementX: 0,
    movementY: 0,

    // Required boilerplate for a synthetic mouse event.
    altKey: false,
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    composed: true,
    ctrlKey: false,
    detail: 1,
    metaKey: false,
    shiftKey: false,
    view: window,
  };
}

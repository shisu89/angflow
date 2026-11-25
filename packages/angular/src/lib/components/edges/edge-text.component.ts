import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { CSSProperties } from '../../types/general';

const defaultLabelBgPadding: [number, number] = [2, 4];

/** `{ fill: 'red', fontSize: 12 }` → `fill: red; font-size: 12`, skipping unset values. */
function toStyleString(style: CSSProperties | undefined): string | null {
  if (!style) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined) continue;
    const prop = key.startsWith('--') ? key : key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    parts.push(`${prop}: ${value}`);
  }
  return parts.length ? parts.join('; ') : null;
}

/**
 * SVG edge label, the Angular counterpart of upstream `EdgeText`: a `<g>`
 * translated so the label's centre sits at `(x, y)` in flow coordinates, with
 * an optional background `<rect>` sized from the measured text. Hidden until
 * the text has been measured with `getBBox()`.
 *
 * It is an attribute component on an SVG `<g>`, so use it inside an `<svg>`:
 *
 * ```html
 * <svg:g ngFlowEdgeText [x]="labelX" [y]="labelY" [label]="label" />
 * ```
 */
@Component({
  selector: 'g[ngFlowEdgeText]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__edge-textwrapper xy-flow__edge-textwrapper',
    '[attr.transform]': 'transform()',
    '[attr.visibility]': 'bbox().width ? "visible" : "hidden"',
  },
  template: `
    @if (showBg()) {
      <svg:rect
        class="ng-flow__edge-textbg xy-flow__edge-textbg"
        [attr.x]="-padding()[0]"
        [attr.y]="-padding()[1]"
        [attr.width]="bbox().width + 2 * padding()[0]"
        [attr.height]="bbox().height + 2 * padding()[1]"
        [attr.rx]="radius()"
        [attr.ry]="radius()"
        [attr.style]="bgStyle()"
      />
    }
    <svg:text
      #text
      class="ng-flow__edge-text xy-flow__edge-text"
      [attr.y]="bbox().height / 2"
      dy="0.3em"
      [attr.style]="textStyle()"
    >{{ label() }}</svg:text>
  `,
})
export class EdgeTextComponent {
  readonly x = input(0);
  readonly y = input(0);
  readonly label = input<string>();
  readonly labelStyle = input<CSSProperties>();
  /** Defaults to `true`. */
  readonly labelShowBg = input<boolean | undefined>();
  readonly labelBgStyle = input<CSSProperties>();
  /** `[horizontal, vertical]` padding of the background rect. Defaults to `[2, 4]`. */
  readonly labelBgPadding = input<[number, number] | undefined>();
  /** Defaults to `2`. */
  readonly labelBgBorderRadius = input<number | undefined>();

  /** The text's measured box (`getBBox()`); zero until measured. */
  readonly bbox = signal({ x: 1, y: 0, width: 0, height: 0 });

  private readonly textRef = viewChild<ElementRef<SVGTextElement>>('text');

  // A bound `undefined` overrides an input default, so defaults resolve here.
  protected readonly showBg = computed(() => this.labelShowBg() ?? true);
  protected readonly padding = computed(() => this.labelBgPadding() ?? defaultLabelBgPadding);
  protected readonly radius = computed(() => this.labelBgBorderRadius() ?? 2);
  protected readonly textStyle = computed(() => toStyleString(this.labelStyle()));
  protected readonly bgStyle = computed(() => toStyleString(this.labelBgStyle()));
  protected readonly transform = computed(() => {
    const { width, height } = this.bbox();
    return `translate(${this.x() - width / 2} ${this.y() - height / 2})`;
  });

  constructor() {
    afterRenderEffect(() => {
      // Read the label (and style) so a change re-measures, like upstream's
      // `useEffect(..., [label])`.
      this.label();
      this.labelStyle();
      const box = this.textRef()?.nativeElement.getBBox?.();
      if (!box) return; // jsdom has no getBBox: keep the zero box.
      const current = untracked(this.bbox);
      if (box.width === current.width && box.height === current.height) return;
      // Signal write: drives the re-render without Zone.js.
      this.bbox.set({ x: box.x, y: box.y, width: box.width, height: box.height });
    });
  }
}

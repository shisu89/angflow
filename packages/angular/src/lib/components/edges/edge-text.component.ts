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
import { toStyleString } from '../../utils/style';

const defaultLabelBgPadding: [number, number] = [2, 4];

/**
 * SVG edge label, the Angular counterpart of upstream `EdgeText`: a `<g>`
 * translated so the label's centre sits at `(x, y)` in flow coordinates, with
 * an optional background `<rect>` sized from the measured text. Hidden until
 * the text has been measured with `getBBox()`. Projected content renders
 * after the text, like upstream's `children`.
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
    <ng-content />
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
    afterRenderEffect({
      // Measure in a read phase. Reading the label (and its style) makes a
      // change re-measure, like upstream's `useEffect(..., [label])`; x/y
      // moves don't.
      earlyRead: () => {
        this.label();
        this.labelStyle();
        const box = this.textRef()?.nativeElement.getBBox?.();
        // jsdom has no getBBox: keep the zero box.
        return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
      },
      write: (measured) => {
        const box = measured();
        if (!box) return;
        const current = untracked(this.bbox);
        if (box.width === current.width && box.height === current.height) return;
        // Signal write: drives the re-render without Zone.js.
        this.bbox.set(box);
      },
    });
  }
}

import { Component, ChangeDetectionStrategy, input, inject, computed } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';

/** Visual pattern rendered behind the canvas. */
export type BackgroundVariant = 'dots' | 'lines' | 'cross';

/**
 * Tiled SVG background rendered behind nodes and edges. Pattern tracks the
 * viewport so it stays aligned while panning and zooming.
 *
 * @example
 * ```html
 * <ng-flow-background variant="dots" [gap]="20" />
 * <ng-flow-background variant="lines" color="#ddd" />
 * ```
 */
@Component({
  selector: 'ng-flow-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__background xy-flow__background xy-flow__container',
    'style': 'display: block; position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: -1;',
  },
  template: `
    <svg
      class="ng-flow__background-svg"
      [style.width]="'100%'"
      [style.height]="'100%'"
    >
      @if (bgColor()) {
        <rect x="0" y="0" width="100%" height="100%" [attr.fill]="bgColor()" />
      }
      <defs>
        @switch (variant()) {
          @case ('dots') {
            <pattern
              [attr.id]="patternId()"
              [attr.x]="patternOffset().x"
              [attr.y]="patternOffset().y"
              [attr.width]="scaledGapX()"
              [attr.height]="scaledGapY()"
              patternUnits="userSpaceOnUse"
            >
              <circle
                [class]="'xy-flow__background-pattern dots ' + (patternClassName() ?? '')"
                [attr.cx]="size() * zoom()"
                [attr.cy]="size() * zoom()"
                [attr.r]="size() * zoom()"
                [attr.fill]="color()"
              />
            </pattern>
          }
          @case ('lines') {
            <pattern
              [attr.id]="patternId()"
              [attr.x]="patternOffset().x"
              [attr.y]="patternOffset().y"
              [attr.width]="scaledGapX()"
              [attr.height]="scaledGapY()"
              patternUnits="userSpaceOnUse"
            >
              <path
                [class]="'xy-flow__background-pattern lines ' + (patternClassName() ?? '')"
                fill="none"
                [attr.stroke]="color()"
                [attr.stroke-width]="resolvedLineWidth() * zoom()"
                [attr.d]="'M ' + scaledGapX() + ' 0 L 0 0 0 ' + scaledGapY()"
              />
            </pattern>
          }
          @case ('cross') {
            <pattern
              [attr.id]="patternId()"
              [attr.x]="patternOffset().x"
              [attr.y]="patternOffset().y"
              [attr.width]="scaledGapX()"
              [attr.height]="scaledGapY()"
              patternUnits="userSpaceOnUse"
            >
              <path
                [class]="'xy-flow__background-pattern cross ' + (patternClassName() ?? '')"
                fill="none"
                [attr.stroke]="color()"
                [attr.stroke-width]="resolvedLineWidth() * zoom()"
                [attr.d]="crossPath()"
              />
            </pattern>
          }
        }
      </defs>
      <rect
        x="0" y="0" width="100%" height="100%"
        [attr.fill]="'url(#' + patternId() + ')'"
      />
    </svg>
  `,
})
export class BackgroundComponent {
  private store = inject(FlowStore);

  /** Pattern shape. */
  readonly variant = input<BackgroundVariant>('dots');
  /** Distance between pattern elements. Accepts a single number or `[x, y]`. */
  readonly gap = input<number | [number, number]>(20);
  /** Dot radius (for `dots`) or cross arm length (for `cross`). */
  readonly size = input(1);
  /** Stroke width for `lines` and `cross` variants. Defaults match `size` for dots. */
  readonly lineWidth = input<number>();
  /** Offset of the pattern origin from the viewport origin. */
  readonly offset = input<number | [number, number]>(0);
  /** Pattern stroke/fill color. */
  readonly color = input<string>();
  /** Solid fill drawn behind the pattern. Leave unset for transparent. */
  readonly bgColor = input<string>();
  /** Extra CSS class applied to each generated pattern shape. */
  readonly patternClassName = input<string>();
  /** Override the generated SVG pattern id. Aliased as `id`. */
  readonly bgId = input<string | undefined>(undefined, { alias: 'id' });

  readonly patternId = computed(() => {
    const customId = this.bgId();
    return customId ?? `ng-flow-bg-${this.store.rfId()}`;
  });

  readonly zoom = computed(() => this.store.transform()[2]);

  private readonly gapX = computed(() => {
    const g = this.gap();
    return Array.isArray(g) ? g[0] : g;
  });

  private readonly gapY = computed(() => {
    const g = this.gap();
    return Array.isArray(g) ? g[1] : g;
  });

  private readonly offsetX = computed(() => {
    const o = this.offset();
    return Array.isArray(o) ? o[0] : o;
  });

  private readonly offsetY = computed(() => {
    const o = this.offset();
    return Array.isArray(o) ? o[1] : o;
  });

  readonly scaledGapX = computed(() => this.gapX() * this.zoom());
  readonly scaledGapY = computed(() => this.gapY() * this.zoom());

  readonly resolvedLineWidth = computed(() => {
    const lw = this.lineWidth();
    if (lw !== undefined) return lw;
    return this.variant() === 'dots' ? this.size() : 1;
  });

  readonly patternOffset = computed(() => {
    const t = this.store.transform();
    return {
      x: t[0] % this.scaledGapX() + this.offsetX() * this.zoom(),
      y: t[1] % this.scaledGapY() + this.offsetY() * this.zoom(),
    };
  });

  readonly crossPath = computed(() => {
    const gx = this.scaledGapX();
    const gy = this.scaledGapY();
    const s = this.size() * this.zoom();
    const halfGX = gx / 2;
    const halfGY = gy / 2;
    return `M ${halfGX - s} ${halfGY} L ${halfGX + s} ${halfGY} M ${halfGX} ${halfGY - s} L ${halfGX} ${halfGY + s}`;
  });
}

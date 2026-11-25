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
    // As upstream: colours travel as CSS custom properties, because the
    // `.xy-flow__background*` rules would override fill/stroke attributes.
    '[style.--xy-background-color-props]': 'bgColor()',
    '[style.--xy-background-pattern-color-props]': 'color()',
  },
  template: `
    <svg
      class="ng-flow__background-svg"
      [style.width]="'100%'"
      [style.height]="'100%'"
    >
      <defs>
        <pattern
          [attr.id]="patternId()"
          [attr.x]="patternX()"
          [attr.y]="patternY()"
          [attr.width]="scaledGap()[0]"
          [attr.height]="scaledGap()[1]"
          patternUnits="userSpaceOnUse"
          [attr.patternTransform]="patternTransform()"
        >
          @if (variant() === 'dots') {
            <svg:circle
              [class]="'xy-flow__background-pattern dots ' + (patternClassName() ?? '')"
              [attr.cx]="scaledSize() / 2"
              [attr.cy]="scaledSize() / 2"
              [attr.r]="scaledSize() / 2"
            />
          } @else {
            <svg:path
              [class]="'xy-flow__background-pattern ' + variant() + ' ' + (patternClassName() ?? '')"
              fill="none"
              [attr.stroke-width]="resolvedLineWidth()"
              [attr.d]="linePath()"
            />
          }
        </pattern>
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
  /**
   * Dot diameter (for `dots`) or cross size (for `cross`), in flow units.
   * Defaults to 1, or 6 for `cross`; `0` also means the default.
   */
  readonly size = input<number>();
  /** Stroke width for the `lines` and `cross` variants, in screen px (not scaled by zoom). Defaults to 1. */
  readonly lineWidth = input<number>();
  /** Offset of the pattern origin, in flow units. */
  readonly offset = input<number | [number, number]>(0);
  /** Pattern stroke/fill color (sets `--xy-background-pattern-color-props`). */
  readonly color = input<string>();
  /** Background colour behind the pattern (sets `--xy-background-color-props`). Leave unset for the theme default. */
  readonly bgColor = input<string>();
  /** Extra CSS class applied to each generated pattern shape. */
  readonly patternClassName = input<string>();
  /**
   * Appended to the generated pattern id `pattern-<flowId>`. Give each
   * background in one flow a unique id. Aliased as `id`.
   */
  readonly bgId = input<string | undefined>(undefined, { alias: 'id' });

  readonly patternId = computed(() => `pattern-${this.store.rfId()}${this.bgId() ?? ''}`);

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

  readonly scaledGap = computed<[number, number]>(() => [
    this.gapX() * this.zoom() || 1,
    this.gapY() * this.zoom() || 1,
  ]);

  // upstream: `size || defaultSize[variant]`, so `size: 0` also falls back to the default
  private readonly patternSize = computed(() => this.size() || (this.variant() === 'cross' ? 6 : 1));

  readonly scaledSize = computed(() => this.patternSize() * this.zoom());

  /** Cell the line/cross path spans: the scaled size for `cross`, the scaled gap otherwise. */
  private readonly patternDimensions = computed<[number, number]>(() =>
    this.variant() === 'cross' ? [this.scaledSize(), this.scaledSize()] : this.scaledGap(),
  );

  readonly patternX = computed(() => this.store.transform()[0] % this.scaledGap()[0]);
  readonly patternY = computed(() => this.store.transform()[1] % this.scaledGap()[1]);

  readonly patternTransform = computed(() => {
    const [dx, dy] = this.patternDimensions();
    const z = this.zoom();
    return `translate(-${this.offsetX() * z + dx / 2},-${this.offsetY() * z + dy / 2})`;
  });

  // upstream destructures `lineWidth = 1`: undefined becomes 1, 0 stays 0; never scaled by zoom
  readonly resolvedLineWidth = computed(() => this.lineWidth() ?? 1);

  readonly linePath = computed(() => {
    const [w, h] = this.patternDimensions();
    return `M${w / 2} 0 V${h} M0 ${h / 2} H${w}`;
  });
}

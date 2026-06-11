import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  effect,
  ElementRef,
  viewChild,
  DestroyRef,
  Type,
} from '@angular/core';
import {
  getBoundsOfRects,
  XYMinimap,
  type XYMinimapInstance,
  type PanelPosition,
  type Rect,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { PanelComponent } from '../panel/panel.component';
import type { Node } from '../../types';

/**
 * Function form of a per-node minimap attribute (color, class, stroke color);
 * receives the node and returns a string applied to its rect.
 */
export type GetMiniMapNodeAttribute<NodeType extends Node = Node> = (node: NodeType) => string;

/**
 * Miniature overview of the whole graph with a viewport indicator.
 * Optionally pannable and zoomable to let the user navigate from the overview.
 *
 * @example
 * ```html
 * <ng-flow-minimap pannable zoomable [nodeColor]="colorByType" />
 * ```
 */
@Component({
  selector: 'ng-flow-minimap',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-panel [position]="position()">
      <div
        class="ng-flow__minimap xy-flow__minimap"
        #minimapContainer
        [attr.aria-label]="ariaLabel()"
        [style.width.px]="mmWidth()"
        [style.height.px]="mmHeight()"
        style="border-radius: 4px; overflow: hidden; border: 1px solid #ddd; box-shadow: 0 1px 4px rgba(0,0,0,0.1); cursor: pointer;"
        (click)="onMinimapClick($event)"
      >
        <svg
          #minimapSvg
          class="xy-flow__minimap-svg"
          [attr.width]="mmWidth()"
          [attr.height]="mmHeight()"
          [attr.viewBox]="viewBox()"
        >
          <!-- Background -->
          <rect x="-10000" y="-10000" width="20000" height="20000" [attr.fill]="bgColor() ?? '#f0f0f0'" />
          <!-- Nodes -->
          <!--
            Colors are bound as inline [style.*], NOT [attr.*]: the bundled
            stylesheet sets a fill CSS property on .xy-flow__minimap-node, and a
            CSS property always overrides an SVG fill presentation attribute.
            Inline styles win over stylesheet rules, so the inputs actually take
            effect. When an input is unset (undefined) we emit no inline value,
            deferring to the stylesheet's CSS-variable theming (incl. dark mode).
          -->
          @for (node of minimapNodes(); track node.id) {
            <rect
              class="xy-flow__minimap-node"
              [class]="getNodeClassName(node)"
              [attr.x]="node.x"
              [attr.y]="node.y"
              [attr.width]="node.width"
              [attr.height]="node.height"
              [attr.rx]="nodeBorderRadius()"
              [style.fill]="getNodeColor(node)"
              [style.stroke]="getNodeStrokeColor(node)"
              [style.stroke-width]="nodeStrokeWidth()"
              (click)="onMinimapNodeClick($event, node)"
            />
          }
          <!-- Mask overlay: dim area outside viewport via evenodd path -->
          <path
            class="xy-flow__minimap-mask"
            [attr.d]="maskPath()"
            [style.fill]="maskColor()"
            fill-rule="evenodd"
            style="pointer-events: none;"
          />
          <!-- Viewport outline -->
          <rect
            [attr.x]="maskPosition().x"
            [attr.y]="maskPosition().y"
            [attr.width]="maskPosition().width"
            [attr.height]="maskPosition().height"
            fill="none"
            [attr.stroke]="maskStrokeColor() ?? 'rgba(0,89,220,0.6)'"
            [attr.stroke-width]="scaledMaskStrokeWidth()"
            rx="2"
          />
        </svg>
      </div>
    </ng-flow-panel>
  `,
})
export class MiniMapComponent {
  readonly store = inject(FlowStore);
  private minimapContainerRef = viewChild<ElementRef>('minimapContainer');
  private minimapSvgRef = viewChild<ElementRef<SVGSVGElement>>('minimapSvg');

  /** Where the minimap panel is anchored. */
  readonly position = input<PanelPosition>('bottom-right');
  /** Minimap width in pixels. Aliased as `width`. */
  readonly mmWidth = input(200, { alias: 'width' });
  /** Minimap height in pixels. Aliased as `height`. */
  readonly mmHeight = input(150, { alias: 'height' });
  /** Allow dragging on the minimap to pan the main viewport. */
  readonly pannable = input(false);
  /** Allow scroll-wheel on the minimap to zoom the main viewport. */
  readonly zoomable = input(false);
  /** Zoom step applied per wheel tick when `zoomable`. */
  readonly zoomStep = input(1);
  /** Invert the pan direction when dragging on the minimap. */
  readonly inversePan = input(false);

  /**
   * Node fill color, or function mapping node → color. Unset → falls back to
   * the `--xy-minimap-node-background-color` theme variable via the stylesheet.
   */
  readonly nodeColor = input<string | GetMiniMapNodeAttribute>();
  /**
   * Node stroke color, or function mapping node → color. Unset → falls back to
   * the `--xy-minimap-node-stroke-color` theme variable via the stylesheet.
   */
  readonly nodeStrokeColor = input<string | GetMiniMapNodeAttribute>();
  /** Node CSS class, or function mapping node → class. */
  readonly nodeClassName = input<string | GetMiniMapNodeAttribute>('');
  /** Corner radius (rx) for node rects. */
  readonly nodeBorderRadius = input(5);
  /** Stroke width for node rects. */
  readonly nodeStrokeWidth = input(2);
  /** Reserved — custom Angular component to render each minimap node. Not yet wired. */
  readonly nodeComponent = input<Type<unknown> | null>(null);

  /** Background fill behind the nodes. Defaults to `#f0f0f0`. */
  readonly bgColor = input<string>();
  /**
   * Overlay fill for the area outside the current viewport. Unset → falls back
   * to the `--xy-minimap-mask-background-color` theme variable via the stylesheet.
   */
  readonly maskColor = input<string>();
  /** Stroke color of the viewport rectangle. */
  readonly maskStrokeColor = input<string>();
  /** Stroke width of the viewport rectangle (scaled by view scale). */
  readonly maskStrokeWidth = input(6);
  /** Padding around the graph bounds, scaled with the view. */
  readonly offsetScale = input(5);

  /** ARIA label for the minimap. */
  readonly ariaLabel = input<string | null>('Mini Map');

  /** Fires when the minimap is clicked, with the flow-space position under the click. */
  readonly minimapClick = output<{ event: MouseEvent; position: { x: number; y: number } }>();
  /** Fires when a node rendered in the minimap is clicked. */
  readonly minimapNodeClick = output<{ event: MouseEvent; node: Node }>();

  private minimap: XYMinimapInstance | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Defer creation until the view exists (SVG ref) AND panZoom is ready.
    // A plain constructor effect re-runs when either the `minimapSvg` viewChild
    // signal resolves (undefined → element on first render) or store.panZoom()
    // becomes non-null, mirroring how the main pane defers its own d3-zoom
    // wiring in ng-flow.component.ts. The `!this.minimap` guard makes it
    // idempotent so creation happens exactly once.
    effect(() => {
      const panZoom = this.store.panZoom();
      const svgEl = this.minimapSvgRef()?.nativeElement;
      if (!panZoom || !svgEl || this.minimap) return;

      this.minimap = XYMinimap({
        domNode: svgEl,
        panZoom,
        getTransform: () => this.store.transform(),
        getViewScale: () => this.viewBoxData().viewScale,
      });

      // Push the first update immediately so the d3-zoom handlers are bound
      // with the current inputs without waiting for the next change.
      this.pushMinimapUpdate();
    });

    // Keep XYMinimap in sync with the React-parity inputs + the store extent.
    // The d3 callbacks XYMinimap installs write via panZoom → the transform
    // signal the template reads (zoneless rule 2 satisfied), and those writes
    // flow through the same panZoom path as the main pane, so the C1 contract
    // (no bumpVersion on transform writes) holds.
    effect(() => {
      // Read every dependency first (unconditionally) so the effect tracks the
      // inputs + store extent even before the minimap instance is created — an
      // early `if (!this.minimap) return` would track nothing and never re-run.
      this.pushMinimapUpdate();
    });

    destroyRef.onDestroy(() => {
      this.minimap?.destroy();
      this.minimap = null;
    });
  }

  private pushMinimapUpdate(): void {
    const params = {
      translateExtent: this.store.translateExtent(),
      width: this.store.width(),
      height: this.store.height(),
      inversePan: this.inversePan(),
      zoomStep: this.zoomStep(),
      pannable: this.pannable(),
      zoomable: this.zoomable(),
    };
    this.minimap?.update(params);
  }

  readonly minimapNodes = computed(() => {
    this.store.version(); // react to node changes
    const hidden = this.store.collapsedHiddenIds();
    const nodes = Array.from(this.store.nodeLookup.values()).filter((node) => !hidden.has(node.id));
    return nodes.map((node) => ({
      id: node.id,
      x: node.internals?.positionAbsolute?.x ?? 0,
      y: node.internals?.positionAbsolute?.y ?? 0,
      width: node.measured?.width ?? node.width ?? 150,
      height: node.measured?.height ?? node.height ?? 40,
      _userNode: node.internals?.userNode,
    }));
  });

  // Current viewport rect expressed in flow coordinates.
  readonly maskPosition = computed(() => {
    const t = this.store.transform();
    const w = this.store.width();
    const h = this.store.height();
    return {
      x: -t[0] / t[2],
      y: -t[1] / t[2],
      width: w / t[2],
      height: h / t[2],
    };
  });

  // Union of nodes bounds + viewport rect, aspect-ratio corrected to the
  // minimap SVG's own width/height, plus an offsetScale * viewScale padding
  // on all sides. This mirrors React Flow's approach so the viewBox always
  // contains both the nodes and the current viewport — without it, the mask
  // "hole" (viewport rect) can cover the entire visible viewBox and the
  // dim-outside-viewport contrast disappears.
  readonly viewBoxData = computed(() => {
    this.store.version();

    const viewBB: Rect = this.maskPosition();
    const nodes = this.minimapNodes();

    let boundingRect: Rect;
    if (nodes.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.width > maxX) maxX = n.x + n.width;
        if (n.y + n.height > maxY) maxY = n.y + n.height;
      }
      const nodesRect: Rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      boundingRect = getBoundsOfRects(nodesRect, viewBB);
    } else {
      boundingRect = viewBB;
    }

    const elementWidth = this.mmWidth();
    const elementHeight = this.mmHeight();
    const scaledWidth = boundingRect.width / elementWidth;
    const scaledHeight = boundingRect.height / elementHeight;
    const viewScale = Math.max(scaledWidth, scaledHeight) || 1;
    const viewWidth = viewScale * elementWidth;
    const viewHeight = viewScale * elementHeight;
    const offset = this.offsetScale() * viewScale;
    const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
    const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
    const width = viewWidth + offset * 2;
    const height = viewHeight + offset * 2;

    return { x, y, width, height, viewScale };
  });

  readonly viewBox = computed(() => {
    const v = this.viewBoxData();
    return `${v.x} ${v.y} ${v.width} ${v.height}`;
  });

  // Scale the viewport outline stroke by viewScale so it renders at a
  // consistent CSS-pixel thickness regardless of how zoomed-out the
  // minimap's internal coordinate system is.
  readonly scaledMaskStrokeWidth = computed(() => this.maskStrokeWidth() * this.viewBoxData().viewScale);

  // SVG path for the mask: big outer rect + inner viewport rect.
  // Combined with fill-rule="evenodd", the overlap of the two subpaths
  // becomes a hole — dimming everything outside the viewport while
  // leaving nodes inside the viewport fully visible.
  readonly maskPath = computed(() => {
    const m = this.maskPosition();
    return (
      `M-10000,-10000h20000v20000h-20000z ` +
      `M${m.x},${m.y}h${m.width}v${m.height}h${-m.width}z`
    );
  });

  // Returns the resolved fill for a node, or undefined when the input is unset
  // so no inline style is emitted and the stylesheet's CSS-variable theming
  // (incl. dark mode) applies.
  getNodeColor(node: { _userNode?: Node }): string | undefined {
    const color = this.nodeColor();
    if (typeof color === 'function') {
      return node._userNode ? color(node._userNode) : undefined;
    }
    return color;
  }

  getNodeStrokeColor(node: { _userNode?: Node }): string | undefined {
    const strokeColor = this.nodeStrokeColor();
    if (typeof strokeColor === 'function') {
      return node._userNode ? strokeColor(node._userNode) : undefined;
    }
    return strokeColor;
  }

  getNodeClassName(node: { _userNode?: Node }): string {
    const className = this.nodeClassName();
    if (typeof className === 'function' && node._userNode) {
      return className(node._userNode);
    }
    return typeof className === 'string' ? className : '';
  }

  onMinimapClick(event: MouseEvent): void {
    // minimap.pointer maps the click to flow coordinates using the SVG's
    // current viewBox (d3-selection pointer against the bound SVG element).
    const [x, y] = this.minimap ? this.minimap.pointer(event) : [0, 0];

    this.minimapClick.emit({ event, position: { x, y } });

    if (!this.pannable()) return;

    // setCenter (flow-store) honors interpolate/duration after Cluster 1; we
    // only depend on passing duration here.
    void this.store.setCenter(x, y, { zoom: this.store.transform()[2], duration: 300 });
  }

  onMinimapNodeClick(event: MouseEvent, node: { _userNode?: Node }): void {
    event.stopPropagation();
    if (node._userNode) {
      this.minimapNodeClick.emit({ event, node: node._userNode });
    }
  }

}

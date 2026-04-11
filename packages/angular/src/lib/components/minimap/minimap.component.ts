import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  ElementRef,
  viewChild,
  AfterViewInit,
  OnDestroy,
  Type,
} from '@angular/core';
import {
  XYMinimap,
  getInternalNodesBounds,
  getBoundsOfRects,
  type PanelPosition,
  type Rect,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { PanelComponent } from '../panel/panel.component';
import type { Node, InternalNode } from '../../types';

export type GetMiniMapNodeAttribute<NodeType extends Node = Node> = (node: NodeType) => string;

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
        (mousedown)="onMinimapMouseDown($event)"
        (wheel)="onMinimapWheel($event)"
      >
        <svg
          class="xy-flow__minimap-svg"
          [attr.width]="mmWidth()"
          [attr.height]="mmHeight()"
          [attr.viewBox]="viewBox()"
        >
          <!-- Background -->
          <rect x="-10000" y="-10000" width="20000" height="20000" [attr.fill]="bgColor() ?? '#f0f0f0'" />
          <!-- Nodes -->
          @for (node of minimapNodes(); track node.id) {
            <rect
              class="xy-flow__minimap-node"
              [class]="getNodeClassName(node)"
              [attr.x]="node.x"
              [attr.y]="node.y"
              [attr.width]="node.width"
              [attr.height]="node.height"
              [attr.rx]="nodeBorderRadius()"
              [attr.fill]="getNodeColor(node)"
              [attr.stroke]="getNodeStrokeColor(node)"
              [attr.stroke-width]="nodeStrokeWidth()"
              (click)="onMinimapNodeClick($event, node)"
            />
          }
          <!-- Mask overlay: dim area outside viewport via evenodd path -->
          @if (maskColor()) {
            <path
              class="xy-flow__minimap-mask"
              [attr.d]="maskPath()"
              [attr.fill]="maskColor()"
              fill-rule="evenodd"
              style="pointer-events: none;"
            />
          }
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
export class MiniMapComponent implements AfterViewInit, OnDestroy {
  readonly store = inject(FlowStore);
  private minimapContainerRef = viewChild<ElementRef>('minimapContainer');

  readonly position = input<PanelPosition>('bottom-right');
  readonly mmWidth = input(200, { alias: 'width' });
  readonly mmHeight = input(150, { alias: 'height' });
  readonly pannable = input(false);
  readonly zoomable = input(false);
  readonly zoomStep = input(10);
  readonly inversePan = input(false);

  // Node styling
  readonly nodeColor = input<string | GetMiniMapNodeAttribute>('#e2e2e2');
  readonly nodeStrokeColor = input<string | GetMiniMapNodeAttribute>('transparent');
  readonly nodeClassName = input<string | GetMiniMapNodeAttribute>('');
  readonly nodeBorderRadius = input(5);
  readonly nodeStrokeWidth = input(2);
  readonly nodeComponent = input<Type<unknown> | null>(null);

  // Appearance
  readonly bgColor = input<string>();
  readonly maskColor = input<string>('rgba(240, 240, 240, 0.6)');
  readonly maskStrokeColor = input<string>();
  readonly maskStrokeWidth = input(6);
  readonly offsetScale = input(5);

  // Accessibility
  readonly ariaLabel = input<string | null>('Mini Map');

  // Events
  readonly minimapClick = output<{ event: MouseEvent; position: { x: number; y: number } }>();
  readonly minimapNodeClick = output<{ event: MouseEvent; node: Node }>();

  private xyMinimap: ReturnType<typeof XYMinimap> | null = null;
  private animationFrameId: number | null = null;
  private isDragging = false;
  // Tracks whether the mouse actually moved between mousedown and mouseup.
  // Used to suppress the synthetic click event that fires after a drag, which
  // would otherwise trigger a second pan animation on top of the drag.
  private dragMoved = false;
  private boundOnMouseMove = this.onMinimapMouseMove.bind(this);
  private boundOnMouseUp = this.onMinimapMouseUp.bind(this);

  readonly minimapNodes = computed(() => {
    this.store.version(); // react to node changes
    const nodes = Array.from(this.store.nodeLookup.values());
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

  getNodeColor(node: { _userNode?: Node }): string {
    const color = this.nodeColor();
    if (typeof color === 'function' && node._userNode) {
      return color(node._userNode);
    }
    return typeof color === 'string' ? color : '#e2e2e2';
  }

  getNodeStrokeColor(node: { _userNode?: Node }): string {
    const strokeColor = this.nodeStrokeColor();
    if (typeof strokeColor === 'function' && node._userNode) {
      return strokeColor(node._userNode);
    }
    return typeof strokeColor === 'string' ? strokeColor : 'transparent';
  }

  getNodeClassName(node: { _userNode?: Node }): string {
    const className = this.nodeClassName();
    if (typeof className === 'function' && node._userNode) {
      return className(node._userNode);
    }
    return typeof className === 'string' ? className : '';
  }

  ngAfterViewInit(): void {}

  onMinimapClick(event: MouseEvent): void {
    // Browsers fire `click` after `mouseup` when both land on the same element,
    // regardless of drag distance. If the user was panning the minimap, swallow
    // this trailing click so we don't start a second pan animation on top.
    if (this.dragMoved) {
      this.dragMoved = false;
      return;
    }

    const container = this.minimapContainerRef()?.nativeElement;
    if (!container) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Get click position relative to the minimap SVG
    const rect = svgEl.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Convert from SVG pixel coords to flow coords using the current viewBox.
    const v = this.viewBoxData();
    const flowX = v.x + (clickX / this.mmWidth()) * v.width;
    const flowY = v.y + (clickY / this.mmHeight()) * v.height;

    // Emit click event
    this.minimapClick.emit({ event, position: { x: flowX, y: flowY } });

    if (!this.pannable()) return;

    // Pan viewport to center on the clicked flow position
    const zoom = this.store.transform()[2];
    const newX = this.store.width() / 2 - flowX * zoom;
    const newY = this.store.height() / 2 - flowY * zoom;

    // Cancel any in-flight animation before starting a new one
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Animate the viewport pan over ~300ms using requestAnimationFrame
    const startX = this.store.transform()[0];
    const startY = this.store.transform()[1];
    const startTime = performance.now();
    const duration = 300;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      const currentX = startX + (newX - startX) * ease;
      const currentY = startY + (newY - startY) * ease;

      this.store.transform.set([currentX, currentY, zoom]);
      this.store.bumpVersion();

      if (t < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
        // Sync d3-zoom internal state without transition
        try {
          this.store.panZoom()?.syncViewport({ x: newX, y: newY, zoom });
        } catch {
          // d3-transition may not be available; the transform signal
          // is the source of truth and d3 will re-sync on next interaction
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  onMinimapMouseDown(event: MouseEvent): void {
    if (!this.pannable()) return;
    this.isDragging = true;
    this.dragMoved = false;
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private onMinimapMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.dragMoved = true;

    const container = this.minimapContainerRef()?.nativeElement;
    if (!container) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const v = this.viewBoxData();
    const flowX = v.x + (clickX / this.mmWidth()) * v.width;
    const flowY = v.y + (clickY / this.mmHeight()) * v.height;

    const zoom = this.store.transform()[2];
    const newX = this.store.width() / 2 - flowX * zoom;
    const newY = this.store.height() / 2 - flowY * zoom;

    this.store.transform.set([newX, newY, zoom]);
    this.store.bumpVersion();
    try {
      this.store.panZoom()?.syncViewport({ x: newX, y: newY, zoom });
    } catch { /* noop */ }
  }

  private onMinimapMouseUp(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
  }

  onMinimapWheel(event: WheelEvent): void {
    if (!this.zoomable()) return;
    event.preventDefault();

    const currentZoom = this.store.transform()[2];
    const delta = -event.deltaY * (this.zoomStep() / 1000);
    const nextZoom = Math.min(
      this.store.maxZoom(),
      Math.max(this.store.minZoom(), currentZoom + delta)
    );

    const [x, y] = this.store.transform();
    // Zoom toward the center of the viewport
    const cx = this.store.width() / 2;
    const cy = this.store.height() / 2;
    const scale = nextZoom / currentZoom;
    const newX = cx - (cx - x) * scale;
    const newY = cy - (cy - y) * scale;

    this.store.transform.set([newX, newY, nextZoom]);
    this.store.bumpVersion();
    try {
      this.store.panZoom()?.syncViewport({ x: newX, y: newY, zoom: nextZoom });
    } catch { /* noop */ }
  }

  onMinimapNodeClick(event: MouseEvent, node: { _userNode?: Node }): void {
    event.stopPropagation();
    if (node._userNode) {
      this.minimapNodeClick.emit({ event, node: node._userNode });
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    this.xyMinimap?.destroy();
  }

}

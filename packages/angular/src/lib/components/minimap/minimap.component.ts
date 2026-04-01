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
  type PanelPosition,
} from '@ngflow/system';
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
      >
        <svg
          class="xy-flow__minimap-svg"
          [attr.width]="mmWidth()"
          [attr.height]="mmHeight()"
          [attr.viewBox]="viewBox()"
        >
          <!-- Background -->
          <rect x="-10000" y="-10000" width="20000" height="20000" [attr.fill]="bgColor() ?? '#f0f0f0'" />
          <!-- Mask: dim area outside viewport -->
          <defs>
            <clipPath [attr.id]="'minimap-mask-' + store.rfId()">
              <rect x="-10000" y="-10000" width="20000" height="20000" />
            </clipPath>
          </defs>
          <!-- Viewport window (bright area) -->
          <rect
            [attr.x]="maskPosition().x"
            [attr.y]="maskPosition().y"
            [attr.width]="maskPosition().width"
            [attr.height]="maskPosition().height"
            fill="#fff"
          />
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
          <!-- Viewport outline -->
          <rect
            [attr.x]="maskPosition().x"
            [attr.y]="maskPosition().y"
            [attr.width]="maskPosition().width"
            [attr.height]="maskPosition().height"
            fill="none"
            [attr.stroke]="maskStrokeColor() ?? 'rgba(0,89,220,0.6)'"
            [attr.stroke-width]="maskStrokeWidth()"
            rx="2"
          />
          <!-- Mask overlay (dim non-viewport area) -->
          @if (maskColor()) {
            <rect x="-10000" y="-10000" width="20000" height="20000"
              [attr.fill]="maskColor()"
              style="pointer-events: none;"
            />
            <rect
              [attr.x]="maskPosition().x"
              [attr.y]="maskPosition().y"
              [attr.width]="maskPosition().width"
              [attr.height]="maskPosition().height"
              fill="#fff"
              style="pointer-events: none;"
            />
          }
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

  readonly viewBox = computed(() => {
    this.store.version();
    const bounds = this.computeBounds();
    const padding = 20;
    return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
  });

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
    const container = this.minimapContainerRef()?.nativeElement;
    if (!container) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Get click position relative to the minimap SVG
    const rect = svgEl.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Convert from SVG pixel coords to viewBox coords
    const bounds = this.computeBounds();
    const padding = 20;
    const vbX = bounds.x - padding;
    const vbY = bounds.y - padding;
    const vbW = bounds.width + padding * 2;
    const vbH = bounds.height + padding * 2;

    const flowX = vbX + (clickX / this.mmWidth()) * vbW;
    const flowY = vbY + (clickY / this.mmHeight()) * vbH;

    // Emit click event
    this.minimapClick.emit({ event, position: { x: flowX, y: flowY } });

    if (!this.pannable()) return;

    // Pan viewport to center on the clicked flow position
    const zoom = this.store.transform()[2];
    const newX = this.store.width() / 2 - flowX * zoom;
    const newY = this.store.height() / 2 - flowY * zoom;

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
        requestAnimationFrame(animate);
      } else {
        // Sync d3-zoom internal state without transition
        try {
          this.store.panZoom()?.syncViewport({ x: newX, y: newY, zoom });
        } catch {
          // d3-transition may not be available; the transform signal
          // is the source of truth and d3 will re-sync on next interaction
        }
      }
    };

    requestAnimationFrame(animate);
  }

  onMinimapNodeClick(event: MouseEvent, node: { _userNode?: Node }): void {
    event.stopPropagation();
    if (node._userNode) {
      this.minimapNodeClick.emit({ event, node: node._userNode });
    }
  }

  ngOnDestroy(): void {
    this.xyMinimap?.destroy();
  }

  private computeBounds() {
    const nodes = this.minimapNodes();
    if (nodes.length === 0) return { x: 0, y: 0, width: 200, height: 150 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  effect,
  Injector,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  Optional,
  Inject,
} from '@angular/core';
import {
  XYResizer,
  type ControlPosition,
  type OnResizeStart,
  type OnResize,
  type OnResizeEnd,
  type ShouldResize,
  type XYResizerChange,
  type XYResizerChildChange,
  type ResizeDragEvent,
  type ResizeParams,
  type NodeChange,
  type NodeDimensionChange,
  type NodePositionChange,
  type XYPosition,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

/** Control positions, in the same order as the template elements (4 corners, then 4 lines). */
const CONTROL_POSITIONS: ControlPosition[] = [
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
  'top', 'right', 'bottom', 'left',
];

/**
 * Adds draggable resize handles and edges to a node. Place inside a node
 * template — the resizer auto-discovers the host node id — or pass `[nodeId]`
 * explicitly to target a different node.
 *
 * @example
 * ```html
 * <ng-flow-node-resizer [minWidth]="80" [minHeight]="40" [keepAspectRatio]="true" />
 * ```
 */
@Component({
  selector: 'ng-flow-node-resizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__node-resizer xy-flow__resize-control',
    'style': 'position: absolute; inset: 0; pointer-events: none;',
    '[style.display]': 'effectivelyVisible() ? null : "none"',
  },
  template: `
    <div
      class="xy-flow__resize-control nodrag handle handle-top-left top left"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'"
      [style.cursor]="'nw-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag handle handle-top-right top right"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.right]="'0'"
      [style.cursor]="'ne-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag handle handle-bottom-left bottom left"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.left]="'0'"
      [style.cursor]="'sw-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag handle handle-bottom-right bottom right"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.right]="'0'"
      [style.cursor]="'se-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <!-- Resize lines -->
    <div
      class="xy-flow__resize-control nodrag line line-top top"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'" [style.right]="'0'"
      [style.height.px]="2" [style.cursor]="'n-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag line line-right right"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.right]="'0'" [style.bottom]="'0'"
      [style.width.px]="2" [style.cursor]="'e-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag line line-bottom bottom"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.left]="'0'" [style.right]="'0'"
      [style.height.px]="2" [style.cursor]="'s-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag line line-left left"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'" [style.bottom]="'0'"
      [style.width.px]="2" [style.cursor]="'w-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
  `,
})
export class NodeResizerComponent implements AfterViewInit, OnDestroy {
  private store = inject(FlowStore);
  private el = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);

  /** Node to resize. Defaults to the host node when placed inside a node template. Aliased as `nodeId`. */
  readonly nodeIdInput = input<string | undefined>(undefined, { alias: 'nodeId' });
  /** Minimum allowed width in pixels. */
  readonly minWidth = input(10);
  /** Minimum allowed height in pixels. */
  readonly minHeight = input(10);
  /** Maximum allowed width in pixels. */
  readonly maxWidth = input(Infinity);
  /** Maximum allowed height in pixels. */
  readonly maxHeight = input(Infinity);
  /** Constrain resize so width/height stay proportional. */
  readonly keepAspectRatio = input(false);
  /**
   * Controls handle visibility.
   * - `undefined` (default): auto — handles show only when the host node is selected.
   * - `true`: always visible, regardless of selection.
   * - `false`: always hidden.
   */
  readonly isVisible = input<boolean | undefined>(undefined);
  /** Fill color for corner handles and edge border color for lines. */
  readonly color = input<string>();
  /** Extra CSS class applied to each corner handle. */
  readonly handleClassName = input<string>('');
  /** Inline styles applied to each corner handle. */
  readonly handleStyle = input<Partial<CSSStyleDeclaration>>();
  /** Extra CSS class applied to each edge line. */
  readonly lineClassName = input<string>('');
  /** Inline styles applied to each edge line. */
  readonly lineStyle = input<Partial<CSSStyleDeclaration>>();
  /** Scale handle size inversely with zoom so they stay visually constant. */
  readonly autoScale = input(true);
  /** Callback that returns `false` to veto a proposed resize step. */
  readonly shouldResize = input<ShouldResize>();
  /** Alternative to `(resizeStart)` — function form. Aliased as `onResizeStart`. */
  readonly onResizeStartCb = input<OnResizeStart | undefined>(undefined, { alias: 'onResizeStart' });
  /** Alternative to `(resize)` — function form. Aliased as `onResize`. */
  readonly onResizeCb = input<OnResize | undefined>(undefined, { alias: 'onResize' });
  /** Alternative to `(resizeEnd)` — function form. Aliased as `onResizeEnd`. */
  readonly onResizeEndCb = input<OnResizeEnd | undefined>(undefined, { alias: 'onResizeEnd' });

  /** Fires when a resize gesture starts. */
  readonly resizeStart = output<{ event: ResizeDragEvent } & ResizeParams>();
  /** Fires per frame while resizing, with the current dimension/position change. */
  readonly resize = output<{ event?: ResizeDragEvent; changes?: XYResizerChange; childChanges?: XYResizerChildChange[] } & Partial<ResizeParams>>();
  /** Fires when the resize gesture ends, with the final dimensions. */
  readonly resizeEnd = output<{ event?: ResizeDragEvent; changes?: Required<XYResizerChange> } & Partial<ResizeParams>>();

  private nodeId: string = '';
  private resizerInstances: ReturnType<typeof XYResizer>[] = [];

  /**
   * Host-level visibility: explicit `isVisible` wins; otherwise follow the
   * owning node's `selected` state so handles only show on selection.
   */
  readonly effectivelyVisible = computed(() => {
    const explicit = this.isVisible();
    if (explicit !== undefined) return explicit;
    // Establish reactive dependency on node state (selection changes setNodes).
    const nodes = this.store.nodes();
    const id = this.nodeIdInput() ?? this.nodeId;
    if (!id) return true;
    const node = nodes.find((n) => n.id === id);
    return node?.selected ?? false;
  });

  constructor(@Optional() @Inject(NODE_ID) nodeId: string | null) {
    this.nodeId = nodeId ?? '';
  }

  ngAfterViewInit(): void {
    const resolvedNodeId = this.nodeIdInput() ?? this.nodeId;
    // Template order: 4 corners, then 4 lines. Must match CONTROL_POSITIONS.
    const handles: HTMLDivElement[] = Array.from(
      (this.el.nativeElement as HTMLElement).querySelectorAll(':scope > .xy-flow__resize-control')
    ) as HTMLDivElement[];

    handles.forEach((handle) => {
      const resizer = XYResizer({
        domNode: handle as HTMLDivElement,
        nodeId: resolvedNodeId,
        getStoreItems: () => ({
          nodeLookup: this.store.nodeLookup,
          transform: this.store.transform(),
          snapGrid: this.store.snapToGrid() ? this.store.snapGrid() : undefined,
          snapToGrid: this.store.snapToGrid(),
          nodeOrigin: this.store.nodeOrigin(),
          paneDomNode: this.store.domNode(),
        }),
        onChange: (change: XYResizerChange, childChanges: XYResizerChildChange[]) => {
          const nodeChanges: NodeChange[] = [];
          const nextPosition: Partial<XYPosition> = { x: change.x, y: change.y };

          if (nextPosition.x !== undefined && nextPosition.y !== undefined) {
            nodeChanges.push({
              id: resolvedNodeId,
              type: 'position',
              position: { x: nextPosition.x, y: nextPosition.y },
            } as NodePositionChange);
          }

          if (change.width !== undefined && change.height !== undefined) {
            nodeChanges.push({
              id: resolvedNodeId,
              type: 'dimensions',
              resizing: true,
              setAttributes: true,
              dimensions: { width: change.width, height: change.height },
            } as NodeDimensionChange);
          }

          for (const childChange of childChanges) {
            nodeChanges.push({
              id: childChange.id,
              type: 'position',
              position: childChange.position,
            } as NodePositionChange);
          }

          if (nodeChanges.length > 0) {
            this.store.triggerNodeChanges(nodeChanges);
          }

          this.resize.emit({ changes: change, childChanges });
        },
        onEnd: (change: Required<XYResizerChange>) => {
          this.store.triggerNodeChanges([
            {
              id: resolvedNodeId,
              type: 'dimensions',
              resizing: false,
              dimensions: { width: change.width, height: change.height },
            } as NodeDimensionChange,
          ]);
          this.resizeEnd.emit({ changes: change });
        },
      });

      this.resizerInstances.push(resizer);
    });

    // Apply config now, then re-apply reactively whenever any config input
    // changes. XYResizer.update() is idempotent, so the effect's first run
    // re-applying the same config is harmless.
    this.applyResizerConfig();
    effect(() => this.applyResizerConfig(), { injector: this.injector });
  }

  private applyResizerConfig(): void {
    const boundaries = {
      minWidth: this.minWidth(),
      minHeight: this.minHeight(),
      maxWidth: this.maxWidth(),
      maxHeight: this.maxHeight(),
    };
    const keepAspectRatio = this.keepAspectRatio();
    const shouldResize = this.shouldResize();
    const onResizeStart = this.onResizeStartCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeStart.emit({ event, ...params });
    });
    const onResize = this.onResizeCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resize.emit({ event, ...params });
    });
    const onResizeEnd = this.onResizeEndCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeEnd.emit({ event, ...params });
    });

    this.resizerInstances.forEach((resizer, index) => {
      resizer.update({
        controlPosition: CONTROL_POSITIONS[index],
        boundaries,
        keepAspectRatio,
        onResizeStart,
        onResize,
        onResizeEnd,
        shouldResize,
      });
    });
  }

  ngOnDestroy(): void {
    this.resizerInstances.forEach((r) => r.destroy());
  }
}

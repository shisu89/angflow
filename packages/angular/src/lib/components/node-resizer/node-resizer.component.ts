import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
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
  type ResizeParamsWithDirection,
  type NodeChange,
  type NodeDimensionChange,
  type NodePositionChange,
  type XYPosition,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

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

  readonly nodeIdInput = input<string | undefined>(undefined, { alias: 'nodeId' });
  readonly minWidth = input(10);
  readonly minHeight = input(10);
  readonly maxWidth = input(Infinity);
  readonly maxHeight = input(Infinity);
  readonly keepAspectRatio = input(false);
  /**
   * Controls handle visibility.
   * - `undefined` (default): auto — handles show only when the host node is selected.
   * - `true`: always visible, regardless of selection.
   * - `false`: always hidden.
   */
  readonly isVisible = input<boolean | undefined>(undefined);
  readonly color = input<string>();
  readonly handleClassName = input<string>('');
  readonly handleStyle = input<Partial<CSSStyleDeclaration>>();
  readonly lineClassName = input<string>('');
  readonly lineStyle = input<Partial<CSSStyleDeclaration>>();
  readonly autoScale = input(true);
  readonly shouldResize = input<ShouldResize>();
  readonly onResizeStartCb = input<OnResizeStart | undefined>(undefined, { alias: 'onResizeStart' });
  readonly onResizeCb = input<OnResize | undefined>(undefined, { alias: 'onResize' });
  readonly onResizeEndCb = input<OnResizeEnd | undefined>(undefined, { alias: 'onResizeEnd' });

  readonly resizeStart = output<{ event: ResizeDragEvent } & ResizeParams>();
  readonly resize = output<{ event?: ResizeDragEvent; changes?: XYResizerChange; childChanges?: XYResizerChildChange[] } & Partial<ResizeParams>>();
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
    // Template order: 4 corners, then 4 lines. Must match `positions` below.
    const handles: HTMLDivElement[] = Array.from(
      (this.el.nativeElement as HTMLElement).querySelectorAll(':scope > .xy-flow__resize-control')
    ) as HTMLDivElement[];
    const positions: ControlPosition[] = [
      'top-left', 'top-right', 'bottom-left', 'bottom-right',
      'top', 'right', 'bottom', 'left',
    ];

    handles.forEach((handle, index) => {
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

      resizer.update({
        controlPosition: positions[index],
        boundaries: {
          minWidth: this.minWidth(),
          minHeight: this.minHeight(),
          maxWidth: this.maxWidth(),
          maxHeight: this.maxHeight(),
        },
        keepAspectRatio: this.keepAspectRatio(),
        // Use stable closures that always delegate to the current signal values
        // so that input changes after init are picked up correctly.
        onResizeStart: (event: ResizeDragEvent, params: ResizeParams) => {
          const cb = this.onResizeStartCb();
          if (cb) {
            cb(event, params);
          } else {
            this.resizeStart.emit({ event, ...params });
          }
        },
        onResize: (event: ResizeDragEvent, params: ResizeParamsWithDirection) => {
          const cb = this.onResizeCb();
          if (cb) {
            cb(event, params);
          } else {
            this.resize.emit({ event, ...params });
          }
        },
        onResizeEnd: (event: ResizeDragEvent, params: ResizeParams) => {
          const cb = this.onResizeEndCb();
          if (cb) {
            cb(event, params);
          } else {
            this.resizeEnd.emit({ event, ...params });
          }
        },
        shouldResize: this.shouldResize(),
      });

      this.resizerInstances.push(resizer);
    });
  }

  ngOnDestroy(): void {
    this.resizerInstances.forEach((r) => r.destroy());
  }
}

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
} from '@xyflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

@Component({
  selector: 'ng-flow-node-resizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__node-resizer xy-flow__resize-control',
    'style': 'position: absolute; inset: 0; pointer-events: none;',
    '[style.display]': 'isVisible() === false ? "none" : null',
  },
  template: `
    <div
      class="xy-flow__resize-control handle-top-left"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'"
      [style.cursor]="'nw-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control handle-top-right"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.right]="'0'"
      [style.cursor]="'ne-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control handle-bottom-left"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.left]="'0'"
      [style.cursor]="'sw-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control handle-bottom-right"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.right]="'0'"
      [style.cursor]="'se-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.border-color]="color() ?? null"
    ></div>
    <!-- Resize lines -->
    <div
      class="xy-flow__resize-control line-top"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'" [style.right]="'0'"
      [style.height.px]="2" [style.cursor]="'n-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control line-right"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.right]="'0'" [style.bottom]="'0'"
      [style.width.px]="2" [style.cursor]="'e-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control line-bottom"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.left]="'0'" [style.right]="'0'"
      [style.height.px]="2" [style.cursor]="'s-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control line-left"
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
  readonly isVisible = input<boolean>(true);
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

  readonly resizeStart = output<any>();
  readonly resize = output<any>();
  readonly resizeEnd = output<any>();

  private nodeId: string = '';
  private resizerInstances: ReturnType<typeof XYResizer>[] = [];

  constructor(@Optional() @Inject(NODE_ID) nodeId: string | null) {
    this.nodeId = nodeId ?? '';
  }

  ngAfterViewInit(): void {
    const resolvedNodeId = this.nodeIdInput() ?? this.nodeId;
    const handles = this.el.nativeElement.querySelectorAll('.xy-flow__resize-control');
    const positions: ControlPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

    // Only set up corner handles (first 4)
    const cornerHandles = Array.from(handles).slice(0, 4) as Element[];

    cornerHandles.forEach((handle, index) => {
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
        onChange: (changes: any, childChanges: any[]) => {
          this.resize.emit({ changes, childChanges });
        },
        onEnd: (change: any) => {
          this.resizeEnd.emit(change);
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
        onResizeStart: this.onResizeStartCb() ?? ((event: any, params: any) => {
          this.resizeStart.emit({ event, ...params });
        }),
        onResize: this.onResizeCb() ?? ((event: any, params: any) => {
          this.resize.emit({ event, ...params });
        }),
        onResizeEnd: this.onResizeEndCb() ?? ((event: any, params: any) => {
          this.resizeEnd.emit({ event, ...params });
        }),
        shouldResize: this.shouldResize(),
      } as any);

      this.resizerInstances.push(resizer);
    });
  }

  ngOnDestroy(): void {
    this.resizerInstances.forEach((r) => r.destroy());
  }
}

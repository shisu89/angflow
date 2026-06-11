import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  output,
  viewChild,
  effect,
  ElementRef,
  DestroyRef,
} from '@angular/core';
import {
  XYDrag,
  type XYDragInstance,
  type XYPosition,
  calculateNodePosition,
  snapPosition,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';

/** Per-key unit direction vectors for arrow-key node movement (React parity). */
const arrowKeyDiffs: Record<string, XYPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

@Component({
  selector: 'ng-flow-selection-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'style': 'display: contents;',
  },
  template: `
    @if (isVisible()) {
      <div
        class="ng-flow__selection xy-flow__selection"
        style="position: absolute; pointer-events: all; z-index: 10;"
        [style.left.px]="rect()!.x"
        [style.top.px]="rect()!.y"
        [style.width.px]="rect()!.width"
        [style.height.px]="rect()!.height"
        (contextmenu)="onContextMenu($event)"
      ></div>
    }
    @if (store.nodesSelectionActive()) {
      <div
        #nodesSelectionBox
        class="ng-flow__selection ng-flow__nodesselection xy-flow__selection xy-flow__nodesselection"
        style="position: absolute; pointer-events: all; z-index: 10; transform-origin: left top;"
        [style.transform]="nodesSelectionTransform()"
        [style.width.px]="nodesSelectionBounds().width"
        [style.height.px]="nodesSelectionBounds().height"
        tabindex="-1"
        (keydown)="onKeyDown($event)"
        (contextmenu)="onContextMenu($event)"
      ></div>
    }
  `,
})
export class SelectionBoxComponent {
  readonly store = inject(FlowStore);

  readonly contextMenu = output<MouseEvent>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly nodesSelectionBox = viewChild<ElementRef<HTMLDivElement>>('nodesSelectionBox');
  private dragInstance: XYDragInstance | null = null;

  constructor() {
    // Bind/unbind XYDrag to the nodes-selection box as it enters/leaves the
    // DOM (@if on nodesSelectionActive). No nodeId is passed: XYDrag's
    // undefined-nodeId path collects all selected nodes and routes through the
    // onSelectionDrag* store callbacks (already wired on <ng-flow>), mirroring
    // React's useDrag({ nodeRef }) with no nodeId.
    effect(() => {
      const box = this.nodesSelectionBox();

      if (!box) {
        // Box left the DOM (selection cleared) — drop the d3-drag binding.
        this.dragInstance?.destroy();
        this.dragInstance = null;
        return;
      }

      if (!this.dragInstance) {
        this.dragInstance = XYDrag({
          getStoreItems: () => this.store.getStoreItems(),
        });
      }

      this.dragInstance.update({
        domNode: box.nativeElement,
        // nodeId intentionally omitted → selection-drag path.
        noDragClassName: this.store.noDragClassName(),
      });
    });

    // Safety net: if the component is destroyed while the box is still bound
    // (e.g. <ng-flow> torn down mid-drag), release the d3 listeners.
    this.destroyRef.onDestroy(() => this.dragInstance?.destroy());
  }

  readonly isVisible = computed(() => this.store.userSelectionActive() && this.store.userSelectionRect() !== null);
  readonly rect = computed(() => this.store.userSelectionRect());

  readonly nodesSelectionBounds = computed(() => {
    this.store.version();
    const selected = this.store.selectedNodes();
    if (selected.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selected) {
      const internal = this.store.nodeLookup.get(node.id);
      const x = internal?.internals?.positionAbsolute?.x ?? node.position.x;
      const y = internal?.internals?.positionAbsolute?.y ?? node.position.y;
      const w = internal?.measured?.width ?? node.width ?? 150;
      const h = internal?.measured?.height ?? node.height ?? 40;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });

  readonly nodesSelectionTransform = computed(() => {
    const b = this.nodesSelectionBounds();
    return `translate(${b.x}px, ${b.y}px)`;
  });

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenu.emit(event);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.store.nodesSelectionActive.set(false);
      (event.currentTarget as HTMLElement | null)?.blur();
      return;
    }

    const direction = arrowKeyDiffs[event.key];
    if (!direction) return;

    event.preventDefault();
    this.moveSelectedNodes(direction, event.shiftKey ? 4 : 1);
  }

  /**
   * Ports React's useMoveSelectedNodes: shift every selected & draggable node
   * by a snap-grid-aware velocity, then push the batch through the same
   * updateNodePositions path a drag uses.
   */
  private moveSelectedNodes(direction: XYPosition, factor: number): void {
    const store = this.store;
    const snapToGrid = store.snapToGrid();
    const snapGrid = store.snapGrid();
    const nodeExtent = store.nodeExtent();
    const nodeOrigin = store.nodeOrigin();
    const nodesDraggable = store.nodesDraggable();
    const onError = store.onError();
    const nodeLookup = store.nodeLookup;

    // By default a node moves 5px per press; snap grid overrides the velocity.
    const xVelo = snapToGrid ? snapGrid[0] : 5;
    const yVelo = snapToGrid ? snapGrid[1] : 5;
    const xDiff = direction.x * xVelo * factor;
    const yDiff = direction.y * yVelo * factor;

    const nodeUpdates = new Map<string, unknown>();

    for (const [, node] of nodeLookup) {
      const userDraggable = node.draggable;
      const isSelectedDraggable =
        node.selected && (userDraggable || (nodesDraggable && typeof userDraggable === 'undefined'));
      if (!isSelectedDraggable) continue;

      let nextPosition = {
        x: node.internals.positionAbsolute.x + xDiff,
        y: node.internals.positionAbsolute.y + yDiff,
      };
      if (snapToGrid) {
        nextPosition = snapPosition(nextPosition, snapGrid);
      }

      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup,
        nodeExtent,
        nodeOrigin,
        onError,
      });

      node.position = position;
      node.internals.positionAbsolute = positionAbsolute;
      nodeUpdates.set(node.id, node);
    }

    if (nodeUpdates.size > 0) {
      store.updateNodePositions(nodeUpdates as Map<string, never>);
    }
  }
}

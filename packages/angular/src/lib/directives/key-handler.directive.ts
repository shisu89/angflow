import {
  Directive,
  inject,
  input,
  output,
  OnInit,
  OnDestroy,
  computed,
} from '@angular/core';
import {
  isInputDOMNode,
  snapPosition,
  calculateNodePosition,
  type NodeChange,
  type EdgeChange,
  type KeyCode,
  type XYPosition,
} from '@angflow/system';
import { FlowStore } from '../services/flow-store.service';
import { elementToRemoveChange } from '../utils/changes';
import { KeyPressTracker, hasKeyCombination } from '../utils/key-press';
import type { Node, Edge } from '../types';

/**
 * Listens for document-level key events and dispatches Delete/Select-All/
 * Escape/arrow-key behavior plus selection and multi-select key tracking.
 * Attached internally by `<ng-flow>`; emits `(nodesDelete)`, `(edgesDelete)`,
 * and `(deleteElements)` when the user presses the configured delete key.
 */
@Directive({
  selector: '[ngFlowKeyHandler]',
  standalone: true,
  host: {
    '(document:keydown)': 'onKeyDown($event)',
    '(document:keyup)': 'onKeyUp($event)',
    '(document:contextmenu)': 'onContextMenu()',
    '(window:blur)': 'onWindowBlur()',
  },
})
export class KeyHandlerDirective implements OnInit, OnDestroy {
  private store = inject(FlowStore);

  /** Key(s) that delete selected elements. `null` disables the shortcut. */
  readonly deleteKeyCode = input<KeyCode | null>(['Backspace', 'Delete']);
  /** Key held to start box-selection. */
  readonly selectionKeyCode = input<KeyCode | null>('Shift');
  /** Key held to extend the current selection. */
  readonly multiSelectionKeyCode = input<KeyCode | null>('Meta');
  /** Key held to temporarily enable panning. */
  readonly panActivationKeyCode = input<KeyCode | null>(' ');
  /** Key held to enable zooming when it is otherwise disabled. */
  readonly zoomActivationKeyCode = input<KeyCode | null>('Meta');
  /** Disable arrow-key node movement. */
  readonly disableKeyboardA11y = input(false);

  /** Fires with the set of nodes deleted by the delete key. */
  readonly nodesDelete = output<Node[]>();
  /** Fires with the set of edges deleted by the delete key. */
  readonly edgesDelete = output<Edge[]>();
  /** Fires once with both deleted `nodes` and `edges`. */
  readonly deleteElements = output<{ nodes: Node[]; edges: Edge[] }>();

  private readonly panActivationKeys = new Set<string>();
  private readonly zoomActivationKeys = new Set<string>();

  // Upstream useKeyPress semantics (combinations) for delete/selection/multi-selection.
  // Activation keys keep their physical-key tracking above.
  private readonly deleteTracker = computed(() => new KeyPressTracker(this.deleteKeyCode()));
  private readonly selectionTracker = computed(() => new KeyPressTracker(this.selectionKeyCode()));
  private readonly multiSelectionTracker = computed(() => new KeyPressTracker(this.multiSelectionKeyCode()));

  ngOnInit(): void {}
  ngOnDestroy(): void {}

  onKeyDown(event: KeyboardEvent): void {
    // Combination definitions use upstream useKeyPress semantics and act inside inputs
    // with a modifier. Plain single-key definitions keep the order-independent matching
    // (holding Shift then Meta must keep both active).
    const inInput = isInputDOMNode(event);
    const selectionCombo = hasKeyCombination(this.selectionKeyCode());
    const multiCombo = hasKeyCombination(this.multiSelectionKeyCode());
    const deleteCombo = hasKeyCombination(this.deleteKeyCode());

    if (selectionCombo) {
      this.selectionTracker().down(event);
      this.store.selectionKeyActive.set(this.selectionTracker().pressed);
    }
    if (multiCombo) {
      this.multiSelectionTracker().down(event);
      this.store.multiSelectionActive.set(this.multiSelectionTracker().pressed);
    }
    if (deleteCombo && this.deleteTracker().down(event)) this.handleDelete();

    if (inInput) return;

    if (!selectionCombo && this.matchesKey(event, this.selectionKeyCode())) {
      this.store.selectionKeyActive.set(true);
    }
    if (!multiCombo && this.matchesKey(event, this.multiSelectionKeyCode())) {
      this.store.multiSelectionActive.set(true);
    }
    if (!deleteCombo && this.matchesKey(event, this.deleteKeyCode())) {
      this.handleDelete();
    }

    if (this.matchesKey(event, this.panActivationKeyCode())) {
      this.panActivationKeys.add(this.getPhysicalKeyId(event));
      this.store.panActivationKeyActive.set(this.panActivationKeys.size > 0);
      if (this.canPreventDefault(event)) event.preventDefault();
    }

    if (this.matchesKey(event, this.zoomActivationKeyCode())) {
      this.zoomActivationKeys.add(this.getPhysicalKeyId(event));
      this.store.zoomActivationKeyActive.set(this.zoomActivationKeys.size > 0);
      if (this.canPreventDefault(event)) event.preventDefault();
    }

    // Select all (Ctrl/Cmd + A)
    if (event.key === 'a' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.handleSelectAll();
    }

    // Escape — deselect all
    if (event.key === 'Escape') {
      this.store.unselectNodesAndEdges();
      this.store.connectionClickStartHandle.set(null);
    }

    // Arrow key movement for focused nodes
    if (!this.disableKeyboardA11y() && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      this.handleArrowKey(event);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (hasKeyCombination(this.selectionKeyCode())) {
      this.selectionTracker().up(event);
      this.store.selectionKeyActive.set(this.selectionTracker().pressed);
    } else if (this.matchesKey(event, this.selectionKeyCode())) {
      this.store.selectionKeyActive.set(false);
    }

    if (hasKeyCombination(this.multiSelectionKeyCode())) {
      this.multiSelectionTracker().up(event);
      this.store.multiSelectionActive.set(this.multiSelectionTracker().pressed);
    } else if (this.matchesKey(event, this.multiSelectionKeyCode())) {
      this.store.multiSelectionActive.set(false);
    }

    if (hasKeyCombination(this.deleteKeyCode())) this.deleteTracker().up(event);

    this.panActivationKeys.delete(this.getPhysicalKeyId(event));
    this.store.panActivationKeyActive.set(this.panActivationKeys.size > 0);

    this.zoomActivationKeys.delete(this.getPhysicalKeyId(event));
    this.store.zoomActivationKeyActive.set(this.zoomActivationKeys.size > 0);
  }

  /**
   * Reset held-key state when the window loses focus. A keyup is not delivered
   * after Cmd/Alt+Tab, a native context menu, or an OS shortcut steals focus, so
   * without this the selection / multi-selection modifiers stay stuck active —
   * every click keeps extending the selection until the user taps the key again.
   */
  onWindowBlur(): void {
    this.resetHeldKeys();
  }

  onContextMenu(): void {
    this.resetHeldKeys();
  }

  private handleDelete(): void {
    const selectedNodes = this.store.selectedNodes();
    const selectedEdges = this.store.selectedEdges();

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    // Filter to only deletable elements
    const deletableNodes = selectedNodes.filter((n) => n.deletable !== false);
    const deletableEdges = selectedEdges.filter((e) => e.deletable !== false);

    // Collect edges connected to deleted nodes
    const nodeIds = new Set(deletableNodes.map((n) => n.id));
    const connectedEdges = this.store.edges().filter(
      (e) => (nodeIds.has(e.source) || nodeIds.has(e.target)) && e.deletable !== false
    );
    const allEdgesToDelete = [...deletableEdges, ...connectedEdges.filter((e) => !deletableEdges.some((se) => se.id === e.id))];

    if (deletableNodes.length === 0 && allEdgesToDelete.length === 0) return;

    const performDelete = () => {
      // Emit delete events
      if (deletableNodes.length > 0) {
        this.nodesDelete.emit(deletableNodes);
      }
      if (allEdgesToDelete.length > 0) {
        this.edgesDelete.emit(allEdgesToDelete);
      }
      this.deleteElements.emit({ nodes: deletableNodes, edges: allEdgesToDelete });

      // Apply changes
      const nodeChanges = deletableNodes.map((n) => elementToRemoveChange(n));
      const edgeChanges = allEdgesToDelete.map((e) => elementToRemoveChange(e));

      this.store.triggerNodeChanges(nodeChanges as NodeChange[]);
      this.store.triggerEdgeChanges(edgeChanges as EdgeChange[]);
    };

    // Check beforeDelete callback
    const beforeDelete = this.store.onBeforeDelete;
    if (beforeDelete) {
      const result = beforeDelete({ nodes: deletableNodes, edges: allEdgesToDelete });
      if (result instanceof Promise) {
        result.then((allowed) => { if (allowed) performDelete(); });
      } else if (result) {
        performDelete();
      }
    } else {
      performDelete();
    }
  }

  private handleSelectAll(): void {
    const nodeChanges = this.store.nodes()
      .filter((n) => n.selectable !== false)
      .map((n) => ({
        id: n.id,
        type: 'select' as const,
        selected: true,
      }));
    const edgeChanges = this.store.edges()
      .filter((e) => e.selectable !== false)
      .map((e) => ({
        id: e.id,
        type: 'select' as const,
        selected: true,
      }));

    this.store.triggerNodeChanges(nodeChanges as NodeChange[]);
    this.store.triggerEdgeChanges(edgeChanges as EdgeChange[]);
  }

  private static readonly arrowDirections: Record<string, XYPosition> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  private handleArrowKey(event: KeyboardEvent): void {
    const direction = KeyHandlerDirective.arrowDirections[event.key];
    const nodesDraggable = this.store.nodesDraggable();
    const selected = this.store.selectedNodes().filter((n) => n.draggable ?? nodesDraggable);
    if (!direction || selected.length === 0) return;
    event.preventDefault();

    // A node moves 5px per press, the snap grid when snapping; Shift x4 (upstream).
    const snapToGrid = this.store.snapToGrid();
    const snapGrid = this.store.snapGrid();
    const factor = event.shiftKey ? 4 : 1;
    const dx = direction.x * (snapToGrid ? snapGrid[0] : 5) * factor;
    const dy = direction.y * (snapToGrid ? snapGrid[1] : 5) * factor;
    const focusedId = this.focusedNodeId();
    let focusedAbsolute: XYPosition | undefined;

    const changes: NodeChange[] = [];
    for (const node of selected) {
      const internal = this.store.nodeLookup.get(node.id);
      if (!internal) continue;
      let nextPosition = {
        x: internal.internals.positionAbsolute.x + dx,
        y: internal.internals.positionAbsolute.y + dy,
      };
      if (snapToGrid) nextPosition = snapPosition(nextPosition, snapGrid);
      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup: this.store.nodeLookup,
        nodeExtent: this.store.nodeExtent(),
        nodeOrigin: this.store.nodeOrigin(),
        onError: this.store.onError(),
      });
      changes.push({ id: node.id, type: 'position', position, positionAbsolute } as NodeChange);
      if (node.id === focusedId) focusedAbsolute = positionAbsolute;
    }
    this.store.triggerNodeChanges(changes);

    if (focusedAbsolute) {
      this.store.ariaLiveMessage.set(
        this.store.ariaLabelConfig()['node.a11yDescription.ariaLiveMessage']({
          direction: event.key.replace('Arrow', '').toLowerCase(),
          x: ~~focusedAbsolute.x,
          y: ~~focusedAbsolute.y,
        }),
      );
    }
  }

  /** The node wrapper inside this flow that has focus, if any. */
  private focusedNodeId(): string | null {
    const root = this.store.domNode();
    const active = root?.ownerDocument.activeElement;
    if (!root || !active || !root.contains(active)) return null;
    return active.closest('.xy-flow__node')?.getAttribute('data-id') ?? null;
  }

  private resetHeldKeys(): void {
    this.panActivationKeys.clear();
    this.zoomActivationKeys.clear();
    this.selectionTracker().reset();
    this.multiSelectionTracker().reset();
    this.deleteTracker().reset();
    this.store.selectionKeyActive.set(false);
    this.store.multiSelectionActive.set(false);
    this.store.panActivationKeyActive.set(false);
    this.store.zoomActivationKeyActive.set(false);
  }

  private matchesKey(event: KeyboardEvent, keyCode: KeyCode | null): boolean {
    if (keyCode === null) return false;
    const alternatives = Array.isArray(keyCode) ? keyCode : [keyCode];
    return alternatives.some((value) => value === event.key || value === event.code);
  }

  private getPhysicalKeyId(event: KeyboardEvent): string {
    return event.code || event.key;
  }

  /**
   * Whether swallowing the browser default for an activation keydown is safe.
   *
   * These listeners are on `document`, and `panActivationKeyCode` defaults to
   * Space — which is also how a keyboard user activates a focused `<button>` or
   * `<a>`, including this library's own `<ng-flow-controls>` buttons. Calling
   * preventDefault() unconditionally would make those inert page-wide for any
   * app that mounts a flow. A modifier-qualified press is never a native
   * activation, so it still prevents (matters for `zoomActivationKeyCode`,
   * which defaults to Meta).
   *
   * React parity: `useKeyPress`'s `isInteractiveElement` guard. The key is
   * still tracked as held either way — only the default action is spared.
   */
  private canPreventDefault(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return true;
    // composedPath() pierces shadow DOM; falls back to target for synthetic events.
    const target = (event.composedPath?.()?.[0] || event.target) as Element | null;
    const nodeName = target?.nodeName;
    return nodeName !== 'BUTTON' && nodeName !== 'A';
  }
}

import {
  Directive,
  ElementRef,
  inject,
  input,
  output,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isInputDOMNode, type NodeChange, type EdgeChange, type KeyCode } from '@angflow/system';
import { FlowStore } from '../services/flow-store.service';
import { elementToRemoveChange } from '../utils/changes';
import { collectElementsToRemove, resolveBeforeDeleteResult } from '../utils/elements-to-remove';
import { ARROW_KEY_DIFFS, moveSelectedNodes } from '../utils/move-selected-nodes';
import type { Node, Edge } from '../types';

/**
 * The flow root the user last pointer-downed / focused into. Shared across all
 * `<ng-flow>` instances on the page so a key press while focus sits on
 * `<body>` (e.g. after clicking the non-focusable pane) is routed to exactly
 * one flow.
 */
let lastInteractedFlowRoot: HTMLElement | null = null;

/**
 * Listens for document-level key events and dispatches Delete/Select-All/
 * Escape/arrow-key behavior plus selection and multi-select key tracking.
 * Attached internally by `<ng-flow>`; emits `(nodesDelete)`, `(edgesDelete)`,
 * and `(deleteElements)` when the user presses the configured delete key.
 *
 * Modifier/activation key *state* is tracked page-wide (a held Shift must count
 * no matter where it was pressed), but the *actions* (delete, select-all,
 * Escape, arrow moves) only run for the flow the key event belongs to: the
 * event target is inside this flow's root element, or focus is on
 * `<body>`/`<html>` and this flow was the last one interacted with.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);

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

  private selectionKeyPressed = false;
  private multiSelectionKeyPressed = false;
  private readonly panActivationKeys = new Set<string>();
  private readonly zoomActivationKeys = new Set<string>();

  // Capture phase so a child calling stopPropagation() (node drag, pane
  // gestures) can't hide the interaction from us.
  private readonly onDocumentPointerDown = (event: Event): void => {
    const target = event.target;
    if (target instanceof globalThis.Node && this.host.contains(target)) {
      lastInteractedFlowRoot = this.host;
    } else if (lastInteractedFlowRoot === this.host) {
      lastInteractedFlowRoot = null;
    }
  };

  ngOnInit(): void {
    this.document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.document.addEventListener('focusin', this.onDocumentPointerDown, true);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.document.removeEventListener('focusin', this.onDocumentPointerDown, true);
    if (lastInteractedFlowRoot === this.host) lastInteractedFlowRoot = null;
  }

  /**
   * Whether a key event belongs to this flow (see class doc). Only these may
   * trigger delete / select-all / Escape / arrow moves.
   */
  private isEventForThisFlow(event: KeyboardEvent): boolean {
    // composedPath() pierces shadow DOM; falls back to target.
    const target = (event.composedPath?.()?.[0] ?? event.target) as EventTarget | null;
    if (target instanceof globalThis.Node && this.host.contains(target)) return true;
    const doc = this.document;
    const unfocused =
      !target || target === doc || target === doc.body || target === doc.documentElement;
    return unfocused && lastInteractedFlowRoot === this.host;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (isInputDOMNode(event)) return;

    // Selection key
    if (this.matchesKey(event, this.selectionKeyCode())) {
      this.selectionKeyPressed = true;
      this.store.selectionKeyActive.set(true);
    }

    // Multi-selection key
    if (this.matchesKey(event, this.multiSelectionKeyCode())) {
      this.multiSelectionKeyPressed = true;
      this.store.multiSelectionActive.set(true);
    }

    const scoped = this.isEventForThisFlow(event);

    // Delete key
    if (scoped && this.matchesKey(event, this.deleteKeyCode())) {
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
    if (scoped && event.key === 'a' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.handleSelectAll();
    }

    // Escape — deselect all
    if (scoped && event.key === 'Escape') {
      this.store.unselectNodesAndEdges();
      this.store.connectionClickStartHandle.set(null);
    }

    // Arrow key movement for selected nodes
    if (scoped && !this.disableKeyboardA11y() && ARROW_KEY_DIFFS[event.key]) {
      this.handleArrowKey(event);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (this.matchesKey(event, this.selectionKeyCode())) {
      this.selectionKeyPressed = false;
      this.store.selectionKeyActive.set(false);
    }

    if (this.matchesKey(event, this.multiSelectionKeyCode())) {
      this.multiSelectionKeyPressed = false;
      this.store.multiSelectionActive.set(false);
    }

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

    // System getElementsToRemove semantics: honor `deletable: false`, cascade
    // to descendants of deleted parents, include connected edges.
    const matching = collectElementsToRemove({
      nodesToRemove: selectedNodes,
      edgesToRemove: selectedEdges,
      nodes: this.store.nodes(),
      edges: this.store.edges(),
    });

    if (matching.nodes.length === 0 && matching.edges.length === 0) return;

    const performDelete = (toDelete: { nodes: Node[]; edges: Edge[] }) => {
      const { nodes, edges } = toDelete;
      if (nodes.length === 0 && edges.length === 0) return;
      if (nodes.length > 0) this.nodesDelete.emit(nodes);
      if (edges.length > 0) this.edgesDelete.emit(edges);
      this.deleteElements.emit({ nodes, edges });

      if (edges.length > 0) {
        this.store.triggerEdgeChanges(edges.map((e) => elementToRemoveChange(e)) as EdgeChange[]);
      }
      if (nodes.length > 0) {
        this.store.triggerNodeChanges(nodes.map((n) => elementToRemoveChange(n)) as NodeChange[]);
      }
    };

    const beforeDelete = this.store.onBeforeDelete;
    if (!beforeDelete) {
      performDelete(matching);
      return;
    }
    // Keep a synchronous path for synchronous hooks; `boolean` vetoes/approves,
    // an object replaces the set (React parity).
    const result = beforeDelete(matching);
    if (result instanceof Promise) {
      result.then((r) => performDelete(resolveBeforeDeleteResult(r, matching)));
    } else {
      performDelete(resolveBeforeDeleteResult(result, matching));
    }
  }

  private handleSelectAll(): void {
    const elementsSelectable = this.store.elementsSelectable();
    // React isSelectable semantics: an explicit per-element flag wins, else the
    // flow-level elementsSelectable applies.
    const isSelectable = (selectable: boolean | undefined) =>
      selectable || (elementsSelectable && typeof selectable === 'undefined');
    const hidden = this.store.collapsedHiddenIds();

    const nodeChanges = this.store.nodes()
      .filter((n) => !n.selected && isSelectable(n.selectable) && !hidden.has(n.id))
      .map((n) => ({ id: n.id, type: 'select' as const, selected: true }));
    const edgeChanges = this.store.edges()
      .filter((e) => !e.selected && isSelectable(e.selectable))
      .map((e) => ({ id: e.id, type: 'select' as const, selected: true }));

    if (nodeChanges.length > 0) this.store.triggerNodeChanges(nodeChanges as NodeChange[]);
    if (edgeChanges.length > 0) this.store.triggerEdgeChanges(edgeChanges as EdgeChange[]);
  }

  private handleArrowKey(event: KeyboardEvent): void {
    if (this.store.selectedNodes().length === 0) return;
    // Only swallow the key (page scroll) when there is a selection to move.
    event.preventDefault();
    moveSelectedNodes(this.store, ARROW_KEY_DIFFS[event.key], event.shiftKey ? 4 : 1);
  }

  private resetHeldKeys(): void {
    this.selectionKeyPressed = false;
    this.multiSelectionKeyPressed = false;
    this.panActivationKeys.clear();
    this.zoomActivationKeys.clear();
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

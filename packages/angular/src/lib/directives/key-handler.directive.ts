import {
  Directive,
  inject,
  input,
  output,
  OnDestroy,
} from '@angular/core';
import { isInputDOMNode, type NodeChange, type EdgeChange } from '@angflow/system';
import { FlowStore } from '../services/flow-store.service';
import { elementToRemoveChange } from '../utils/changes';
import type { Node, Edge } from '../types';

@Directive({
  selector: '[ngFlowKeyHandler]',
  standalone: true,
  host: {
    '(document:keydown)': 'onKeyDown($event)',
    '(document:keyup)': 'onKeyUp($event)',
    '(window:blur)': 'onWindowBlur()',
  },
})
export class KeyHandlerDirective implements OnDestroy {
  private store = inject(FlowStore);

  readonly deleteKeyCode = input<string | string[] | null>(['Backspace', 'Delete']);
  readonly selectionKeyCode = input<string | string[] | null>('Shift');
  readonly multiSelectionKeyCode = input<string | string[] | null>('Meta');
  readonly disableKeyboardA11y = input(false);

  readonly nodesDelete = output<Node[]>();
  readonly edgesDelete = output<Edge[]>();
  readonly deleteElements = output<{ nodes: Node[]; edges: Edge[] }>();

  private selectionKeyPressed = false;
  private multiSelectionKeyPressed = false;

  ngOnDestroy(): void {
    this.onWindowBlur();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (isInputDOMNode(event)) return;

    // Selection key
    if (this.matchesKey(event.key, this.selectionKeyCode())) {
      this.selectionKeyPressed = true;
      this.store.selectionKeyActive.set(true);
    }

    // Multi-selection key
    if (this.matchesKey(event.key, this.multiSelectionKeyCode())) {
      this.multiSelectionKeyPressed = true;
      this.store.multiSelectionActive.set(true);
    }

    // Delete key
    if (this.matchesKey(event.key, this.deleteKeyCode())) {
      this.handleDelete();
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
    if (this.matchesKey(event.key, this.selectionKeyCode())) {
      this.selectionKeyPressed = false;
      this.store.selectionKeyActive.set(false);
    }

    if (this.matchesKey(event.key, this.multiSelectionKeyCode())) {
      this.multiSelectionKeyPressed = false;
      this.store.multiSelectionActive.set(false);
    }
  }

  onWindowBlur(): void {
    // Reset key states when window loses focus so keys don't get permanently
    // stuck in the "pressed" state (e.g. after cmd+tab focus switch).
    if (this.selectionKeyPressed) {
      this.selectionKeyPressed = false;
      this.store.selectionKeyActive.set(false);
    }
    if (this.multiSelectionKeyPressed) {
      this.multiSelectionKeyPressed = false;
      this.store.multiSelectionActive.set(false);
    }
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
    const nodeChanges = this.store.nodes().map((n) => ({
      id: n.id,
      type: 'select' as const,
      selected: true,
    }));
    const edgeChanges = this.store.edges().map((e) => ({
      id: e.id,
      type: 'select' as const,
      selected: true,
    }));

    this.store.triggerNodeChanges(nodeChanges as NodeChange[]);
    this.store.triggerEdgeChanges(edgeChanges as EdgeChange[]);
  }

  private handleArrowKey(event: KeyboardEvent): void {
    const selectedNodes = this.store.selectedNodes();
    if (selectedNodes.length === 0) return;

    event.preventDefault();

    const step = this.store.snapToGrid() ? this.store.snapGrid()[0] : 1;
    let dx = 0, dy = 0;

    switch (event.key) {
      case 'ArrowUp': dy = -step; break;
      case 'ArrowDown': dy = step; break;
      case 'ArrowLeft': dx = -step; break;
      case 'ArrowRight': dx = step; break;
    }

    const changes = selectedNodes.map((node) => ({
      id: node.id,
      type: 'position' as const,
      position: {
        x: node.position.x + dx,
        y: node.position.y + dy,
      },
    }));

    this.store.triggerNodeChanges(changes as NodeChange[]);
  }

  private matchesKey(eventKey: string, keyCode: string | string[] | null): boolean {
    if (keyCode === null) return false;
    if (Array.isArray(keyCode)) return keyCode.includes(eventKey);
    return eventKey === keyCode;
  }
}

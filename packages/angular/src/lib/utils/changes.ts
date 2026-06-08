import type {
  NodeChange,
  EdgeChange,
  NodeSelectionChange,
  EdgeSelectionChange,
  NodeRemoveChange,
  EdgeRemoveChange,
} from '@angflow/system';
import type { Node, Edge } from '../types';

function applyChanges(changes: any[], elements: any[]): any[] {
  const updatedElements: any[] = [];
  const changesMap = new Map<any, any[]>();
  const addItemChanges: any[] = [];

  for (const change of changes) {
    if (change.type === 'add') {
      addItemChanges.push(change);
      continue;
    } else if (change.type === 'remove' || change.type === 'replace') {
      changesMap.set(change.id, [change]);
    } else {
      const elementChanges = changesMap.get(change.id);
      if (elementChanges) {
        elementChanges.push(change);
      } else {
        changesMap.set(change.id, [change]);
      }
    }
  }

  for (const element of elements) {
    const changes = changesMap.get(element.id);

    if (!changes) {
      updatedElements.push(element);
      continue;
    }

    if (changes[0].type === 'remove') {
      continue;
    }

    if (changes[0].type === 'replace') {
      updatedElements.push({ ...changes[0].item });
      continue;
    }

    const updatedElement = { ...element };
    for (const change of changes) {
      applyChange(change, updatedElement);
    }
    updatedElements.push(updatedElement);
  }

  if (addItemChanges.length) {
    addItemChanges.forEach((change) => {
      if (change.index !== undefined) {
        updatedElements.splice(change.index, 0, { ...change.item });
      } else {
        updatedElements.push({ ...change.item });
      }
    });
  }

  return updatedElements;
}

function applyChange(change: any, element: any): void {
  switch (change.type) {
    case 'select': {
      element.selected = change.selected;
      break;
    }
    case 'position': {
      if (typeof change.position !== 'undefined') {
        element.position = change.position;
      }
      if (typeof change.dragging !== 'undefined') {
        element.dragging = change.dragging;
      }
      break;
    }
    case 'dimensions': {
      if (typeof change.dimensions !== 'undefined') {
        element.measured = { ...change.dimensions };
        if (change.setAttributes) {
          if (change.setAttributes === true || change.setAttributes === 'width') {
            element.width = change.dimensions.width;
          }
          if (change.setAttributes === true || change.setAttributes === 'height') {
            element.height = change.dimensions.height;
          }
        }
      }
      if (typeof change.resizing === 'boolean') {
        element.resizing = change.resizing;
      }
      break;
    }
  }
}

/**
 * Apply an array of `NodeChange` to the current `nodes` array and return a
 * new array reflecting them. Typical usage is to call this inside
 * `(nodesChange)` to keep your bound `nodes` in sync with user interaction.
 *
 * Handles `add`, `remove`, `replace`, `select`, `position`, and `dimensions`
 * changes; unknown change types pass through unchanged.
 *
 * @example
 * ```typescript
 * onNodesChange(changes: NodeChange[]) {
 *   this.nodes = applyNodeChanges(changes, this.nodes);
 * }
 * ```
 */
export function applyNodeChanges<NodeType extends Node = Node>(
  changes: NodeChange<NodeType>[],
  nodes: NodeType[]
): NodeType[] {
  return applyChanges(changes, nodes) as NodeType[];
}

/**
 * Apply an array of `EdgeChange` to the current `edges` array and return a
 * new array reflecting them. Mirror of {@link applyNodeChanges} for edges;
 * wire to `(edgesChange)`.
 */
export function applyEdgeChanges<EdgeType extends Edge = Edge>(
  changes: EdgeChange<EdgeType>[],
  edges: EdgeType[]
): EdgeType[] {
  return applyChanges(changes, edges) as EdgeType[];
}

/**
 * Apply only `dimensions`-type changes from a `(nodesChange)` batch, writing
 * `{ width, height }` into each affected node's `measured`. All other change
 * types are ignored. Returns a **new** array when at least one dimension change
 * applied, otherwise the **original `nodes` reference** (so it is a no-op for
 * change detection when there is nothing to update).
 *
 * For controlled-mode apps that keep authority over `position`/`data` themselves
 * (e.g. a journal) but still want `measured` to flow back so that layout
 * (`applyLayout`), floating edges, and `fitView` stay correct.
 *
 * @example
 * ```typescript
 * onNodesChange(changes: NodeChange[]) {
 *   this.nodes.update((ns) => applyDimensionChanges(ns, changes));
 *   // ...your own position/data handling on top...
 * }
 * ```
 */
export function applyDimensionChanges<NodeType extends Node = Node>(
  nodes: NodeType[],
  changes: NodeChange<NodeType>[],
): NodeType[] {
  const dims = new Map<string, { width: number; height: number }>();
  for (const change of changes) {
    if (change.type === 'dimensions' && change.dimensions) {
      dims.set(change.id, change.dimensions);
    }
  }
  if (dims.size === 0) return nodes;

  let changed = false;
  const next = nodes.map((node) => {
    const d = dims.get(node.id);
    if (!d) return node;
    changed = true;
    return { ...node, measured: { width: d.width, height: d.height } };
  });
  return changed ? next : nodes;
}

export function createSelectionChange(id: string, selected: boolean): NodeSelectionChange | EdgeSelectionChange {
  return { id, type: 'select', selected };
}

export function getSelectionChanges(
  items: Map<string, any>,
  selectedIds: Set<string> = new Set(),
  mutateItem = false
): NodeSelectionChange[] | EdgeSelectionChange[] {
  const changes: any[] = [];

  for (const [id, item] of items) {
    const willBeSelected = selectedIds.has(id);
    if (!(item.selected === undefined && !willBeSelected) && item.selected !== willBeSelected) {
      if (mutateItem) {
        item.selected = willBeSelected;
      }
      changes.push(createSelectionChange(item.id, willBeSelected));
    }
  }

  return changes;
}

export function getElementsDiffChanges({ items = [], lookup }: { items: any[] | undefined; lookup: Map<string, any> }): any[] {
  const changes: any[] = [];
  const itemsLookup = new Map<string, any>(items.map((item) => [item.id, item]));

  for (const [index, item] of items.entries()) {
    const lookupItem = lookup.get(item.id);
    const storeItem = lookupItem?.internals?.userNode ?? lookupItem;

    if (storeItem !== undefined && storeItem !== item) {
      changes.push({ id: item.id, item, type: 'replace' });
    }
    if (storeItem === undefined) {
      changes.push({ item, type: 'add', index });
    }
  }

  for (const [id] of lookup) {
    const nextNode = itemsLookup.get(id);
    if (nextNode === undefined) {
      changes.push({ id, type: 'remove' });
    }
  }

  return changes;
}

export function elementToRemoveChange<T extends Node | Edge>(item: T): NodeRemoveChange | EdgeRemoveChange {
  return { id: item.id, type: 'remove' };
}

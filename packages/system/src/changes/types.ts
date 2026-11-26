import type { Dimensions, EdgeBase, NodeBase, XYPosition } from '../types';

export type NodeChange<NodeType extends NodeBase = NodeBase> =
  | DimensionChange
  | PositionChange
  | SelectionChange
  | RemoveChange
  | AddChange<NodeType>
  | ReplaceChange<NodeType>
  | UpdateChange<NodeType>
  | DataChange<NodeType['data']>;

export type EdgeChange<EdgeType extends EdgeBase = EdgeBase> =
  | SelectionChange
  | RemoveChange
  | AddChange<EdgeType>
  | ReplaceChange<EdgeType>
  | UpdateChange<EdgeType>
  | DataChange<NonNullable<EdgeType['data']>>;

// Narrow down change type based on the element type (Node -> NodeChange, Edge -> EdgeChange)
export type ElementChangeType<ElementType extends NodeBase | EdgeBase> =
  | NodeChange<ElementType & NodeBase>
  | EdgeChange<ElementType & EdgeBase>;

export type DimensionChange = {
  id: string;
  type: 'dimensions';
  dimensions?: Dimensions;
  /* if this is true, the node is currently being resized via the NodeResizer */
  resizing?: boolean;
  /* if this is true, we will set width and height of the node and not just the measured dimensions */
  setAttributes?: boolean | 'width' | 'height';
  /**
   * DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this.
   *
   * True on the first dimensions change after a node mounts: the measurement
   * that populates `measured` for the first time, rather than a real size
   * change. Consumers mirroring changes into external state (Yjs, an undo
   * stack, a server) can skip or coalesce it — it represents no user-visible
   * resize, and writing it back has been observed to fragment undo history.
   *
   * The change still fires. It is the only thing that populates `measured`, so
   * suppressing it would leave that field permanently unset.
   *
   * The key is always present on a dimensions change reporting a node's own
   * measurement — `false` for a genuine resize, not merely absent. However, it
   * is absent on a parent-expand correction change (emitted inside `updateNodeInternals`
   * when a child's expansion triggers parent auto-sizing). Consumers must test
   * the value (`change.initial === true`), not the key's presence
   * (`'initial' in change`), which safely handles both cases.
   */
  initial?: boolean;
};

export type PositionChange = {
  id: string;
  type: 'position';
  position?: XYPosition;
  positionAbsolute?: XYPosition;
  dragging?: boolean;
};

export type SelectionChange = {
  id: string;
  type: 'select';
  selected: boolean;
};

export type RemoveChange = {
  id: string;
  type: 'remove';
};

export type AddChange<NodeOrEdge> = {
  id: string;
  item: NodeOrEdge;
  type: 'add';
  index?: number;
};

export type ReplaceChange<NodeOrEdge> = {
  id: string;
  item: NodeOrEdge;
  type: 'replace';
};

export type UpdateChange<NodeOrEdge> = {
  id: string;
  item: Partial<NodeOrEdge>;
  type: 'update';
};

export type DataChange<Data = Record<string, unknown>> =
  | {
      id: string;
      type: 'data';
      /* the data gets merged into the existing data */
      data: Partial<Data>;
      replace?: false;
    }
  | {
      id: string;
      type: 'data';
      /* the data replaces the existing data, so it has to be complete */
      data: Data;
      replace: true;
    };

import type { XYPosition, Dimensions, NodeBase, EdgeBase } from '.';

export type NodeDimensionChange = {
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
   * The key is always present on a dimensions change emitted by
   * `updateNodeInternals` — `false` for a genuine resize, not merely absent.
   * Consumers must test the value (`change.initial === true`), not the key's
   * presence (`'initial' in change`).
   */
  initial?: boolean;
};

export type NodePositionChange = {
  id: string;
  type: 'position';
  position?: XYPosition;
  positionAbsolute?: XYPosition;
  dragging?: boolean;
};

export type NodeSelectionChange = {
  id: string;
  type: 'select';
  selected: boolean;
};

export type NodeRemoveChange = {
  id: string;
  type: 'remove';
};

export type NodeAddChange<NodeType extends NodeBase = NodeBase> = {
  item: NodeType;
  type: 'add';
  index?: number;
};

export type NodeReplaceChange<NodeType extends NodeBase = NodeBase> = {
  id: string;
  item: NodeType;
  type: 'replace';
};

/**
 * The [`onNodesChange`](/api-reference/react-flow#on-nodes-change) callback takes
 *an array of `NodeChange` objects that you should use to update your flow's state.
 *The `NodeChange` type is a union of six different object types that represent that
 *various ways an node can change in a flow.
 * @public
 */
export type NodeChange<NodeType extends NodeBase = NodeBase> =
  | NodeDimensionChange
  | NodePositionChange
  | NodeSelectionChange
  | NodeRemoveChange
  | NodeAddChange<NodeType>
  | NodeReplaceChange<NodeType>;

export type EdgeSelectionChange = NodeSelectionChange;
export type EdgeRemoveChange = NodeRemoveChange;
export type EdgeAddChange<EdgeType extends EdgeBase = EdgeBase> = {
  item: EdgeType;
  type: 'add';
  index?: number;
};

export type EdgeReplaceChange<EdgeType extends EdgeBase = EdgeBase> = {
  id: string;
  item: EdgeType;
  type: 'replace';
};

/**
 * The [`onEdgesChange`](/api-reference/react-flow#on-edges-change) callback takes
 *an array of `EdgeChange` objects that you should use to update your flow's state.
 *The `EdgeChange` type is a union of four different object types that represent that
 *various ways an edge can change in a flow.
 *
 * @public
 */
export type EdgeChange<EdgeType extends EdgeBase = EdgeBase> =
  | EdgeSelectionChange
  | EdgeRemoveChange
  | EdgeAddChange<EdgeType>
  | EdgeReplaceChange<EdgeType>;

import type {
  FitViewParamsBase,
  FitViewOptionsBase,
  ZoomInOut,
  ZoomTo,
  SetViewport,
  GetZoom,
  GetViewport,
  SetCenter,
  FitBounds,
  XYPosition,
  Connection,
  NodeChange,
  EdgeChange,
  NodeChangeset,
  EdgeChangeset,
  SnapGrid,
  Rect,
  Viewport,
  NodeConnection,
  HandleType,
} from '@angflow/system';

import type { Node, Edge, InternalNode } from '.';

/**
 * Permissive CSS style record used by `Node.style`, `Edge.style`, `labelStyle`,
 * and `labelBgStyle`. Accepts numbers in addition to strings — mirrors how
 * React Flow's `CSSProperties` works (numbers are coerced at render time, useful
 * for SVG attribute-style values like `strokeWidth: 2` or unitless CSS like
 * `opacity: 0.5`).
 */
export type CSSProperties = {
  [key: string]: string | number | null | undefined;
};

/**
 * Type of the `(nodesChange)` handler for a custom node type.
 *
 * @example
 * ```ts
 * const onNodesChange: OnNodesChange<MyNodeType> = (changes) => {
 *   this.nodes.update((nodes) => changes.applyTo(nodes));
 * };
 * ```
 */
export type OnNodesChange<NodeType extends Node = Node> = (changes: NodeChangeset<NodeType>) => void;

/**
 * Type of the `(edgesChange)` handler for a custom edge type.
 *
 * @example
 * ```ts
 * const onEdgesChange: OnEdgesChange<MyEdgeType> = (changes) => {
 *   this.edges.update((edges) => changes.applyTo(edges));
 * };
 * ```
 */
export type OnEdgesChange<EdgeType extends Edge = Edge> = (changes: EdgeChangeset<EdgeType>) => void;

export type NodesChangeMiddleware<NodeType extends Node = Node> = (changes: NodeChange<NodeType>[]) => NodeChange<NodeType>[];
export type EdgesChangeMiddleware<EdgeType extends Edge = Edge> = (changes: EdgeChange<EdgeType>[]) => EdgeChange<EdgeType>[];
export type OnNodesDelete<NodeType extends Node = Node> = (nodes: NodeType[]) => void;
export type OnEdgesDelete<EdgeType extends Edge = Edge> = (edges: EdgeType[]) => void;

export type OnDelete<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (params: {
  nodes: NodeType[];
  edges: EdgeType[];
}) => void;

export type OnSelectionChangeParams<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  nodes: NodeType[];
  edges: EdgeType[];
};

export type OnSelectionChangeFunc<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (
  params: OnSelectionChangeParams<NodeType, EdgeType>
) => void;

/**
 * Event payload for node mouse events (click, double-click, context menu, etc.)
 */
export type NodeMouseEvent<NodeType extends Node = Node> = {
  event: MouseEvent;
  node: NodeType;
};

/**
 * Event payload for edge mouse events (click, double-click, context menu, etc.)
 */
export type EdgeMouseEvent<EdgeType extends Edge = Edge> = {
  event: MouseEvent;
  edge: EdgeType;
};

/**
 * Event payload for node drag events (dragStart, drag, dragStop).
 */
export type NodeDragEvent<NodeType extends Node = Node> = {
  event: MouseEvent;
  node: NodeType;
  nodes: NodeType[];
};

/**
 * Event payload for reconnect events.
 */
export type ReconnectEvent<EdgeType extends Edge = Edge> = {
  oldEdge: EdgeType;
  newConnection: Connection;
};

export type FitViewParams<NodeType extends Node = Node> = FitViewParamsBase<NodeType>;
export type FitViewOptions<NodeType extends Node = Node> = FitViewOptionsBase<NodeType>;
export type FitView<NodeType extends Node = Node> = (fitViewOptions?: FitViewOptions<NodeType>) => Promise<boolean>;

export type OnInit<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (
  instance: NgFlowInstance<NodeType, EdgeType>
) => void;

export type ViewportHelperFunctions = {
  zoomIn: ZoomInOut;
  zoomOut: ZoomInOut;
  zoomTo: ZoomTo;
  getZoom: GetZoom;
  setViewport: SetViewport;
  getViewport: GetViewport;
  setCenter: SetCenter;
  fitBounds: FitBounds;
  screenToFlowPosition: (
    clientPosition: XYPosition,
    options?: { snapToGrid?: boolean; snapGrid?: SnapGrid }
  ) => XYPosition;
  flowToScreenPosition: (flowPosition: XYPosition) => XYPosition;
};

export type OnBeforeDelete<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (params: {
  nodes: NodeType[];
  edges: EdgeType[];
}) =>
  | boolean
  | { nodes: NodeType[]; edges: EdgeType[] }
  | Promise<boolean | { nodes: NodeType[]; edges: EdgeType[] }>;

export type IsValidConnection<EdgeType extends Edge = Edge> = (edge: EdgeType | Connection) => boolean;

export type UnselectNodesAndEdgesParams<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  nodes?: NodeType[];
  edges?: EdgeType[];
};

/**
 * Serialized representation of the flow state.
 */
export type NgFlowJsonObject<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  nodes: NodeType[];
  edges: EdgeType[];
  viewport: Viewport;
};

/**
 * Options for deleteElements.
 */
export type DeleteElementsOptions = {
  nodes?: { id: string }[];
  edges?: { id: string }[];
};

/**
 * The NgFlowInstance provides programmatic access to the flow.
 */
export type NgFlowInstance<NodeType extends Node = Node, EdgeType extends Edge = Edge> = ViewportHelperFunctions & {
  // Node operations
  getNodes: () => NodeType[];
  setNodes: (nodes: NodeType[]) => void;
  addNodes: (nodes: NodeType | NodeType[]) => void;
  getNode: (id: string) => NodeType | undefined;
  getInternalNode: (id: string) => InternalNode<NodeType> | undefined;
  updateNode: (
    id: string,
    nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>),
    options?: { replace: boolean },
  ) => void;
  updateNodeData: (
    id: string,
    dataUpdate: Partial<NodeType['data']> | ((node: NodeType) => Partial<NodeType['data']>),
    options?: { replace: boolean },
  ) => void;
  /** Changes the parent of a node (`null` for top level), keeping it visually in place. */
  changeParent: (nodeId: string, parentId: string | null) => void;

  // Edge operations
  getEdges: () => EdgeType[];
  setEdges: (edges: EdgeType[]) => void;
  addEdges: (edges: EdgeType | EdgeType[]) => void;
  getEdge: (id: string) => EdgeType | undefined;
  updateEdge: (
    id: string,
    edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>),
    options?: { replace: boolean },
  ) => void;
  updateEdgeData: (
    id: string,
    dataUpdate: Partial<EdgeType['data']> | ((edge: EdgeType) => Partial<EdgeType['data']>),
    options?: { replace: boolean },
  ) => void;

  // Delete
  deleteElements: (params: DeleteElementsOptions) => Promise<{ deletedNodes: NodeType[]; deletedEdges: EdgeType[] }>;

  // Spatial queries
  getIntersectingNodes: (node: NodeType, partially?: boolean) => NodeType[];
  isNodeIntersecting: (node: NodeType, area: Rect, partially?: boolean) => boolean;
  getNodesBounds: (nodes: NodeType[]) => Rect;

  // Connection queries
  getConnectedEdges: (nodeIds: string | string[]) => EdgeType[];
  getNodeConnections: (params: { nodeId: string; type?: HandleType | null; handleId?: string | null }) => NodeConnection[];

  // Serialization
  toObject: () => NgFlowJsonObject<NodeType, EdgeType>;

  // State
  viewportInitialized: boolean;
};

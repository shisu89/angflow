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
  SnapGrid,
  Rect,
  Viewport,
  HandleType,
  HandleConnection,
  NodeConnection,
  FinalConnectionState,
  OnConnectStartParams,
} from '@xyflow/system';

import type { Node, Edge, InternalNode, NodeTypes, EdgeTypes } from '.';

export type OnNodesChange<NodeType extends Node = Node> = (changes: NodeChange<NodeType>[]) => void;
export type OnEdgesChange<EdgeType extends Edge = Edge> = (changes: EdgeChange<EdgeType>[]) => void;
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

export type OnBeforeDelete<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (
  params: { nodes: NodeType[]; edges: EdgeType[] }
) => boolean | Promise<boolean>;

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
  updateNode: (id: string, nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>)) => void;
  updateNodeData: (id: string, dataUpdate: Record<string, unknown> | ((data: NodeType['data']) => Record<string, unknown>)) => void;

  // Edge operations
  getEdges: () => EdgeType[];
  setEdges: (edges: EdgeType[]) => void;
  addEdges: (edges: EdgeType | EdgeType[]) => void;
  getEdge: (id: string) => EdgeType | undefined;
  updateEdge: (id: string, edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>)) => void;
  updateEdgeData: (id: string, dataUpdate: Record<string, unknown> | ((data: EdgeType['data']) => Record<string, unknown>)) => void;

  // Delete
  deleteElements: (params: DeleteElementsOptions) => Promise<{ deletedNodes: NodeType[]; deletedEdges: EdgeType[] }>;

  // Spatial queries
  getIntersectingNodes: (node: NodeType, partially?: boolean) => NodeType[];
  isNodeIntersecting: (node: NodeType, area: Rect, partially?: boolean) => boolean;
  getNodesBounds: (nodes: NodeType[]) => Rect;

  // Connection queries
  getConnectedEdges: (nodeIds: string | string[]) => EdgeType[];
  getHandleConnections: (params: { nodeId: string; type: 'source' | 'target'; id?: string }) => HandleConnection[];
  getNodeConnections: (nodeId: string) => NodeConnection[];

  // Serialization
  toObject: () => NgFlowJsonObject<NodeType, EdgeType>;

  // State
  viewportInitialized: boolean;
};

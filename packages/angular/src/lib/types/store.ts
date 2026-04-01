import type {
  ConnectionMode,
  ConnectionState,
  CoordinateExtent,
  NodeOrigin,
  PanZoomInstance,
  SnapGrid,
  Transform,
  InternalNodeBase,
  EdgeBase,
  NodeLookup,
  EdgeLookup,
  ParentLookup,
  OnConnect,
  OnConnectStart,
  OnConnectEnd,
  OnMove,
  OnMoveStart,
  OnMoveEnd,
  OnError,
  SelectionRect,
  ZIndexMode,
  AriaLabelConfig,
  ColorMode,
  NodeChange,
  EdgeChange,
} from '@ngflow/system';

import type { Node, Edge, NodeTypes, EdgeTypes, DefaultEdgeOptions } from '.';

/**
 * The shape of the FlowStore's internal state.
 * This mirrors React Flow's Zustand store shape but uses Angular signals.
 */
export interface FlowStoreState<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  rfId: string;
  width: number;
  height: number;
  transform: Transform;

  nodes: NodeType[];
  edges: EdgeType[];

  nodeLookup: NodeLookup<InternalNodeBase<NodeType>>;
  parentLookup: ParentLookup<InternalNodeBase<NodeType>>;
  edgeLookup: EdgeLookup<EdgeType>;
  connectionLookup: Map<string, Map<string, any>>;

  onNodesChange: ((changes: NodeChange<NodeType>[]) => void) | null;
  onEdgesChange: ((changes: EdgeChange<EdgeType>[]) => void) | null;

  hasDefaultNodes: boolean;
  hasDefaultEdges: boolean;

  nodesInitialized: boolean;

  paneDragging: boolean;
  nodesSelectionActive: boolean;
  userSelectionActive: boolean;
  userSelectionRect: SelectionRect | null;
  multiSelectionActive: boolean;

  panZoom: PanZoomInstance | null;
  minZoom: number;
  maxZoom: number;
  translateExtent: CoordinateExtent;
  nodeExtent: CoordinateExtent;

  domNode: HTMLDivElement | null;
  noDragClassName: string;
  noWheelClassName: string;
  noPanClassName: string;

  nodeOrigin: NodeOrigin;
  nodeDragThreshold: number;
  connectionDragThreshold: number;
  snapGrid: SnapGrid;
  snapToGrid: boolean;

  nodesDraggable: boolean;
  nodesConnectable: boolean;
  nodesFocusable: boolean;
  edgesFocusable: boolean;
  edgesReconnectable: boolean;
  elementsSelectable: boolean;
  elevateNodesOnSelect: boolean;
  elevateEdgesOnSelect: boolean;
  selectNodesOnDrag: boolean;

  connectionMode: ConnectionMode;
  connection: ConnectionState;
  connectionClickStartHandle: any | null;
  connectOnClick: boolean;
  connectionRadius: number;

  fitViewQueued: boolean;
  fitViewOptions: any | undefined;

  autoPanOnConnect: boolean;
  autoPanOnNodeDrag: boolean;
  autoPanOnNodeFocus: boolean;
  autoPanSpeed: number;

  isValidConnection: ((connection: any) => boolean) | undefined;
  onError: OnError;

  lib: string;
  debug: boolean;
  zIndexMode: ZIndexMode;
  ariaLabelConfig: AriaLabelConfig;
  ariaLiveMessage: string;

  defaultEdgeOptions: DefaultEdgeOptions | undefined;
}

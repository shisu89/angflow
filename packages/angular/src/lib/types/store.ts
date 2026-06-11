import type {
  ConnectionMode,
  ConnectionState,
  CoordinateExtent,
  NodeOrigin,
  PanZoomInstance,
  SnapGrid,
  Transform,
  InternalNodeBase,
  NodeLookup,
  EdgeLookup,
  ParentLookup,
  OnError,
  SelectionRect,
  ZIndexMode,
  AriaLabelConfig,
  NodeChange,
  EdgeChange,
} from '@angflow/system';

import type { Node, Edge, DefaultEdgeOptions } from '.';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectionLookup: Map<string, Map<string, any>>; // store interface mirrors xyflow boundary types

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectionClickStartHandle: any | null; // store interface mirrors xyflow boundary types
  connectOnClick: boolean;
  connectionRadius: number;

  fitViewQueued: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitViewOptions: any | undefined; // store interface mirrors xyflow boundary types

  autoPanOnConnect: boolean;
  autoPanOnNodeDrag: boolean;
  autoPanOnNodeFocus: boolean;
  autoPanSpeed: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isValidConnection: ((connection: any) => boolean) | undefined; // store interface mirrors xyflow boundary types
  onError: OnError;

  lib: string;
  debug: boolean;
  zIndexMode: ZIndexMode;
  ariaLabelConfig: AriaLabelConfig;
  ariaLiveMessage: string;

  defaultEdgeOptions: DefaultEdgeOptions | undefined;
}

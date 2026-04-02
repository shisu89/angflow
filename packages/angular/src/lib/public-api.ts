// Core components
export { NgFlowComponent } from './container/ng-flow/ng-flow.component';
export { NgFlowProviderComponent } from './components/ng-flow-provider/ng-flow-provider.component';
export { ViewportComponent } from './container/viewport/viewport.component';

// Node components
export { HandleComponent } from './components/handle/handle.component';
export { DefaultNodeComponent } from './components/nodes/default-node.component';
export { InputNodeComponent } from './components/nodes/input-node.component';
export { OutputNodeComponent } from './components/nodes/output-node.component';
export { GroupNodeComponent } from './components/nodes/group-node.component';

// Edge components
export { BaseEdgeComponent } from './components/edges/base-edge.component';
export { BezierEdgeComponent } from './components/edges/bezier-edge.component';
export { StraightEdgeComponent } from './components/edges/straight-edge.component';
export { StepEdgeComponent } from './components/edges/step-edge.component';
export { SmoothStepEdgeComponent } from './components/edges/smooth-step-edge.component';
export { SimpleBezierEdgeComponent } from './components/edges/simple-bezier-edge.component';
export { EdgeTextComponent } from './components/edges/edge-text.component';
export { EdgeLabelRendererComponent } from './components/edge-label-renderer/edge-label-renderer.component';

// Connection line
export { ConnectionLineComponent } from './components/connection-line/connection-line.component';

// Plugin components
export { PanelComponent } from './components/panel/panel.component';
export { ViewportPortalComponent } from './components/viewport-portal/viewport-portal.component';
export { BackgroundComponent, type BackgroundVariant } from './components/background/background.component';
export { ControlsComponent } from './components/controls/controls.component';
export { MiniMapComponent, type GetMiniMapNodeAttribute } from './components/minimap/minimap.component';
export { NodeToolbarComponent } from './components/node-toolbar/node-toolbar.component';
export { EdgeToolbarComponent } from './components/edge-toolbar/edge-toolbar.component';
export { NodeResizerComponent } from './components/node-resizer/node-resizer.component';
export { A11yDescriptionsComponent } from './components/a11y-descriptions/a11y-descriptions.component';
export { AttributionComponent } from './components/attribution/attribution.component';

// Directives
export { DragDirective } from './directives/drag.directive';
export { KeyHandlerDirective } from './directives/key-handler.directive';
export { NgFlowNodeTypeDirective } from './directives/node-type.directive';
export { NgFlowDropZoneDirective } from './directives/drop-zone.directive';

// Services
export { FlowStore } from './services/flow-store.service';
export { NgFlowService } from './services/ng-flow.service';

// Tokens
export { NODE_ID, EDGE_ID } from './services/tokens';

// Types
export * from './types';

// Utilities
export { applyNodeChanges, applyEdgeChanges } from './utils/changes';

// Wrapper utility functions for Angular-specific typing
export { isNode, isEdge } from './utils/type-guards';

// Re-export everything from @angflow/system
export {
  // Enums / Constants
  ConnectionMode,
  ConnectionLineType,
  MarkerType,
  PanOnScrollMode,
  Position,
  SelectionMode,

  // Path utilities
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,

  // Edge center utilities
  getBezierEdgeCenter,
  getEdgeCenter,

  // Graph utilities
  getConnectedEdges,
  getIncomers,
  getOutgoers,
  getNodesBounds,
  getViewportForBounds,
  addEdge,
  reconnectEdge,
  isEdgeBase,
  isNodeBase,

  // Marker utilities
  getMarkerId,

  // Edge toolbar utility
  getEdgeToolbarTransform,

  // Node toolbar utility
  getNodeToolbarTransform,

  // Constants
  infiniteExtent,
} from '@angflow/system';

// Re-export all types from @angflow/system
export type {
  // Core types
  XYPosition,
  XYZPosition,
  Dimensions,
  Rect,
  Box,
  Transform,
  CoordinateExtent,
  Viewport,
  SnapGrid,
  KeyCode,
  ColorMode,
  ColorModeClass,

  // Node types
  NodeBase,
  InternalNodeBase,
  NodeOrigin,
  NodeHandleBounds,
  NodeDragItem,

  // Edge types
  EdgeBase,
  EdgeMarker,
  EdgeMarkerType,
  EdgePosition,
  DefaultEdgeOptionsBase,

  // Handle types
  Handle as SystemHandle,
  HandleType,
  HandleConnection,

  // Connection types
  Connection,
  ConnectionState,
  ConnectionInProgress,
  FinalConnectionState,
  NoConnection,
  OnConnect,
  OnConnectStart,
  OnConnectEnd,
  OnConnectStartParams,
  IsValidConnection as SystemIsValidConnection,

  // Change types
  NodeChange,
  NodeDimensionChange,
  NodePositionChange,
  NodeSelectionChange,
  NodeRemoveChange,
  NodeAddChange,
  NodeReplaceChange,
  EdgeChange,
  EdgeSelectionChange,
  EdgeRemoveChange,
  EdgeAddChange,
  EdgeReplaceChange,

  // Callback types
  OnMove,
  OnMoveStart,
  OnMoveEnd,
  OnError,
  OnViewportChange,
  OnReconnect,

  // Options
  ViewportHelperFunctionOptions,
  SetCenterOptions,
  FitBoundsOptions,
  PanelPosition,
  SelectionRect,
  ProOptions,
  NodeConnection,

  // Resizer types
  ShouldResize,
  OnResizeStart,
  OnResize,
  OnResizeEnd,
  ControlPosition,
  ControlLinePosition,
  ResizeControlVariant,
  ResizeParams,
  ResizeParamsWithDirection,
  ResizeDragEvent,

  // Zoom mode
  ZIndexMode,

  // Path types
  BezierPathOptions,
  SmoothStepPathOptions,
  GetBezierPathParams,
  GetSmoothStepPathParams,
  GetStraightPathParams,

  // Aria
  AriaLabelConfig,
} from '@angflow/system';

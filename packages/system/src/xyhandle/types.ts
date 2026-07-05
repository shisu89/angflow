import {
  ConnectionMode,
  type Connection,
  type OnConnect,
  type OnConnectStart,
  type HandleType,
  type PanBy,
  type Transform,
  type Handle,
  type OnConnectEnd,
  type UpdateConnection,
  type IsValidConnection,
  type InternalNodeBase,
  type ConnectionInProgress,
  NodeLookup,
  FinalConnectionState,
} from '../types';

export type OnPointerDownParams<NodeType extends InternalNodeBase = InternalNodeBase> = {
  autoPanOnConnect: boolean;
  connectionMode: ConnectionMode;
  connectionRadius: number;
  domNode: HTMLDivElement | null;
  handleId: string | null;
  nodeId: string;
  isTarget: boolean;
  nodeLookup: NodeLookup<NodeType>;
  lib: string;
  flowId: string | null;
  edgeUpdaterType?: HandleType;
  updateConnection: UpdateConnection;
  panBy: PanBy;
  cancelConnection: () => void;
  onConnectStart?: OnConnectStart;
  onConnect?: OnConnect;
  onConnectEnd?: OnConnectEnd;
  isValidConnection?: IsValidConnection;
  onReconnectEnd?: (evt: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => void;
  onConnectionTargetChange?: (nodeId: string | null) => void;
  getTransform: () => Transform;
  getFromHandle: () => Handle | null;
  autoPanSpeed?: number;
  dragThreshold?: number;
  handleDomNode: Element;
  /** Optional extra visibility check. Called only for nodes that already pass
   *  the `!node.hidden` guard. Return `false` to exclude a node from snap and
   *  drop-target search (e.g. collapse-hidden children). */
  isNodeVisible?: (node: InternalNodeBase) => boolean;
};

export type IsValidParams = {
  handle: Pick<Handle, 'nodeId' | 'id' | 'type'> | null;
  connectionMode: ConnectionMode;
  fromNodeId: string;
  fromHandleId: string | null;
  fromType: HandleType;
  isValidConnection?: IsValidConnection;
  doc: Document | ShadowRoot;
  lib: string;
  flowId: string | null;
  nodeLookup: NodeLookup;
};

/**
 * Params for {@link XYHandleInstance.getClickConnectionState} — the stateless
 * per-move computation that powers the click-to-connect preview line. A subset
 * of {@link OnPointerDownParams}: no listener/drag lifecycle, just what's needed
 * to resolve the endpoint (snap + validity) for one cursor position.
 */
export type ClickConnectionStateParams<NodeType extends InternalNodeBase = InternalNodeBase> = {
  connectionMode: ConnectionMode;
  connectionRadius: number;
  domNode: HTMLDivElement | null;
  /** The armed handle. */
  handleId: string | null;
  nodeId: string;
  isTarget: boolean;
  nodeLookup: NodeLookup<NodeType>;
  lib: string;
  flowId: string | null;
  isValidConnection?: IsValidConnection;
  getTransform: () => Transform;
  isNodeVisible?: (node: InternalNodeBase) => boolean;
};

export type XYHandleInstance = {
  onPointerDown: <NodeType extends InternalNodeBase = InternalNodeBase>(
    event: MouseEvent | TouchEvent,
    params: OnPointerDownParams<NodeType>
  ) => void;
  isValid: (event: MouseEvent | TouchEvent, params: IsValidParams) => Result;
  /**
   * Compute the in-progress connection state for a click-to-connect preview:
   * a line from the armed handle to the cursor, snapping to the nearest handle
   * within `connectionRadius` and reporting validity — the same computation
   * `onPointerDown`'s move handler performs, but stateless (one call per move).
   * Returns `null` if the armed handle can't be resolved.
   */
  getClickConnectionState: <NodeType extends InternalNodeBase = InternalNodeBase>(
    event: MouseEvent,
    params: ClickConnectionStateParams<NodeType>
  ) => ConnectionInProgress | null;
};

export type Result = {
  handleDomNode: Element | null;
  isValid: boolean;
  connection: Connection | null;
  toHandle: Handle | null;
};

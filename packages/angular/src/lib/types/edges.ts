import type { Type } from '@angular/core';
import type {
  EdgeBase,
  BezierPathOptions,
  SmoothStepPathOptions,
  StepPathOptions,
  DefaultEdgeOptionsBase,
  EdgePosition,
  HandleType,
  ConnectionLineType,
  Handle,
  Position,
  FinalConnectionState,
  XYPosition,
} from '@xyflow/system';

import type { InternalNode, Node } from './nodes';

/**
 * Options for edge label rendering.
 */
export type EdgeLabelOptions = {
  label?: string;
  labelStyle?: Partial<CSSStyleDeclaration>;
  labelShowBg?: boolean;
  labelBgStyle?: Partial<CSSStyleDeclaration>;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
};

/**
 * An Edge is the complete description of an edge in Angular Flow.
 */
export type Edge<
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeType extends string | undefined = string | undefined
> = EdgeBase<EdgeData, EdgeType> &
  EdgeLabelOptions & {
    style?: Partial<CSSStyleDeclaration>;
    className?: string;
    reconnectable?: boolean | HandleType;
    focusable?: boolean;
    ariaRole?: string;
    domAttributes?: Record<string, string>;
  };

export type BuiltInEdge =
  | Edge<Record<string, unknown>, 'smoothstep'>
  | Edge<Record<string, unknown>, 'default'>
  | Edge<Record<string, unknown>, 'step'>
  | Edge<Record<string, unknown>, 'straight'>;

export type EdgeMouseHandler<EdgeType extends Edge = Edge> = (event: MouseEvent, edge: EdgeType) => void;

export type DefaultEdgeOptions = DefaultEdgeOptionsBase<Edge>;

/**
 * Props passed to custom edge components via signal inputs.
 */
export type EdgeProps<EdgeType extends Edge = Edge> = Pick<
  EdgeType,
  'id' | 'type' | 'animated' | 'data' | 'style' | 'selected' | 'source' | 'target' | 'selectable' | 'deletable'
> &
  EdgePosition & {
    label?: string;
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
    markerStart?: string;
    markerEnd?: string;
    pathOptions?: BezierPathOptions | SmoothStepPathOptions | Record<string, unknown>;
    interactionWidth?: number;
  };

/**
 * Map of edge type names to Angular component types.
 */
export type EdgeTypes = Record<string, Type<any>>;

/**
 * Input contract for custom edge components rendered via NgComponentOutlet.
 * Custom edge components should declare signal inputs matching these properties.
 */
export interface EdgeComponentInputs<EdgeType extends Edge = Edge> {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data: EdgeType['data'];
  selected: boolean;
  type: string;
  markerStart: string;
  markerEnd: string;
}

/**
 * Props for the ConnectionLine component.
 */
export type ConnectionLineComponentProps<NodeType extends Node = Node> = {
  connectionLineType: ConnectionLineType;
  fromNode: InternalNode<NodeType>;
  fromHandle: Handle;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromPosition: Position;
  toPosition: Position;
  connectionStatus: 'valid' | 'invalid' | null;
  toNode: InternalNode<NodeType> | null;
  toHandle: Handle | null;
  pointer: XYPosition;
};

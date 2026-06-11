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
  XYPosition,
} from '@angflow/system';

import type { InternalNode, Node } from './nodes';
import type { CSSProperties } from './general';

/**
 * Options for edge label rendering.
 */
export type EdgeLabelOptions = {
  label?: string;
  labelStyle?: CSSProperties;
  labelShowBg?: boolean;
  labelBgStyle?: CSSProperties;
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
    style?: CSSProperties;
    className?: string;
    reconnectable?: boolean | HandleType;
    focusable?: boolean;
    ariaRole?: string;
    domAttributes?: Record<string, string>;
    pathOptions?: BezierPathOptions | SmoothStepPathOptions | StepPathOptions;
  };

type SmoothStepEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> =
  Edge<EdgeData, 'smoothstep'> & { pathOptions?: SmoothStepPathOptions };

type BezierEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> =
  Edge<EdgeData, 'default'> & { pathOptions?: BezierPathOptions };

type StepEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> =
  Edge<EdgeData, 'step'> & { pathOptions?: StepPathOptions };

type StraightEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> =
  Edge<EdgeData, 'straight'>;

export type BuiltInEdge = SmoothStepEdge | BezierEdge | StepEdge | StraightEdge;

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EdgeTypes = Record<string, Type<any>>; // heterogeneous component registry

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

import type { Type, Signal } from '@angular/core';
import type { NodeBase, InternalNodeBase, NodeProps as NodePropsBase, CoordinateExtent, OnError, Position } from '@angflow/system';
import type { CSSProperties } from './general';

/**
 * The Node type represents everything Angular Flow needs to know about a given node.
 */
export type Node<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  NodeType extends string | undefined = string | undefined
> = NodeBase<NodeData, NodeType> & {
  style?: CSSProperties;
  className?: string;
  resizing?: boolean;
  focusable?: boolean;
  ariaRole?: string;
  domAttributes?: Record<string, string>;
  /** When true on a group/parent node, angflow hides its descendants and reroutes crossing edges to the box. */
  collapsed?: boolean;
};

/**
 * The InternalNode type extends Node with additional internal properties.
 */
export type InternalNode<NodeType extends Node = Node> = InternalNodeBase<NodeType>;

export type NodeMouseHandler<NodeType extends Node = Node> = (event: MouseEvent, node: NodeType) => void;

export type SelectionDragHandler<NodeType extends Node = Node> = (event: MouseEvent, nodes: NodeType[]) => void;

export type OnNodeDrag<NodeType extends Node = Node> = (
  event: MouseEvent,
  node: NodeType,
  nodes: NodeType[]
) => void;

/**
 * Built-in node types available in Angular Flow.
 */
export type BuiltInNode =
  | Node<{ label: string }, 'input' | 'output' | 'default' | undefined>
  | Node<Record<string, never>, 'group'>;

/**
 * Props passed to custom node components via signal inputs.
 */
export type NodeProps<NodeType extends Node = Node> = NodePropsBase<NodeType>;

/**
 * Map of node type names to Angular component types.
 */
export type NodeTypes = Record<string, Type<any>>;

/**
 * Input contract for custom node components rendered via NgComponentOutlet.
 * Custom node components should declare signal inputs matching these properties.
 */
export interface NodeComponentInputs<NodeType extends Node = Node> {
  id: string;
  data: NodeType['data'];
  type: string;
  selected: boolean;
  dragging: boolean;
  zIndex: number;
  isConnectable: boolean;
  positionAbsoluteX: number;
  positionAbsoluteY: number;
  sourcePosition: import('@angflow/system').Position;
  targetPosition: import('@angflow/system').Position;
  dragHandle?: string;
}

/**
 * Reactive context passed to a custom node component registered via `nodeTypes`.
 * Retrieved by `injectNgFlowNode<TData>()` inside the component class.
 *
 * All properties are read-only signals. Writes to node state must go through
 * `NgFlowService` or `FlowStore` — this context is a view-only projection.
 */
export interface NgFlowNodeContext<TData = unknown> {
  /** Node id. */
  readonly id: Signal<string>;

  /** Consumer-provided data payload. Typed via `TData`. */
  readonly data: Signal<TData | undefined>;

  /** The node's registered type string (or 'default'). */
  readonly type: Signal<string | undefined>;

  /** True while this node is part of the current selection. */
  readonly selected: Signal<boolean>;

  /** True while this node is being dragged. */
  readonly dragging: Signal<boolean>;

  /** Stacking order computed by the library (selection elevation, etc.). */
  readonly zIndex: Signal<number>;

  /** Whether connection drag is allowed from this node's handles. */
  readonly isConnectable: Signal<boolean>;

  /** Absolute position in flow coordinates. */
  readonly position: Signal<{ x: number; y: number }>;

  /** sourcePosition for default edges (Position enum, optional). */
  readonly sourcePosition: Signal<Position | undefined>;

  /** targetPosition for default edges. */
  readonly targetPosition: Signal<Position | undefined>;

  /** CSS selector for the drag-handle sub-element, if any. */
  readonly dragHandle: Signal<string | undefined>;
}

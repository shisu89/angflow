import type { Type } from '@angular/core';
import type { NodeBase, InternalNodeBase, NodeProps as NodePropsBase, CoordinateExtent, OnError } from '@xyflow/system';

/**
 * The Node type represents everything Angular Flow needs to know about a given node.
 */
export type Node<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  NodeType extends string | undefined = string | undefined
> = NodeBase<NodeData, NodeType> & {
  style?: Partial<CSSStyleDeclaration>;
  className?: string;
  resizing?: boolean;
  focusable?: boolean;
  ariaRole?: string;
  domAttributes?: Record<string, string>;
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

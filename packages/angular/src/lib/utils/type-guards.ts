import { isNodeBase, isEdgeBase } from '@angflow/system';
import type { Node, Edge } from '../types';

/**
 * Type guard to check if an element is a Node.
 * Angular-specific wrapper around isNodeBase with Angular Flow typing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNode<NodeType extends Node = Node>(element: any): element is NodeType { // type-guard input is intentionally unknown-shaped
  return isNodeBase(element);
}

/**
 * Type guard to check if an element is an Edge.
 * Angular-specific wrapper around isEdgeBase with Angular Flow typing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEdge<EdgeType extends Edge = Edge>(element: any): element is EdgeType { // type-guard input is intentionally unknown-shaped
  return isEdgeBase(element);
}

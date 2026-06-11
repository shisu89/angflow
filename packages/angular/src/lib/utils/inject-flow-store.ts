import { inject } from '@angular/core';
import { FlowStore } from '../services/flow-store.service';
import { NgFlowService } from '../services/ng-flow.service';
import type { Node, Edge } from '../types';

/**
 * Injects the ambient {@link FlowStore} re-parameterised to the caller's node/edge types.
 *
 * The `FlowStore` DI token is generic-erased, so a single documented variance cast lives
 * here rather than at every call site. The runtime instance is identical regardless of
 * generics — this only refines the static type.
 */
export function injectFlowStore<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): FlowStore<NodeType, EdgeType> {
  // Variance-forced: DI tokens erase generics; the runtime store is the same instance.
  return inject(FlowStore) as unknown as FlowStore<NodeType, EdgeType>;
}

/**
 * Injects the ambient {@link NgFlowService} re-parameterised to the caller's node/edge types.
 * Same generic-erasure rationale as {@link injectFlowStore}.
 */
export function injectNgFlowService<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): NgFlowService<NodeType, EdgeType> {
  // Variance-forced: DI tokens erase generics; the runtime service is the same instance.
  return inject(NgFlowService) as unknown as NgFlowService<NodeType, EdgeType>;
}

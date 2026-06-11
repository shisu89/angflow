import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';

/**
 * Provides a `FlowStore` and `NgFlowService` to its descendants without
 * rendering a flow, so flow state can be shared across siblings of a
 * `<ng-flow>` rather than only its children.
 *
 * A descendant `<ng-flow>` reuses this provider's `FlowStore` and
 * `NgFlowService` instead of creating its own (it resolves them with
 * `skipSelf`), so any sibling that injects `NgFlowService` (e.g. a sidebar
 * calling `fitView` or `setNodes`) observes and mutates the same state the
 * flow renders. The provider owns the store's lifetime: unmounting the inner
 * `<ng-flow>` does NOT clear the shared store's graph state (nodes, edges,
 * etc.) — surviving siblings keep observing it, matching ReactFlow's provider
 * semantics. Only the panZoom instance is cleared on inner unmount, because
 * that DOM-bound object is destroyed along with the component.
 *
 * @example
 * ```html
 * <ng-flow-provider>
 *   <ng-flow [nodes]="nodes" [edges]="edges" />
 *   <my-sidebar />  <!-- inject NgFlowService; sees the same store -->
 * </ng-flow-provider>
 * ```
 */
@Component({
  selector: 'ng-flow-provider',
  standalone: true,
  providers: [FlowStore, NgFlowService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
})
export class NgFlowProviderComponent {}

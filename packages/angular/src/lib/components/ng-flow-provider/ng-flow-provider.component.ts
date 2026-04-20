import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';

/**
 * Provides a `FlowStore` and `NgFlowService` to its descendants without
 * rendering a flow. Useful when you need to call `NgFlowService` methods
 * (e.g. `fitView`) from a component that sits as a sibling of `<ng-flow>`
 * rather than a child.
 *
 * @example
 * ```html
 * <ng-flow-provider>
 *   <ng-flow [nodes]="nodes" [edges]="edges" />
 *   <my-sidebar />  <!-- can inject NgFlowService -->
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

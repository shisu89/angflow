import { Directive, Input, TemplateRef, inject } from '@angular/core';

/**
 * Structural directive that registers an ng-template as a custom node type.
 *
 * Usage:
 * ```html
 * <ng-flow [nodes]="nodes" [edges]="edges">
 *   <ng-template ngFlowNodeType="custom" let-node>
 *     <div class="my-node">{{ node.data.label }}</div>
 *   </ng-template>
 * </ng-flow>
 * ```
 */
@Directive({
  selector: '[ngFlowNodeType]',
  standalone: true,
})
export class NgFlowNodeTypeDirective {
  readonly template = inject(TemplateRef);

  @Input({ required: true, alias: 'ngFlowNodeType' })
  type!: string;
}

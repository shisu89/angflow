import { Directive, inject, output, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { NgFlowService } from '../services/ng-flow.service';
import type { XYPosition } from '@angflow/system';

/**
 * Directive that makes the flow canvas a drop zone for external drag-and-drop.
 * Works with both native HTML5 drag-and-drop and Angular CDK draggables.
 *
 * Usage:
 * ```html
 * <ng-flow ngFlowDropZone (nodeDrop)="onDrop($event)" [nodes]="nodes" [edges]="edges">
 *   ...
 * </ng-flow>
 * ```
 */
@Directive({
  selector: '[ngFlowDropZone]',
  standalone: true,
})
export class NgFlowDropZoneDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private flowService = inject(NgFlowService);

  readonly nodeDrop = output<{ event: DragEvent; flowPosition: XYPosition; data: string | null }>();

  private onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  private onDrop = (event: DragEvent) => {
    event.preventDefault();

    const flowPosition = this.flowService.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const data = event.dataTransfer?.getData('application/json')
      ?? event.dataTransfer?.getData('text/plain')
      ?? null;

    this.nodeDrop.emit({ event, flowPosition, data });
  };

  ngOnInit(): void {
    const el = this.el.nativeElement;
    el.addEventListener('dragover', this.onDragOver);
    el.addEventListener('drop', this.onDrop);
  }

  ngOnDestroy(): void {
    const el = this.el.nativeElement;
    el.removeEventListener('dragover', this.onDragOver);
    el.removeEventListener('drop', this.onDrop);
  }
}

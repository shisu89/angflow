import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ng-flow-edge-label-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__edgelabel-renderer xy-flow__edgelabel-renderer',
  },
  template: `<ng-content />`,
})
export class EdgeLabelRendererComponent {}

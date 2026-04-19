import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Host layer for HTML edge labels. Placing label HTML here instead of inside
 * the SVG lets you use any DOM element (inputs, buttons, etc.) as a label.
 */
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

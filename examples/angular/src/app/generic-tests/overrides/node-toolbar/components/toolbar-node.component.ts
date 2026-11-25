import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HandleComponent, NodeToolbarComponent, Position } from '@angflow/angular';

@Component({
  selector: 'toolbar-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeToolbarComponent],
  template: `
    <ng-flow-node-toolbar
      [isVisible]="data()?.toolbarVisible"
      [position]="data()?.toolbarPosition"
      [align]="data()?.toolbarAlign ?? 'center'"
    >
      <button>delete</button>
      <button>copy</button>
      <button>expand</button>
    </ng-flow-node-toolbar>
    <div>{{ data()?.label }}</div>
    <ng-flow-handle type="target" [position]="Position.Left" />
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
})
export class ToolbarNodeComponent {
  readonly data = input<any>();
  protected readonly Position = Position;
}

import { Component, ChangeDetectionStrategy, input, inject, computed } from '@angular/core';
import {
  HandleComponent,
  NodeResizerComponent,
  NodeToolbarComponent,
  NgFlowService,
  Position,
} from '@angflow/angular';

/**
 * A kitchen-sink "rich" node. Exercises:
 *   - source/target handles
 *   - NodeResizer with min/max
 *   - NodeToolbar attached to the node context
 *   - inline form UI (text input + number input)
 */
@Component({
  selector: 'app-ks-rich-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeResizerComponent, NodeToolbarComponent],
  template: `
    <ng-flow-node-toolbar [isVisible]="showToolbar() && selected()" [position]="Position.Top">
      <div class="ks-toolbar">
        <button type="button" (click)="duplicate()">Duplicate</button>
        <button type="button" class="ks-toolbar__danger" (click)="remove()">Delete</button>
      </div>
    </ng-flow-node-toolbar>
    @if (showResizer()) {
      <ng-flow-node-resizer
        [minWidth]="160"
        [minHeight]="90"
        [maxWidth]="480"
        [maxHeight]="280"
        color="#6366f1"
      />
    }
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="ks-rich">
      <div class="ks-rich__header">{{ data()?.label || 'Rich node' }}</div>
      <div class="ks-rich__body nodrag">
        <label class="ks-rich__label">Name</label>
        <input
          type="text"
          class="ks-rich__input"
          [value]="data()?.name ?? ''"
          placeholder="Enter name…"
          (input)="onFieldChange('name', $event)"
        />
        <label class="ks-rich__label">Count</label>
        <input
          type="number"
          class="ks-rich__input"
          [value]="data()?.count ?? 0"
          (input)="onFieldChange('count', $event)"
        />
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ks-rich {
      width: 100%;
      height: 100%;
      background: var(--ks-node-bg, #ffffff);
      border: 2px solid var(--ks-accent, #6366f1);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.15);
      color: var(--ks-node-text, #0f172a);
    }
    .ks-rich__header {
      padding: 8px 14px;
      background: var(--ks-accent, #6366f1);
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
    }
    .ks-rich__body {
      padding: 10px 14px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      overflow: auto;
    }
    .ks-rich__label {
      font-size: 10px;
      font-weight: 700;
      color: var(--ks-node-muted, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }
    .ks-rich__input {
      padding: 5px 8px;
      border: 1px solid var(--ks-border, #e2e8f0);
      border-radius: 5px;
      font-size: 12px;
      background: var(--ks-field-bg, #f8fafc);
      color: var(--ks-node-text, #0f172a);
      outline: none;
      font-family: inherit;
    }
    .ks-rich__input:focus {
      border-color: var(--ks-accent, #6366f1);
      background: var(--ks-node-bg, #ffffff);
    }
    .ks-toolbar {
      display: flex;
      gap: 4px;
      background: var(--ks-chrome-bg, #ffffff);
      padding: 4px;
      border: 1px solid var(--ks-border, #e2e8f0);
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
    }
    .ks-toolbar button {
      padding: 4px 10px;
      background: transparent;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--ks-text, #0f172a);
      cursor: pointer;
      font-family: inherit;
    }
    .ks-toolbar button:hover {
      background: var(--ks-field-bg, #f8fafc);
    }
    .ks-toolbar__danger {
      color: #dc2626 !important;
    }
  `],
})
export class KitchenSinkRichNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();

  private flow = inject(NgFlowService);

  readonly showResizer = computed<boolean>(() => this.data()?._showResizer ?? true);
  readonly showToolbar = computed<boolean>(() => this.data()?._showToolbar ?? true);

  onFieldChange(field: string, event: Event): void {
    const el = event.target as HTMLInputElement;
    const value = field === 'count' ? Number(el.value) : el.value;
    this.flow.updateNodeData(this.id(), { [field]: value });
  }

  async remove(): Promise<void> {
    await this.flow.deleteElements({ nodes: [{ id: this.id() } as any] });
  }

  duplicate(): void {
    const node = this.flow.getNode(this.id());
    if (!node) return;
    const newId = `${this.id()}-copy-${Date.now()}`;
    this.flow.addNodes({
      ...node,
      id: newId,
      selected: false,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
    } as any);
  }
}

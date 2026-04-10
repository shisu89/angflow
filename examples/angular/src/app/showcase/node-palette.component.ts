import { Component, ChangeDetectionStrategy } from '@angular/core';

export type PaletteKind = 'httpRequest' | 'transform' | 'validate' | 'result';

export interface PaletteDescriptor {
  kind: PaletteKind;
  label: string;
  hint: string;
  accent: string;
}

export const PALETTE_ITEMS: PaletteDescriptor[] = [
  { kind: 'httpRequest', label: 'HTTP Request', hint: 'Fetch remote data', accent: '#3b82f6' },
  { kind: 'transform',   label: 'Transform',    hint: 'Map / filter',       accent: '#8b5cf6' },
  { kind: 'validate',    label: 'Validate',     hint: 'Check schema',       accent: '#f59e0b' },
  { kind: 'result',      label: 'Output',       hint: 'Result sink',        accent: '#10b981' },
];

@Component({
  selector: 'app-node-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="palette">
      <div class="palette__label">Nodes</div>
      @for (item of items; track item.kind) {
        <div
          class="palette__item"
          draggable="true"
          [style.--item-accent]="item.accent"
          (dragstart)="onDragStart($event, item)"
        >
          <div class="palette__item-swatch"></div>
          <div class="palette__item-text">
            <div class="palette__item-label">{{ item.label }}</div>
            <div class="palette__item-hint">{{ item.hint }}</div>
          </div>
        </div>
      }
      <div class="palette__instructions">
        Drag an item onto the canvas to add a node.
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 200px;
      flex-shrink: 0;
      background: var(--sc-chrome-bg, #ffffff);
      border-right: 1px solid var(--sc-chrome-border, #e2e8f0);
    }
    .palette {
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .palette__label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--sc-chrome-muted, #94a3b8);
      padding: 0 6px 4px;
    }
    .palette__item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--sc-field-bg, #f8fafc);
      border: 1px solid var(--sc-chrome-border, #e2e8f0);
      border-left: 3px solid var(--item-accent, #6366f1);
      border-radius: 8px;
      cursor: grab;
      transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    }
    .palette__item:hover {
      background: var(--sc-chrome-bg, #ffffff);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    }
    .palette__item:active {
      cursor: grabbing;
    }
    .palette__item-swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--item-accent, #6366f1);
      flex-shrink: 0;
    }
    .palette__item-text {
      flex: 1;
      min-width: 0;
    }
    .palette__item-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--sc-chrome-text, #0f172a);
    }
    .palette__item-hint {
      font-size: 10px;
      color: var(--sc-chrome-muted, #94a3b8);
      margin-top: 1px;
    }
    .palette__instructions {
      margin-top: 16px;
      padding: 10px 12px;
      font-size: 11px;
      color: var(--sc-chrome-muted, #94a3b8);
      line-height: 1.5;
      text-align: center;
    }
  `],
})
export class NodePaletteComponent {
  readonly items = PALETTE_ITEMS;

  onDragStart(event: DragEvent, item: PaletteDescriptor): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/json', JSON.stringify({ kind: item.kind }));
    event.dataTransfer.effectAllowed = 'move';
  }
}

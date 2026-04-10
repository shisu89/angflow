import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { NgFlowService } from '@angflow/angular';
import type { Node, Edge } from '@angflow/angular';

@Component({
  selector: 'app-inspector-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inspector">
      <div class="inspector__label">Inspector</div>

      @if (selectedNode(); as node) {
        <div class="inspector__section">
          <div class="inspector__field">
            <div class="inspector__field-label">ID</div>
            <div class="inspector__readonly">{{ node.id }}</div>
          </div>
          <div class="inspector__field">
            <div class="inspector__field-label">Type</div>
            <div class="inspector__readonly">{{ node.type || 'default' }}</div>
          </div>
          <div class="inspector__field">
            <div class="inspector__field-label">Label</div>
            <input
              class="inspector__input"
              type="text"
              [value]="currentLabel()"
              (input)="onLabelChange(node.id, $event)"
            />
          </div>
          @if (nodeDataSummary(node); as summary) {
            @if (summary.length > 0) {
              <div class="inspector__field">
                <div class="inspector__field-label">Data</div>
                <div class="inspector__data">
                  @for (entry of summary; track entry.key) {
                    <div class="inspector__data-row">
                      <span class="inspector__data-key">{{ entry.key }}</span>
                      <span class="inspector__data-value">{{ entry.value }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>
      } @else if (selectedCount() > 1) {
        <div class="inspector__empty">
          {{ selectedCount() }} elements selected
        </div>
      } @else {
        <div class="inspector__empty">
          Click a node to inspect it
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 260px;
      flex-shrink: 0;
      background: var(--sc-chrome-bg, #ffffff);
      border-left: 1px solid var(--sc-chrome-border, #e2e8f0);
      overflow-y: auto;
    }
    .inspector {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .inspector__label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--sc-chrome-muted, #94a3b8);
    }
    .inspector__section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .inspector__field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .inspector__field-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--sc-chrome-muted, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .inspector__readonly {
      padding: 6px 10px;
      background: var(--sc-field-bg, #f8fafc);
      border: 1px solid var(--sc-chrome-border, #e2e8f0);
      border-radius: 6px;
      font-size: 12px;
      color: var(--sc-chrome-text, #0f172a);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .inspector__input {
      padding: 6px 10px;
      background: var(--sc-field-bg, #f8fafc);
      border: 1px solid var(--sc-chrome-border, #e2e8f0);
      border-radius: 6px;
      font-size: 12px;
      color: var(--sc-chrome-text, #0f172a);
      outline: none;
      font-family: inherit;
      transition: border-color 0.12s;
    }
    .inspector__input:focus {
      border-color: var(--sc-accent, #6366f1);
    }
    .inspector__data {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px;
      background: var(--sc-field-bg, #f8fafc);
      border: 1px solid var(--sc-chrome-border, #e2e8f0);
      border-radius: 6px;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .inspector__data-row {
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .inspector__data-key {
      color: var(--sc-chrome-muted, #94a3b8);
    }
    .inspector__data-value {
      color: var(--sc-chrome-text, #0f172a);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .inspector__empty {
      text-align: center;
      color: var(--sc-chrome-muted, #94a3b8);
      font-size: 12px;
      padding: 24px 0;
    }
  `],
})
export class InspectorPanelComponent {
  readonly flow = input<NgFlowService<Node, Edge> | null>(null);

  readonly selection = computed<{ nodes: Node[]; edges: Edge[] }>(() => {
    const f = this.flow();
    if (!f) return { nodes: [], edges: [] };
    return {
      nodes: f.selectedNodes() as Node[],
      edges: f.selectedEdges() as Edge[],
    };
  });

  readonly selectedNode = computed<Node | null>(() => {
    const sel = this.selection();
    if (sel.nodes.length === 1 && sel.edges.length === 0) {
      return sel.nodes[0];
    }
    return null;
  });

  readonly selectedCount = computed<number>(() => {
    const sel = this.selection();
    return sel.nodes.length + sel.edges.length;
  });

  readonly currentLabel = computed<string>(() => {
    const node = this.selectedNode();
    if (!node) return '';
    const data = node.data as { label?: string; title?: string } | undefined;
    return data?.title ?? data?.label ?? '';
  });

  nodeDataSummary(node: Node): { key: string; value: string }[] {
    const data = node.data as Record<string, unknown> | undefined;
    if (!data) return [];
    return Object.entries(data)
      .filter(([key, value]) =>
        key !== 'label' &&
        key !== 'title' &&
        key !== 'fields' &&
        !key.startsWith('_') &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      )
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  onLabelChange(nodeId: string, event: Event): void {
    const f = this.flow();
    if (!f) return;
    const value = (event.target as HTMLInputElement).value;
    // Write to both `label` and `title` so both color-node and form-node pick it up.
    f.updateNodeData(nodeId, { label: value, title: value });
  }
}

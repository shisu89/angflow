import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Position } from '@angflow/system';
import { HandleComponent } from '../handle/handle.component';
import { FlowStore } from '../../services/flow-store.service';
import type { NodeTemplateBadgeColor } from '../../types/node-template';
import {
  interpolateTemplateString,
  isTemplateConditionTrue,
} from '../../utils/template-interpolation';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

const POSITION_MAP: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const BADGE_COLORS = new Set<NodeTemplateBadgeColor>(['slate', 'indigo', 'emerald', 'amber', 'rose']);

/**
 * Built-in icon glyphs (24×24 stroke paths). Unknown names render nothing.
 * Deliberately tiny — hosts wanting richer icons register their own
 * component node types instead.
 */
const ICONS: Record<string, string> = {
  database:
    'M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3Zm0 0v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01',
  queue: 'M4 6h16M4 12h16M4 18h10',
  cloud: 'M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.2 9.6 4.2 4.2 0 0 1 16.8 18H7Z',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21a7 7 0 0 1 14 0',
  document: 'M6 2h8l4 4v16H6V2Zm8 0v4h4',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  settings: 'M4 7h9M17 7h3M13 4v6M4 17h3M11 17h9M7 14v6',
};

/**
 * Generic renderer for data-driven node templates registered through the
 * agent bridge (`register_node_template`). Looks up its spec in the per-flow
 * registry (`FlowStore.nodeTemplates`) by its own `type`, so overwriting a
 * template re-renders every node of that type live.
 *
 * Security: every interpolated value is rendered through Angular text
 * bindings; badge colors are palette classes, never raw CSS; `accent` is the
 * only raw color and is bound via a style binding (sanitized by Angular).
 */
@Component({
  selector: 'ng-flow-template-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec(); as s) {
      <div
        class="ng-flow__template-node"
        [class.ng-flow__template-node--compact]="(s.variant ?? 'detailed') === 'compact'"
        [class.ng-flow__template-node--selected]="node.selected()"
        [style.borderLeftColor]="s.accent ?? null"
      >
        <div class="ng-flow__template-node__header" [style.color]="s.accent ?? null">
          @if (iconPath(); as path) {
            <svg
              class="ng-flow__template-node__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path [attr.d]="path" />
            </svg>
          }
          @if (title()) {
            <span class="ng-flow__template-node__title">{{ title() }}</span>
          }
        </div>
        @if (badges().length > 0) {
          <div class="ng-flow__template-node__badges">
            @for (b of badges(); track $index) {
              <span
                class="ng-flow__template-node__badge ng-flow__template-node__badge--{{ b.color }}"
                >{{ b.text }}</span
              >
            }
          </div>
        }
        @if (fields().length > 0) {
          <dl class="ng-flow__template-node__fields">
            @for (f of fields(); track $index) {
              <div class="ng-flow__template-node__field">
                <dt>{{ f.label }}</dt>
                <dd>{{ f.value }}</dd>
              </div>
            }
          </dl>
        }
        @if (bodyText()) {
          <p class="ng-flow__template-node__body">{{ bodyText() }}</p>
        }
        @for (h of handles(); track $index) {
          <ng-flow-handle
            [type]="h.type"
            [id]="h.id ?? null"
            [position]="h.position"
            [isConnectable]="node.isConnectable()"
          />
        }
      </div>
    }
  `,
  styles: [
    `
      .ng-flow__template-node {
        min-width: 140px;
        max-width: 280px;
        padding: 8px 10px;
        border: 1px solid var(--ngf-template-node-border-color, light-dark(#d4d4d8, #3c3c3c));
        border-left: 3px solid var(--ngf-template-node-accent, light-dark(#94a3b8, #64748b));
        border-radius: 6px;
        background: var(--ngf-template-node-bg, light-dark(#ffffff, #1e1e1e));
        font-size: 12px;
        color: var(--ngf-template-node-color, light-dark(#1e293b, #f8f8f8));
      }
      .ng-flow__template-node--selected {
        box-shadow: 0 0 0 1px var(--ngf-template-node-selected-ring, #6366f1);
      }
      .ng-flow__template-node--compact {
        padding: 4px 8px;
        min-width: 100px;
      }
      .ng-flow__template-node__header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
      }
      .ng-flow__template-node__icon {
        width: 16px;
        height: 16px;
        flex: none;
      }
      .ng-flow__template-node__badges {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }
      .ng-flow__template-node__badge {
        padding: 0 6px;
        border-radius: 999px;
        font-size: 10px;
        line-height: 16px;
      }
      .ng-flow__template-node__badge--slate {
        background: var(--ngf-template-node-badge-slate-bg, light-dark(#f1f5f9, #334155));
        color: var(--ngf-template-node-badge-slate-color, light-dark(#475569, #cbd5e1));
      }
      .ng-flow__template-node__badge--indigo {
        background: var(--ngf-template-node-badge-indigo-bg, light-dark(#e0e7ff, #312e81));
        color: var(--ngf-template-node-badge-indigo-color, light-dark(#4338ca, #c7d2fe));
      }
      .ng-flow__template-node__badge--emerald {
        background: var(--ngf-template-node-badge-emerald-bg, light-dark(#d1fae5, #064e3b));
        color: var(--ngf-template-node-badge-emerald-color, light-dark(#047857, #a7f3d0));
      }
      .ng-flow__template-node__badge--amber {
        background: var(--ngf-template-node-badge-amber-bg, light-dark(#fef3c7, #78350f));
        color: var(--ngf-template-node-badge-amber-color, light-dark(#b45309, #fde68a));
      }
      .ng-flow__template-node__badge--rose {
        background: var(--ngf-template-node-badge-rose-bg, light-dark(#ffe4e6, #881337));
        color: var(--ngf-template-node-badge-rose-color, light-dark(#be123c, #fecdd3));
      }
      .ng-flow__template-node__fields {
        margin: 6px 0 0;
      }
      .ng-flow__template-node__field {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .ng-flow__template-node__field dt {
        color: var(--ngf-template-node-label-color, light-dark(#64748b, #a1a1aa));
        font-weight: 400;
      }
      .ng-flow__template-node__field dd {
        margin: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .ng-flow__template-node__body {
        margin: 6px 0 0;
        color: var(--ngf-template-node-body-color, light-dark(#475569, #d4d4d8));
      }
    `,
  ],
})
export class TemplateNodeComponent {
  private readonly store = inject(FlowStore);
  readonly node = injectNgFlowNode<Record<string, unknown>>();

  readonly spec = computed(() => this.store.nodeTemplates().get(this.node.type() ?? ''));

  readonly title = computed(() =>
    interpolateTemplateString(this.spec()?.title ?? '', this.node.data()),
  );

  readonly iconPath = computed(() => {
    const icon = this.spec()?.icon;
    return icon ? ICONS[icon] ?? null : null;
  });

  readonly badges = computed(() =>
    (this.spec()?.badges ?? [])
      .filter((b) => isTemplateConditionTrue(b.showIf, this.node.data()))
      .map((b) => ({
        text: interpolateTemplateString(b.text, this.node.data()),
        color: BADGE_COLORS.has(b.color as NodeTemplateBadgeColor) ? b.color! : 'slate',
      })),
  );

  readonly fields = computed(() =>
    (this.spec()?.fields ?? [])
      .filter((f) => isTemplateConditionTrue(f.showIf, this.node.data()))
      .map((f) => ({ label: f.label, value: interpolateTemplateString(f.value, this.node.data()) })),
  );

  readonly bodyText = computed(() =>
    interpolateTemplateString(this.spec()?.body ?? '', this.node.data()),
  );

  readonly handles = computed(() => {
    const declared = this.spec()?.handles ?? [
      { type: 'target' as const, position: 'left' as const },
      { type: 'source' as const, position: 'right' as const },
    ];
    return declared.map((h) => ({
      type: h.type,
      id: h.id,
      position: POSITION_MAP[h.position ?? (h.type === 'target' ? 'left' : 'right')],
    }));
  });
}

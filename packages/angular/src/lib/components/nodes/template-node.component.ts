import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Position } from '@angflow/system';
import { HandleComponent } from '../handle/handle.component';
import { FlowStore } from '../../services/flow-store.service';
import type { NodeTemplateBadgeColor } from '../../types/node-template';
import {
  interpolateTemplateString,
  isTemplateConditionTrue,
} from '../../utils/template-interpolation';

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
        [class.ng-flow__template-node--selected]="selected()"
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
            [isConnectable]="isConnectable()"
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
        border: 1px solid #d4d4d8;
        border-left: 3px solid #94a3b8;
        border-radius: 6px;
        background: #ffffff;
        font-size: 12px;
        color: #1e293b;
      }
      .ng-flow__template-node--selected {
        box-shadow: 0 0 0 1px #6366f1;
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
      .ng-flow__template-node__badge--slate { background: #f1f5f9; color: #475569; }
      .ng-flow__template-node__badge--indigo { background: #e0e7ff; color: #4338ca; }
      .ng-flow__template-node__badge--emerald { background: #d1fae5; color: #047857; }
      .ng-flow__template-node__badge--amber { background: #fef3c7; color: #b45309; }
      .ng-flow__template-node__badge--rose { background: #ffe4e6; color: #be123c; }
      .ng-flow__template-node__fields {
        margin: 6px 0 0;
      }
      .ng-flow__template-node__field {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .ng-flow__template-node__field dt {
        color: #64748b;
        font-weight: 400;
      }
      .ng-flow__template-node__field dd {
        margin: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .ng-flow__template-node__body {
        margin: 6px 0 0;
        color: #475569;
      }
    `,
  ],
})
export class TemplateNodeComponent {
  private readonly store = inject(FlowStore);

  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<Position>();
  readonly targetPosition = input<Position>();
  readonly dragHandle = input<string>();

  readonly spec = computed(() => this.store.nodeTemplates().get(this.type() ?? ''));

  readonly title = computed(() =>
    interpolateTemplateString(this.spec()?.title ?? '', this.data()),
  );

  readonly iconPath = computed(() => {
    const icon = this.spec()?.icon;
    return icon ? ICONS[icon] ?? null : null;
  });

  readonly badges = computed(() =>
    (this.spec()?.badges ?? [])
      .filter((b) => isTemplateConditionTrue(b.showIf, this.data()))
      .map((b) => ({
        text: interpolateTemplateString(b.text, this.data()),
        color: BADGE_COLORS.has(b.color as NodeTemplateBadgeColor) ? b.color! : 'slate',
      })),
  );

  readonly fields = computed(() =>
    (this.spec()?.fields ?? [])
      .filter((f) => isTemplateConditionTrue(f.showIf, this.data()))
      .map((f) => ({ label: f.label, value: interpolateTemplateString(f.value, this.data()) })),
  );

  readonly bodyText = computed(() =>
    interpolateTemplateString(this.spec()?.body ?? '', this.data()),
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

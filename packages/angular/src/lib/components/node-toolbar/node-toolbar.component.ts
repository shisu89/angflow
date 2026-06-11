import { Component, ChangeDetectionStrategy, input, inject, computed, Optional, Inject } from '@angular/core';
import { Position } from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

/**
 * Floating toolbar anchored to a node. By default it appears only while the
 * owning node is selected. Use inside a node template, or pass `[nodeId]` to
 * render it anywhere in the flow.
 *
 * @example
 * ```html
 * <ng-flow-node-toolbar [position]="Position.Top">
 *   <button (click)="delete()">Delete</button>
 * </ng-flow-node-toolbar>
 * ```
 */
@Component({
  selector: 'ng-flow-node-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-id]': 'resolvedNodeIds()[0]',
    '[class]': 'shouldShow() ? "ng-flow__node-toolbar xy-flow__node-toolbar" : ""',
    '[style.position]': '"absolute"',
    '[style.left.px]': '0',
    '[style.top.px]': '0',
    '[style.pointer-events]': 'shouldShow() ? "all" : "none"',
    '[style.z-index]': '1000',
    '[style.display]': 'shouldShow() ? "block" : "none"',
    '[style.transform]': 'toolbarTransform()',
  },
  template: `<ng-content />`,
})
export class NodeToolbarComponent {
  private store = inject(FlowStore);

  /**
   * Node id(s) this toolbar is anchored to. If omitted and the toolbar is
   * rendered inside a node template, the host node is used automatically.
   * Aliased as `nodeId`.
   */
  readonly nodeIdInput = input<string | string[] | undefined>(undefined, { alias: 'nodeId' });
  /** Which side of the node the toolbar appears on. */
  readonly position = input<Position>(Position.Top);
  /** Override visibility. When unset, the toolbar shows only while the node is selected. */
  readonly isVisible = input<boolean>();
  /** Gap in pixels between the toolbar and the node edge. */
  readonly offset = input(10);
  /** Alignment of the toolbar along the node edge. */
  readonly align = input<'start' | 'center' | 'end'>('center');

  private contextNodeId: string = '';

  constructor(@Optional() @Inject(NODE_ID) nodeId: string | null) {
    this.contextNodeId = nodeId ?? '';
  }

  readonly resolvedNodeIds = computed((): string[] => {
    const inputId = this.nodeIdInput();
    if (inputId !== undefined) {
      return Array.isArray(inputId) ? inputId : [inputId];
    }
    return this.contextNodeId ? [this.contextNodeId] : [];
  });

  readonly shouldShow = computed(() => {
    this.store.version(); // react to node changes
    if (this.isVisible() !== undefined) return this.isVisible()!;
    const ids = this.resolvedNodeIds();
    return ids.some(id => {
      const node = this.store.nodeLookup.get(id);
      return node?.selected ?? false;
    });
  });

  readonly toolbarTransform = computed(() => {
    this.store.version(); // react to measure/resize — nodeLookup is mutated in place
    const ids = this.resolvedNodeIds();
    if (ids.length === 0) return '';

    // Use the first node for positioning
    const node = this.store.nodeLookup.get(ids[0]);
    if (!node) return '';

    const w = node.measured?.width ?? node.width ?? 0;
    const h = node.measured?.height ?? node.height ?? 0;
    const pos = this.position();
    const off = this.offset();
    const alignVal = this.align();

    switch (pos) {
      case Position.Top:
      case Position.Bottom: {
        const xOffset = alignVal === 'start' ? 0 : alignVal === 'end' ? w : w / 2;
        const xTranslate = alignVal === 'start' ? '0' : alignVal === 'end' ? '-100%' : '-50%';
        if (pos === Position.Top) {
          return `translate(${xOffset}px, ${-off}px) translate(${xTranslate}, -100%)`;
        }
        return `translate(${xOffset}px, ${h + off}px) translate(${xTranslate}, 0)`;
      }
      case Position.Left:
      case Position.Right: {
        const yOffset = alignVal === 'start' ? 0 : alignVal === 'end' ? h : h / 2;
        const yTranslate = alignVal === 'start' ? '0' : alignVal === 'end' ? '-100%' : '-50%';
        if (pos === Position.Left) {
          return `translate(${-off}px, ${yOffset}px) translate(-100%, ${yTranslate})`;
        }
        return `translate(${w + off}px, ${yOffset}px) translate(0, ${yTranslate})`;
      }
      default:
        return '';
    }
  });
}

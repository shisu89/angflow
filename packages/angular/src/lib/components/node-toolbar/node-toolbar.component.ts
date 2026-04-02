import { Component, ChangeDetectionStrategy, input, inject, computed, Optional, Inject } from '@angular/core';
import { Position } from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

@Component({
  selector: 'ng-flow-node-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__node-toolbar',
    'style': 'position: absolute; pointer-events: all; z-index: 1000;',
    '[style.display]': 'shouldShow() ? "block" : "none"',
    '[style.transform]': 'toolbarTransform()',
  },
  template: `<ng-content />`,
})
export class NodeToolbarComponent {
  private store = inject(FlowStore);

  /** Node ID(s) this toolbar belongs to. Can be a single ID or array of IDs. */
  readonly nodeIdInput = input<string | string[] | undefined>(undefined, { alias: 'nodeId' });
  readonly position = input<Position>(Position.Top);
  readonly isVisible = input<boolean>();
  readonly offset = input(10);
  readonly align = input<'start' | 'center' | 'end'>('center');

  private contextNodeId: string = '';

  constructor(@Optional() @Inject(NODE_ID) nodeId: string | null) {
    this.contextNodeId = nodeId ?? '';
  }

  private readonly resolvedNodeIds = computed((): string[] => {
    const inputId = this.nodeIdInput();
    if (inputId !== undefined) {
      return Array.isArray(inputId) ? inputId : [inputId];
    }
    return this.contextNodeId ? [this.contextNodeId] : [];
  });

  readonly shouldShow = computed(() => {
    if (this.isVisible() !== undefined) return this.isVisible()!;
    const ids = this.resolvedNodeIds();
    return ids.some(id => {
      const node = this.store.nodeLookup.get(id);
      return node?.selected ?? false;
    });
  });

  readonly toolbarTransform = computed(() => {
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

    let alignTranslate: string;
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

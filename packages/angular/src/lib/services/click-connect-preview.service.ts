import { Injectable, DestroyRef, effect, inject, untracked } from '@angular/core';
import { XYHandle, type HandleType, type IsValidConnection } from '@angflow/system';
import { FlowStore } from './flow-store.service';

type ArmedHandle = { nodeId: string; handleId: string | null; type: HandleType };

/**
 * Draws the click-to-connect preview line: while a handle is "armed" (the first
 * click of a click-to-connect, tracked by {@link FlowStore.connectionClickStartHandle}),
 * a line follows the cursor from that handle — snapping to the nearest handle and
 * coloring valid/invalid, identical to the drag preview.
 *
 * Provided by `<ng-flow>`; instantiated for its side effects (there is no public
 * API). It reacts to `connectionClickStartHandle` via an `effect`, driving the
 * existing connection-line renderer through `FlowStore.connection()`.
 *
 * Teardown is explicit and pointer-family: the single document `pointermove`
 * listener is removed the instant the handle disarms (completion, Escape, pane
 * click, right-click, re-click) or the flow is destroyed — the lesson from the
 * phantom-connection bug (`@angflow/system` 0.1.9).
 */
@Injectable()
export class ClickConnectPreview {
  private readonly store = inject(FlowStore);
  private readonly destroyRef = inject(DestroyRef);
  private moveListener: ((event: PointerEvent) => void) | null = null;

  constructor() {
    effect(() => {
      const armed = this.store.connectionClickStartHandle();
      const enabled = this.store.connectOnClick();
      untracked(() => {
        if (armed && enabled) {
          this.attach(armed);
        } else {
          this.detach();
        }
      });
    });

    this.destroyRef.onDestroy(() => this.detach());
  }

  private doc(): Document {
    return this.store.domNode()?.ownerDocument ?? document;
  }

  private attach(armed: ArmedHandle): void {
    if (this.moveListener) return;
    const listener = (event: PointerEvent) => this.update(event, armed);
    this.moveListener = listener;
    this.doc().addEventListener('pointermove', listener as EventListener);
  }

  private detach(): void {
    if (!this.moveListener) return;
    this.doc().removeEventListener('pointermove', this.moveListener as EventListener);
    this.moveListener = null;
    // Clear the preview line. Guard so we don't stomp a real drag connection
    // (a drag can't be in progress while a click-connect is armed, but be safe).
    if (this.store.connection().inProgress) {
      this.store.cancelConnection();
    }
  }

  private update(event: PointerEvent, armed: ArmedHandle): void {
    const store = this.store;
    const state = XYHandle.getClickConnectionState(event, {
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: armed.handleId,
      nodeId: armed.nodeId,
      isTarget: armed.type === 'target',
      nodeLookup: store.nodeLookup,
      lib: store.lib(),
      flowId: store.rfId(),
      isValidConnection: store.isValidConnection() as unknown as IsValidConnection | undefined,
      getTransform: () => store.transform(),
      isNodeVisible: (node) => !store.collapsedHiddenIds().has(node.id),
    });

    if (state) {
      store.updateConnection(state);
    }
  }
}

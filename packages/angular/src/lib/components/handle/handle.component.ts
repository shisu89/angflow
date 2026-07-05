import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  effect,
  ElementRef,
  OnDestroy,
  Optional,
  Inject,
} from '@angular/core';
import {
  Position,
  XYHandle,
  getHostForElement,
  type HandleType,
  type Connection,
  type ConnectionState,
  type IsValidConnection,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

/**
 * Connection point rendered inside a node. A node can have any number of
 * handles; edges are drawn from a `source` handle to a `target` handle.
 *
 * @example
 * ```html
 * <ng-flow-handle type="source" [position]="Position.Right" />
 * <ng-flow-handle type="target" id="in" [position]="Position.Left" />
 * ```
 */
@Component({
  selector: 'ng-flow-handle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // `nodrag`/`nopan` keep a handle interaction from also starting a node drag
    // or a pane pan (parity with React Flow's Handle). d3-drag/d3-zoom bind
    // `mousedown`, but the handle's connection trigger is `pointerdown` and only
    // stops propagation of that — the separate `mousedown` still bubbles to the
    // node's d3-drag, so grabbing a handle would drag the whole node. These
    // classes make the d3 filters reject the gesture regardless of event family.
    'class': 'ng-flow__handle xy-flow__handle nodrag nopan',
    '[class.xy-flow__handle-top]': 'position() === Position.Top',
    '[class.xy-flow__handle-bottom]': 'position() === Position.Bottom',
    '[class.xy-flow__handle-left]': 'position() === Position.Left',
    '[class.xy-flow__handle-right]': 'position() === Position.Right',
    '[class.source]': 'type() === "source"',
    '[class.target]': 'type() === "target"',
    '[class.connectionindicator]': 'showConnectionIndicator()',
    '[class.connectable]': 'effectiveConnectable()',
    '[class.connectablestart]': 'effectiveConnectableStart()',
    '[class.connectableend]': 'effectiveConnectableEnd()',
    '[class.connectingfrom]': 'connectingFrom()',
    '[class.connectingto]': 'connectingTo()',
    '[class.valid]': 'connectionValid()',
    '[attr.data-handleid]': 'handleId()',
    '[attr.data-nodeid]': 'nodeId',
    '[attr.data-handlepos]': 'position()',
    '[attr.data-floating]': 'floating() ? "" : null',
    '[attr.data-id]': 'dataId()',
    '[attr.aria-describedby]': 'store.rfId() + "-handle-desc"',
    '(pointerdown)': 'onPointerDown($event)',
    '(click)': 'onClick($event)',
  },
  template: `<ng-content />`,
})
export class HandleComponent implements OnDestroy {
  readonly Position = Position;

  /** `'source'` or `'target'` — determines which side of an edge this handle connects. */
  readonly type = input.required<HandleType>();
  /** Which edge of the host node the handle sits on (`Top`, `Right`, `Bottom`, `Left`). */
  readonly position = input<Position>(Position.Top);
  /** Optional handle id; required only when a node has multiple handles of the same type. Aliased as `id`. */
  readonly handleId = input<string | null>(null, { alias: 'id' });
  /** Whether this handle can participate in connections at all. */
  readonly isConnectable = input(true);
  /** Whether the user may start a new connection from this handle. */
  readonly isConnectableStart = input(true);
  /** Whether the user may finish a new connection on this handle. */
  readonly isConnectableEnd = input(true);
  /** Per-handle validator called with the proposed `Connection`. Overrides the flow-level `isValidConnection`. */
  readonly isValidConnection = input<((connection: Connection) => boolean) | undefined>(undefined);
  /** Arbitrary data attached to this handle (look up with `NgFlowService.getHandleData`). */
  readonly data = input<unknown>(undefined);
  readonly floating = input(false);

  /** Emitted when a connection is completed on this handle. */
  readonly handleConnect = output<Connection>({ alias: 'onConnect' });

  readonly store = inject(FlowStore);
  private readonly el = inject(ElementRef<HTMLElement>);

  // Injected from parent NodeWrapperComponent
  nodeId: string = '';

  // data-id attribute used by XYHandle to find handles in the DOM
  readonly dataId = computed(() => `${this.store.rfId()}-${this.nodeId}-${this.handleId()}-${this.type()}`);

  /**
   * Effective connectable state — the per-handle `isConnectable` input ANDed with
   * the node's own `connectable` override (falling back to the flow-level
   * `nodesConnectable`, which the Controls lock button toggles). Without this the
   * lock button and `node.connectable` would have no effect on user-authored
   * handles, and `XYHandle` validity — which reads the `.connectable*` classes —
   * would allow connections the flow means to forbid.
   */
  private readonly nodeConnectable = computed(() => {
    this.store.version(); // track node updates so a changed override re-evaluates
    const node = this.store.nodeLookup.get(this.nodeId);
    return node?.connectable ?? this.store.nodesConnectable();
  });
  readonly effectiveConnectable = computed(() => this.isConnectable() && this.nodeConnectable());
  readonly effectiveConnectableStart = computed(() => this.effectiveConnectable() && this.isConnectableStart());
  readonly effectiveConnectableEnd = computed(() => this.effectiveConnectable() && this.isConnectableEnd());

  /**
   * `connectionindicator` gates pointer-events + the crosshair cursor in CSS. It
   * must reflect whether the handle is usable *right now*: as a start when idle,
   * or as an end while a connection is in progress. Previously hardcoded `true`,
   * which left disabled handles interactive.
   */
  readonly showConnectionIndicator = computed(() => {
    const conn = this.store.connection();
    return this.effectiveConnectable() && (conn.inProgress ? this.effectiveConnectableEnd() : this.effectiveConnectableStart());
  });

  // Per-handle connection feedback classes (shipped CSS targets these).
  readonly connectingFrom = computed(() => {
    const conn = this.store.connection();
    if (!conn.inProgress) return false;
    const f = conn.fromHandle;
    return f.nodeId === this.nodeId && (f.id ?? null) === this.handleId() && f.type === this.type();
  });
  readonly connectingTo = computed(() => {
    const conn = this.store.connection();
    if (!conn.inProgress || !conn.toHandle) return false;
    const t = conn.toHandle;
    return t.nodeId === this.nodeId && (t.id ?? null) === this.handleId() && t.type === this.type();
  });
  readonly connectionValid = computed(() => {
    const conn = this.store.connection();
    return this.connectingTo() && conn.inProgress && conn.isValid === true;
  });

  private isRegistered = false;
  private prevKey: { nodeId: string; handleId: string | null; type: HandleType } | null = null;

  constructor(@Optional() @Inject(NODE_ID) nodeId: string | null) {
    this.nodeId = nodeId ?? '';

    effect(() => {
      const d = this.data();
      const handleId = this.handleId();
      const type = this.type();
      // Re-keying (id/type changed): drop the stale entry first, otherwise it
      // lingers in the store registry forever.
      if (this.prevKey && (this.prevKey.handleId !== handleId || this.prevKey.type !== type)) {
        this.store.unregisterHandleData(this.prevKey.nodeId, this.prevKey.handleId, this.prevKey.type);
      }
      this.store.registerHandleData(this.nodeId, handleId, type, d);
      this.prevKey = { nodeId: this.nodeId, handleId, type };
      this.isRegistered = true;
    });
  }

  ngOnDestroy(): void {
    // Guard: the effect may never have run if inputs were not resolved before
    // destroy (happens in some test lifecycles). In production, Angular's
    // required-input check would error before reaching this path.
    if (!this.isRegistered) return;
    this.store.unregisterHandleData(this.nodeId, this.handleId(), this.type());
  }

  onPointerDown(event: MouseEvent | PointerEvent): void {
    if (!this.effectiveConnectableStart()) return;
    // Only left mouse button starts a connection (parity with React). Touch/pen
    // pointers report button 0 too, so gate on pointerType.
    if ('pointerType' in event && event.pointerType === 'mouse' && event.button !== 0) return;

    // Stop propagation to prevent d3-drag on the parent node from capturing this event
    event.stopPropagation();

    const isTarget = this.type() === 'target';
    const store = this.store;

    // Use per-handle isValidConnection if provided, otherwise fall back to store-level
    const handleValidation = this.isValidConnection();
    const storeValidation = store.isValidConnection();
    const validationFn = handleValidation ?? storeValidation;

    XYHandle.onPointerDown(event, {
      autoPanOnConnect: store.autoPanOnConnect(),
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: this.handleId(),
      nodeId: this.nodeId,
      isTarget,
      nodeLookup: store.nodeLookup,
      lib: 'ng',
      flowId: store.rfId(),
      updateConnection: (connection: ConnectionState) => store.updateConnection(connection),
      panBy: (delta: { x: number; y: number }) => store.panBy(delta),
      cancelConnection: () => store.cancelConnection(),
      onConnect: (connection: Connection) => {
        this.handleConnect.emit(connection);
        store.onConnect?.(connection);
      },
      onConnectStart: (event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: HandleType | null }) => store.onConnectStart?.(event, params),
      onConnectEnd: (event: MouseEvent | TouchEvent) => store.onConnectEnd?.(event),
      onConnectionTargetChange: (nodeId: string | null) => {
        store.connectionTargetNodeId.set(nodeId);
      },
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      // Honor the configured drag threshold (default 1). A literal 0 started a
      // connection synchronously on every pointerdown — flashing the connection
      // line, spamming onConnectStart/End, and turning a slightly-drifted click
      // into a surprise connection (especially on touch).
      dragThreshold: store.connectionDragThreshold(),
      handleDomNode: this.el.nativeElement,
      // Variance-forced: validator is declared (NodeType|Connection)=>boolean but the
      // system only ever calls it with a Connection; contravariance blocks a direct assign.
      isValidConnection: validationFn as unknown as IsValidConnection,
      isNodeVisible: (n: { id: string }) => !store.collapsedHiddenIds().has(n.id),
    });
  }

  onClick(event: MouseEvent): void {
    const store = this.store;
    if (!store.connectOnClick()) return;

    const startHandle = store.connectionClickStartHandle();

    // To open a click-connect, this handle must be usable as a start.
    // Once a start handle is recorded we no longer gate here — completion is
    // validated via XYHandle.isValid below, which checks the target's
    // `.connectable` / `.connectableend` classes (driven by isConnectable /
    // isConnectableEnd inputs).
    if (!startHandle && !this.effectiveConnectableStart()) return;

    if (!startHandle) {
      // First click — store this handle as the start of the connection
      store.connectionClickStartHandle.set({
        nodeId: this.nodeId,
        handleId: this.handleId(),
        type: this.type(),
      });
      store.onClickConnectStart?.(event, {
        nodeId: this.nodeId,
        handleId: this.handleId(),
        handleType: this.type(),
      });
      store.onConnectStart?.(event, {
        nodeId: this.nodeId,
        handleId: this.handleId(),
        handleType: this.type(),
      });
    } else if (
      startHandle.nodeId === this.nodeId &&
      (startHandle.handleId ?? null) === this.handleId() &&
      startHandle.type === this.type()
    ) {
      // Re-clicking the armed handle disarms it (cancels the pending
      // click-to-connect and its preview line) instead of self-connecting.
      store.connectionClickStartHandle.set(null);
      store.onClickConnectEnd?.(event);
      store.onConnectEnd?.(event);
    } else {
      // Second click — validate target handle via XYHandle.isValid, which
      // inspects the handle's CSS classes (`connectable`, `connectableend`)
      // and the connection mode, then runs the user validator.
      const handleValidation = this.isValidConnection();
      const storeValidation = store.isValidConnection();
      const validationFn = handleValidation ?? storeValidation;

      const doc = getHostForElement(event.target);
      const { connection, isValid } = XYHandle.isValid(event, {
        handle: { nodeId: this.nodeId, id: this.handleId(), type: this.type() },
        connectionMode: store.connectionMode(),
        fromNodeId: startHandle.nodeId,
        fromHandleId: startHandle.handleId ?? null,
        fromType: startHandle.type,
        isValidConnection: validationFn as IsValidConnection | undefined,
        doc,
        lib: store.lib(),
        flowId: store.rfId(),
        nodeLookup: store.nodeLookup,
      });

      if (isValid && connection) {
        this.handleConnect.emit(connection);
        store.onConnect?.(connection);
      }

      store.connectionClickStartHandle.set(null);
      store.onClickConnectEnd?.(event);
      store.onConnectEnd?.(event);
    }
  }
}

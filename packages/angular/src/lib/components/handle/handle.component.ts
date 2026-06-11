import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  effect,
  ElementRef,
  OnInit,
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
    'class': 'ng-flow__handle xy-flow__handle',
    '[class.xy-flow__handle-top]': 'position() === Position.Top',
    '[class.xy-flow__handle-bottom]': 'position() === Position.Bottom',
    '[class.xy-flow__handle-left]': 'position() === Position.Left',
    '[class.xy-flow__handle-right]': 'position() === Position.Right',
    '[class.source]': 'type() === "source"',
    '[class.target]': 'type() === "target"',
    '[class.connectionindicator]': 'true',
    '[class.connectable]': 'isConnectable()',
    '[class.connectablestart]': 'isConnectableStart()',
    '[class.connectableend]': 'isConnectableEnd()',
    '[attr.data-handleid]': 'handleId()',
    '[attr.data-nodeid]': 'nodeId',
    '[attr.data-handlepos]': 'position()',
    '[attr.data-floating]': 'floating() ? "" : null',
    '[attr.data-id]': 'dataId()',
    '[attr.aria-describedby]': 'store.rfId() + "-handle-desc"',
    '(mousedown)': 'onPointerDown($event)',
    '(click)': 'onClick($event)',
  },
  template: `<ng-content />`,
})
export class HandleComponent implements OnInit, OnDestroy {
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

  ngOnInit(): void {}

  ngOnDestroy(): void {
    // Guard: the effect may never have run if inputs were not resolved before
    // destroy (happens in some test lifecycles). In production, Angular's
    // required-input check would error before reaching this path.
    if (!this.isRegistered) return;
    this.store.unregisterHandleData(this.nodeId, this.handleId(), this.type());
  }

  onPointerDown(event: MouseEvent | PointerEvent): void {
    if (!this.isConnectableStart()) return;

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
      dragThreshold: 0,
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
    if (!startHandle && !this.isConnectableStart()) return;

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

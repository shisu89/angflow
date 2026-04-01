import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  ElementRef,
  OnInit,
  OnDestroy,
  Optional,
  Inject,
} from '@angular/core';
import { Position, XYHandle, type HandleType, type Connection, type ConnectionState } from '@ngflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';

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
    '[attr.data-id]': 'dataId()',
    '(mousedown)': 'onPointerDown($event)',
    '(click)': 'onClick($event)',
  },
  template: `<ng-content />`,
})
export class HandleComponent implements OnInit, OnDestroy {
  readonly Position = Position;

  readonly type = input.required<HandleType>();
  readonly position = input<Position>(Position.Top);
  readonly handleId = input<string | null>(null, { alias: 'id' });
  readonly isConnectable = input(true);
  readonly isConnectableStart = input(true);
  readonly isConnectableEnd = input(true);
  readonly isValidConnection = input<((connection: Connection) => boolean) | undefined>(undefined);

  /** Emitted when a connection is completed on this handle. */
  readonly handleConnect = output<Connection>({ alias: 'onConnect' });

  readonly store = inject(FlowStore);
  private readonly el = inject(ElementRef<HTMLElement>);

  // Injected from parent NodeWrapperComponent
  nodeId: string = '';

  // data-id attribute used by XYHandle to find handles in the DOM
  readonly dataId = computed(() => `${this.store.rfId()}-${this.nodeId}-${this.handleId()}-${this.type()}`);

  constructor(@Optional() @Inject(NODE_ID) nodeId: string | null) {
    this.nodeId = nodeId ?? '';
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {}

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
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: 0,
      handleDomNode: this.el.nativeElement,
      isValidConnection: validationFn,
    } as any);
  }

  onClick(event: MouseEvent): void {
    const store = this.store;
    if (!store.connectOnClick()) return;

    const startHandle = store.connectionClickStartHandle();

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
      // Second click — complete the connection
      const isSource = startHandle.type === 'source';
      const connection = {
        source: isSource ? startHandle.nodeId : this.nodeId,
        sourceHandle: isSource ? startHandle.handleId : this.handleId(),
        target: isSource ? this.nodeId : startHandle.nodeId,
        targetHandle: isSource ? this.handleId() : startHandle.handleId,
      };

      // Validate using per-handle or store-level validation
      const handleValidation = this.isValidConnection();
      const storeValidation = store.isValidConnection();
      const validationFn = handleValidation ?? storeValidation;

      if (!validationFn || validationFn(connection as Connection)) {
        this.handleConnect.emit(connection as Connection);
        store.onConnect?.(connection);
      }

      store.connectionClickStartHandle.set(null);
      store.onClickConnectEnd?.(event);
      store.onConnectEnd?.(event);
    }
  }
}

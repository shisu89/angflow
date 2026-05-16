import { Injectable, inject, computed, signal, DestroyRef, type Signal } from '@angular/core';
import {
  pointToRendererPoint,
  rendererPointToPoint,
  getNodesBounds as getNodesBoundsSystem,
  getConnectedEdges as getConnectedEdgesSystem,
  getOutgoers as getOutgoersSystem,
  getIncomers as getIncomersSystem,
  getViewportForBounds,
  type XYPosition,
  type SnapGrid,
  type Viewport,
  type Rect,
  type FitViewOptionsBase,
  type HandleConnection,
  type ConnectionState,
  type NodeBase,
  type EdgeBase,
  type InternalNodeUpdate,
  type HandleType,
  type NodeChange,
  type EdgeChange,
} from '@angflow/system';

import { FlowStore } from './flow-store.service';
import type { Node, Edge, InternalNode, NgFlowInstance, NgFlowJsonObject, DeleteElementsOptions } from '../types';

/**
 * Imperative API for controlling a flow instance: zoom, pan, fit-view,
 * coordinate conversion, node/edge CRUD, spatial queries, and signal-based
 * state access. Provided by `<ng-flow>` and `<ng-flow-provider>`; inject into
 * any descendant with `inject(NgFlowService)`.
 *
 * @example
 * ```typescript
 * private flow = inject(NgFlowService);
 *
 * zoomToFit() { this.flow.fitView({ padding: 0.2 }); }
 * addNode(n: Node) { this.flow.addNodes(n); }
 * ```
 */
@Injectable()
export class NgFlowService<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  private store = inject(FlowStore) as unknown as FlowStore<NodeType, EdgeType>;
  private destroyRef = inject(DestroyRef);

  // ── Reactive signal properties ────────────────────────────────────────
  // Read-only signals for reactive state access in templates and computed signals.
  // These are the Angular equivalent of React's useNodes(), useEdges(), etc.

  /** Reactive access to all nodes. */
  readonly nodes: Signal<NodeType[]> = computed(() => this.store.nodes());

  /** Reactive access to all edges. */
  readonly edges: Signal<EdgeType[]> = computed(() => this.store.edges());

  /** Reactive access to the current viewport (x, y, zoom). */
  readonly viewport: Signal<Viewport> = computed(() => this.store.viewport());

  /** Reactive access to currently selected nodes. */
  readonly selectedNodes: Signal<NodeType[]> = computed(() => this.store.selectedNodes());

  /** Reactive access to currently selected edges. */
  readonly selectedEdges: Signal<EdgeType[]> = computed(() => this.store.selectedEdges());

  /** Reactive access to the current connection state during drag-connect. Null when idle. */
  readonly connection: Signal<ConnectionState> = computed(() => this.store.connection());

  /** Reactive signal indicating whether all nodes have been measured and positioned. */
  readonly nodesInitialized: Signal<boolean> = computed(() => this.store.nodesInitialized());

  /** Reactive access to currently visible nodes (respects onlyRenderVisibleElements). */
  readonly visibleNodes: Signal<import('@angflow/system').InternalNodeBase<NodeType>[]> = computed(() => this.store.visibleNodes());

  /** Reactive access to IDs of currently visible edges (respects onlyRenderVisibleElements). */
  readonly visibleEdgeIds: Signal<Set<string>> = computed(() => this.store.visibleEdgeIds());

  // ── Viewport operations ───────────────────────────────────────────────

  /** Zoom the viewport in by one step. Optionally animate over `duration` ms. */
  zoomIn(options?: { duration?: number }) {
    return this.store.zoomIn(options);
  }

  /** Zoom the viewport out by one step. Optionally animate over `duration` ms. */
  zoomOut(options?: { duration?: number }) {
    return this.store.zoomOut(options);
  }

  /** Set the viewport zoom to an absolute level (clamped to `minZoom`/`maxZoom`). */
  zoomTo(zoomLevel: number, options?: { duration?: number }) {
    return this.store.zoomTo(zoomLevel, options);
  }

  /**
   * Zoom and pan so all nodes (or `options.nodes`) fit in the canvas.
   * Respects `minZoom`, `maxZoom`, and `padding`.
   */
  fitView(options?: FitViewOptionsBase<NodeType>) {
    return this.store.fitView(options);
  }

  /** Set the viewport to an absolute `{ x, y, zoom }`. */
  setViewport(viewport: Viewport, options?: { duration?: number }) {
    return this.store.setViewport(viewport, options);
  }

  /** Get the current viewport `{ x, y, zoom }`. Non-reactive — prefer the `viewport` signal in templates. */
  getViewport(): Viewport {
    return this.store.viewport();
  }

  /** Get the current zoom level. Non-reactive. */
  getZoom(): number {
    return this.store.transform()[2];
  }

  /** Center the viewport on a flow-space coordinate. */
  setCenter(x: number, y: number, options?: { zoom?: number; duration?: number }) {
    return this.store.setCenter(x, y, options);
  }

  /** Fit the viewport to a specific `Rect` in flow coordinates. Resolves `false` if pan/zoom isn't yet initialized. */
  async fitBounds(bounds: Rect, options?: { padding?: number; duration?: number }): Promise<boolean> {
    const pz = this.store.panZoom();
    if (!pz) return false;

    const { x, y, zoom } = this.getViewportForBoundsInternal(bounds, options?.padding ?? 0.1);
    await pz.setViewport({ x, y, zoom }, { duration: options?.duration });
    return true;
  }

  // ── Coordinate Conversion ─────────────────────────────────────────────

  /**
   * Convert a viewport/client coordinate (e.g. a `MouseEvent`'s `clientX`/`clientY`)
   * into a position in flow coordinates. Useful when dropping from a palette.
   * Honors `snapToGrid` unless explicitly overridden via `options`.
   */
  screenToFlowPosition(clientPosition: XYPosition, options?: { snapToGrid?: boolean; snapGrid?: SnapGrid }): XYPosition {
    const domNode = this.store.domNode();
    if (!domNode) return clientPosition;

    const { x: domX, y: domY } = domNode.getBoundingClientRect();
    const correctedPosition = {
      x: clientPosition.x - domX,
      y: clientPosition.y - domY,
    };

    return pointToRendererPoint(
      correctedPosition,
      this.store.transform(),
      options?.snapToGrid ?? this.store.snapToGrid(),
      options?.snapGrid ?? this.store.snapGrid()
    );
  }

  /** Inverse of {@link screenToFlowPosition}: convert a flow-space point to viewport/client coordinates. */
  flowToScreenPosition(flowPosition: XYPosition): XYPosition {
    const domNode = this.store.domNode();
    if (!domNode) return flowPosition;

    const { x: domX, y: domY } = domNode.getBoundingClientRect();
    const rendered = rendererPointToPoint(flowPosition, this.store.transform());

    return {
      x: rendered.x + domX,
      y: rendered.y + domY,
    };
  }

  // ── Node Operations ───────────────────────────────────────────────────

  /** Look up the user-facing `Node` object by id. Returns `undefined` if it doesn't exist. */
  getNode(id: string): NodeType | undefined {
    return this.store.nodeLookup.get(id)?.internals?.userNode as NodeType | undefined;
  }

  /** Return all nodes, or just those with matching ids when `ids` is provided. */
  getNodes(ids?: string[]): NodeType[] {
    if (ids) {
      return ids
        .map((id) => this.getNode(id))
        .filter((n): n is NodeType => n !== undefined);
    }
    return this.store.nodes();
  }

  /**
   * Look up the internal node record, which includes computed fields like
   * `positionAbsolute`, `measured`, and handle bounds. Prefer {@link getNode}
   * for user-facing data.
   */
  getInternalNode(id: string): InternalNode<NodeType> | undefined {
    return this.store.nodeLookup.get(id) as InternalNode<NodeType> | undefined;
  }

  /** Replace the full `nodes` array. Triggers `(nodesChange)` through the store. */
  setNodes(nodes: NodeType[]): void {
    this.store.setNodes(nodes);
  }

  /** Append one or more nodes to the current array. */
  addNodes(nodes: NodeType | NodeType[]): void {
    const toAdd = Array.isArray(nodes) ? nodes : [nodes];
    if (!toAdd.length) return;
    const changes: NodeChange<NodeType>[] = toAdd.map((item) => ({ type: 'add', item }));
    this.store.triggerNodeChanges(changes);
  }

  /**
   * Apply a shallow merge (or updater function result) to a single node.
   * Other nodes are left untouched.
   */
  updateNode(id: string, nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>)): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    const update = typeof nodeUpdate === 'function' ? nodeUpdate(current) : nodeUpdate;
    const next = { ...current, ...update } as NodeType;
    this.store.triggerNodeChanges([{ id, type: 'replace', item: next }]);
  }

  /**
   * Merge `dataUpdate` into a node's `data` object. Equivalent to
   * `updateNode(id, n => ({ data: { ...n.data, ...dataUpdate } }))`.
   */
  updateNodeData(id: string, dataUpdate: Record<string, unknown> | ((data: NodeType['data']) => Record<string, unknown>)): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    const update = typeof dataUpdate === 'function' ? dataUpdate(current.data) : dataUpdate;
    const next = { ...current, data: { ...current.data, ...update } } as NodeType;
    this.store.triggerNodeChanges([{ id, type: 'replace', item: next }]);
  }

  // ── Edge Operations ───────────────────────────────────────────────────

  /** Look up an edge by id. */
  getEdge(id: string): EdgeType | undefined {
    return this.store.edgeLookup.get(id) as EdgeType | undefined;
  }

  /** Return the current edges array. */
  getEdges(): EdgeType[] {
    return this.store.edges();
  }

  /** Replace the full `edges` array. */
  setEdges(edges: EdgeType[]): void {
    this.store.setEdges(edges);
  }

  /** Append one or more edges to the current array. */
  addEdges(edges: EdgeType | EdgeType[]): void {
    const toAdd = Array.isArray(edges) ? edges : [edges];
    if (!toAdd.length) return;
    const changes: EdgeChange<EdgeType>[] = toAdd.map((item) => ({ type: 'add', item }));
    this.store.triggerEdgeChanges(changes);
  }

  /** Apply a shallow merge (or updater function) to a single edge. */
  updateEdge(id: string, edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>)): void {
    const current = this.store.edges().find((e) => e.id === id);
    if (!current) return;
    const update = typeof edgeUpdate === 'function' ? edgeUpdate(current) : edgeUpdate;
    const next = { ...current, ...update } as EdgeType;
    this.store.triggerEdgeChanges([{ id, type: 'replace', item: next }]);
  }

  /** Merge `dataUpdate` into a single edge's `data` object. */
  updateEdgeData(id: string, dataUpdate: Record<string, unknown> | ((data: EdgeType['data']) => Record<string, unknown>)): void {
    const current = this.store.edges().find((e) => e.id === id);
    if (!current) return;
    const update = typeof dataUpdate === 'function' ? dataUpdate(current.data) : dataUpdate;
    const next = { ...current, data: { ...current.data, ...update } } as EdgeType;
    this.store.triggerEdgeChanges([{ id, type: 'replace', item: next }]);
  }

  // ── Batch ─────────────────────────────────────────────────────────────

  /**
   * Coalesce multiple setNodes/setEdges calls into a single reactivity cycle.
   * Prevents intermediate renders when updating both nodes and edges together.
   */
  batch(fn: () => void): void {
    this.store.batch(fn);
  }

  // ── Delete ────────────────────────────────────────────────────────────

  /**
   * Delete the specified nodes and/or edges. Edges connected to deleted nodes
   * are also removed. If an `onBeforeDelete` hook is set, it runs first and
   * can veto the deletion.
   *
   * @returns The nodes and edges that were actually deleted (empty arrays if
   *          `onBeforeDelete` returned `false`).
   */
  async deleteElements(params: DeleteElementsOptions): Promise<{ deletedNodes: NodeType[]; deletedEdges: EdgeType[] }> {
    const nodeIdsToDelete = new Set((params.nodes ?? []).map((n) => n.id));
    const edgeIdsToDelete = new Set((params.edges ?? []).map((e) => e.id));

    // Also delete edges connected to deleted nodes
    for (const edge of this.store.edges()) {
      if (nodeIdsToDelete.has(edge.source) || nodeIdsToDelete.has(edge.target)) {
        edgeIdsToDelete.add(edge.id);
      }
    }

    const nodesToDelete = this.store.nodes().filter((n) => nodeIdsToDelete.has(n.id));
    const edgesToDelete = this.store.edges().filter((e) => edgeIdsToDelete.has(e.id));

    // Check onBeforeDelete callback
    if (this.store.onBeforeDelete && (nodesToDelete.length > 0 || edgesToDelete.length > 0)) {
      const shouldDelete = await this.store.onBeforeDelete({ nodes: nodesToDelete, edges: edgesToDelete });
      if (!shouldDelete) {
        return { deletedNodes: [], deletedEdges: [] };
      }
    }

    if (nodeIdsToDelete.size > 0) {
      this.store.setNodes(this.store.nodes().filter((n) => !nodeIdsToDelete.has(n.id)));
    }
    if (edgeIdsToDelete.size > 0) {
      this.store.setEdges(this.store.edges().filter((e) => !edgeIdsToDelete.has(e.id)));
    }

    return { deletedNodes: nodesToDelete, deletedEdges: edgesToDelete };
  }

  // ── Spatial Queries ───────────────────────────────────────────────────

  /**
   * Return all nodes whose bounding box overlaps `node`'s bounding box.
   *
   * @param partially When `true` (default), nodes that merely overlap count;
   *   when `false`, only nodes fully contained within `node` are returned.
   */
  getIntersectingNodes(node: NodeType, partially = true): NodeType[] {
    const internalNode = this.store.nodeLookup.get(node.id);
    if (!internalNode) return [];

    const nodeRect = {
      x: internalNode.internals?.positionAbsolute?.x ?? node.position.x,
      y: internalNode.internals?.positionAbsolute?.y ?? node.position.y,
      width: internalNode.measured?.width ?? node.width ?? 0,
      height: internalNode.measured?.height ?? node.height ?? 0,
    };

    return this.store.nodes().filter((n) => {
      if (n.id === node.id) return false;
      const otherNode = this.store.nodeLookup.get(n.id);
      if (!otherNode) return false;

      const otherRect = {
        x: otherNode.internals?.positionAbsolute?.x ?? n.position.x,
        y: otherNode.internals?.positionAbsolute?.y ?? n.position.y,
        width: otherNode.measured?.width ?? n.width ?? 0,
        height: otherNode.measured?.height ?? n.height ?? 0,
      };

      if (partially) {
        return !(nodeRect.x + nodeRect.width < otherRect.x ||
                 otherRect.x + otherRect.width < nodeRect.x ||
                 nodeRect.y + nodeRect.height < otherRect.y ||
                 otherRect.y + otherRect.height < nodeRect.y);
      }
      return nodeRect.x <= otherRect.x &&
             nodeRect.y <= otherRect.y &&
             nodeRect.x + nodeRect.width >= otherRect.x + otherRect.width &&
             nodeRect.y + nodeRect.height >= otherRect.y + otherRect.height;
    });
  }

  /**
   * Whether `node`'s bounding box intersects `area`. `partially` has the
   * same semantics as {@link getIntersectingNodes}.
   */
  isNodeIntersecting(node: NodeType, area: Rect, partially = true): boolean {
    const internalNode = this.store.nodeLookup.get(node.id);
    if (!internalNode) return false;

    const nodeRect = {
      x: internalNode.internals?.positionAbsolute?.x ?? node.position.x,
      y: internalNode.internals?.positionAbsolute?.y ?? node.position.y,
      width: internalNode.measured?.width ?? node.width ?? 0,
      height: internalNode.measured?.height ?? node.height ?? 0,
    };

    if (partially) {
      return !(nodeRect.x + nodeRect.width < area.x ||
               area.x + area.width < nodeRect.x ||
               nodeRect.y + nodeRect.height < area.y ||
               area.y + area.height < nodeRect.y);
    }
    return area.x <= nodeRect.x &&
           area.y <= nodeRect.y &&
           area.x + area.width >= nodeRect.x + nodeRect.width &&
           area.y + area.height >= nodeRect.y + nodeRect.height;
  }

  /** Compute the axis-aligned bounding `Rect` that contains all given nodes. */
  getNodesBounds(nodes: NodeType[]): Rect {
    return getNodesBoundsSystem(nodes, { nodeOrigin: this.store.nodeOrigin() });
  }

  // ── Connection Queries ────────────────────────────────────────────────

  /** Return all edges that are incident to any of the given node ids (either end). */
  getConnectedEdges(nodeIds: string | string[]): EdgeType[] {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    // getConnectedEdges expects node objects, but we pass IDs and edges
    const nodeObjects = ids.map(id => ({ id })) as NodeBase[];
    return getConnectedEdgesSystem(nodeObjects, this.store.edges() as EdgeBase[]) as unknown as EdgeType[];
  }

  /** Return all `HandleConnection`s currently attached to a specific handle. */
  getHandleConnections(params: { nodeId: string; type: 'source' | 'target'; id?: string }): HandleConnection[] {
    // The connectionLookup is keyed by composite keys: nodeId, nodeId-type, nodeId-type-handleId
    const lookupKey = params.id
      ? `${params.nodeId}-${params.type}-${params.id}`
      : `${params.nodeId}-${params.type}`;
    const connections = this.store.connectionLookup.get(lookupKey);
    if (!connections) return [];
    return Array.from(connections.values());
  }

  /** Return all `HandleConnection`s for every handle on a node. */
  getNodeConnections(nodeId: string): HandleConnection[] {
    const nodeConnections = this.store.connectionLookup.get(nodeId);
    if (!nodeConnections) return [];
    return Array.from(nodeConnections.values());
  }

  // ── Serialization ─────────────────────────────────────────────────────

  /**
   * Snapshot of `{ nodes, edges, viewport }` suitable for persistence.
   * Feed the result back into `[nodes]` / `[edges]` / `[viewport]` bindings
   * (or `setNodes` / `setEdges` / `setViewport`) to restore.
   */
  toObject() {
    return {
      nodes: this.store.nodes(),
      edges: this.store.edges(),
      viewport: this.store.viewport(),
    };
  }

  // ── Signal-based queries (Angular equivalents of React hooks) ──────

  /**
   * Returns a signal containing the data for specific node(s).
   * Equivalent to React's `useNodesData()`.
   */
  selectNodesData(nodeIds: string | string[]): Signal<{ id: string; data: Record<string, unknown>; type?: string }[]> {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    return computed(() => {
      this.store.version();
      return ids
        .map(id => {
          const node = this.store.nodeLookup.get(id);
          const userNode = node?.internals?.userNode as NodeType | undefined;
          if (!userNode) return null;
          return { id: userNode.id, data: userNode.data as Record<string, unknown>, type: userNode.type };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null);
    });
  }

  /**
   * Returns a signal containing all connections for a node.
   * Equivalent to React's `useNodeConnections()`.
   */
  selectNodeConnections(nodeId: string): Signal<HandleConnection[]> {
    return computed(() => {
      this.store.version();
      const nodeConnections = this.store.connectionLookup.get(nodeId);
      if (!nodeConnections) return [];
      return Array.from(nodeConnections.values());
    });
  }

  /**
   * Returns a signal containing connections for a specific handle.
   * Equivalent to React's `useHandleConnections()`.
   */
  selectHandleConnections(params: { nodeId: string; type: 'source' | 'target'; id?: string }): Signal<HandleConnection[]> {
    return computed(() => {
      this.store.version();
      const lookupKey = params.id
        ? `${params.nodeId}-${params.type}-${params.id}`
        : `${params.nodeId}-${params.type}`;
      const connections = this.store.connectionLookup.get(lookupKey);
      if (!connections) return [];
      return Array.from(connections.values());
    });
  }

  /**
   * Returns a signal with the internal node for a given ID.
   * Equivalent to React's `useInternalNode()`.
   */
  selectInternalNode(nodeId: string): Signal<InternalNode<NodeType> | undefined> {
    return computed(() => {
      this.store.version();
      return this.store.nodeLookup.get(nodeId) as InternalNode<NodeType> | undefined;
    });
  }

  /**
   * Returns a signal indicating whether all nodes have been initialized (have measured dimensions).
   * Equivalent to React's `useNodesInitialized()`.
   */
  selectNodesInitialized(): Signal<boolean> {
    return this.store.nodesInitialized;
  }

  /**
   * Triggers a recalculation of node internals (e.g., after handle positions change).
   * Equivalent to React's `useUpdateNodeInternals()`.
   */
  updateNodeInternals(nodeIds: string | string[]): void {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    const domNode = this.store.domNode();
    if (!domNode) return;

    const updates = new Map<string, InternalNodeUpdate>();
    for (const id of ids) {
      const nodeEl = domNode.querySelector(`[data-id="${id}"]`) as HTMLDivElement | null;
      if (nodeEl) {
        updates.set(id, { id, nodeElement: nodeEl, force: true });
      }
    }

    if (updates.size > 0) {
      this.store.updateNodeInternals(updates);
    }
  }

  /**
   * Returns a reactive signal of the current viewport.
   * Equivalent to React's `useViewport()` / `useOnViewportChange()`.
   */
  selectViewport(): Signal<Viewport> {
    return this.store.viewport;
  }

  /**
   * Returns a reactive signal of the currently selected nodes and edges.
   * Equivalent to React's `useOnSelectionChange()`.
   */
  selectSelectedElements(): Signal<{ nodes: NodeType[]; edges: EdgeType[] }> {
    return computed(() => ({
      nodes: this.store.selectedNodes() as NodeType[],
      edges: this.store.selectedEdges() as EdgeType[],
    }));
  }

  /**
   * Returns a signal that tracks whether a specific key (or any key in an array) is currently pressed.
   * Equivalent to React's `useKeyPress()`.
   * Automatically cleaned up when the service is destroyed.
   */
  selectKeyPressed(keyCode: string | string[]): Signal<boolean> {
    const pressed = signal(false);
    const keys = Array.isArray(keyCode) ? keyCode : [keyCode];

    const onKeyDown = (e: KeyboardEvent) => {
      if (keys.includes(e.key)) pressed.set(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (keys.includes(e.key)) pressed.set(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    });

    return pressed.asReadonly();
  }

  // ── State queries ─────────────────────────────────────────────────────

  /**
   * Whether the viewport/panZoom has been initialized.
   */
  get viewportInitialized(): boolean {
    return this.store.panZoom() !== null;
  }

  /**
   * Returns a signal containing the data for specific edge(s).
   */
  selectEdgesData(edgeIds: string | string[]): Signal<{ id: string; data: Record<string, unknown>; type?: string }[]> {
    const ids = Array.isArray(edgeIds) ? edgeIds : [edgeIds];
    return computed(() => {
      this.store.version();
      return ids
        .map(id => {
          const edge = this.store.edges().find(e => e.id === id);
          if (!edge) return null;
          return { id: edge.id, data: edge.data as Record<string, unknown>, type: edge.type };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);
    });
  }

  // ── Computed Graph Signals ─────────────────────────────────────────

  /**
   * Returns a reactive signal of the outgoing neighbor nodes for a given node ID.
   */
  selectOutgoers(nodeId: string): Signal<NodeType[]> {
    return computed(() => {
      this.store.version();
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return [];
      return getOutgoersSystem(node, nodes, edges as EdgeBase[]) as unknown as NodeType[];
    });
  }

  /**
   * Returns a reactive signal of the incoming neighbor nodes for a given node ID.
   */
  selectIncomers(nodeId: string): Signal<NodeType[]> {
    return computed(() => {
      this.store.version();
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return [];
      return getIncomersSystem(node, nodes, edges as EdgeBase[]) as unknown as NodeType[];
    });
  }

  /**
   * Returns a reactive signal of all edges connected to a given node ID (as source or target).
   */
  selectConnectedEdges(nodeId: string): Signal<EdgeType[]> {
    return computed(() => {
      this.store.version();
      return getConnectedEdgesSystem(
        [{ id: nodeId }] as NodeBase[],
        this.store.edges() as EdgeBase[]
      ) as unknown as EdgeType[];
    });
  }

  // ── Change Middleware ──────────────────────────────────────────────

  /**
   * Registers middleware that intercepts node changes before they are applied.
   * Returns an unregister function.
   */
  onNodesChangeMiddleware(id: string, fn: (changes: import('@angflow/system').NodeChange<NodeType>[]) => import('@angflow/system').NodeChange<NodeType>[]): () => void {
    this.store.nodesChangeMiddleware.set(id, fn);
    return () => { this.store.nodesChangeMiddleware.delete(id); };
  }

  /**
   * Registers middleware that intercepts edge changes before they are applied.
   * Returns an unregister function.
   */
  onEdgesChangeMiddleware(id: string, fn: (changes: import('@angflow/system').EdgeChange<EdgeType>[]) => import('@angflow/system').EdgeChange<EdgeType>[]): () => void {
    this.store.edgesChangeMiddleware.set(id, fn);
    return () => { this.store.edgesChangeMiddleware.delete(id); };
  }

  // ── Handle Data ───────────────────────────────────────────────────────

  /**
   * Look up the user-supplied data attached to a handle via `<ng-flow-handle [data]="...">`.
   *
   * @remarks
   * Returns `undefined` if no data is registered. Typically used from
   * `isValidConnection` callbacks to compare source / target handle types.
   *
   * @param nodeId - The node id hosting the handle.
   * @param handleId - The handle id (or `null` if the handle has no id).
   * @param type - `'source'` or `'target'`.
   */
  getHandleData(nodeId: string, handleId: string | null, type: HandleType): unknown {
    return this.store.getHandleData(nodeId, handleId, type);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private getViewportForBoundsInternal(bounds: Rect, padding: number) {
    return getViewportForBounds(
      bounds,
      this.store.width(),
      this.store.height(),
      this.store.minZoom(),
      this.store.maxZoom(),
      padding
    );
  }
}

import { Injectable, signal, computed, type WritableSignal, type Signal } from '@angular/core';
import {
  adoptUserNodes,
  updateAbsolutePositions,
  panBy as panBySystem,
  updateNodeInternals as updateNodeInternalsSystem,
  updateConnectionLookup,
  handleExpandParent,
  fitViewport,
  getHandlePosition,
  infiniteExtent,
  ConnectionMode,
  initialConnection,
  devWarn,
  defaultAriaLabelConfig,
  Position,
  getNodesInside,
  getInternalNodesBounds,
  getViewportForBounds,
  type NodeChange,
  type EdgeChange,
  type EdgeSelectionChange,
  type NodeSelectionChange,
  type ParentExpandChild,
  type Transform,
  type Viewport,
  type PanZoomInstance,
  type CoordinateExtent,
  type NodeOrigin,
  type SnapGrid,
  type ConnectionState,
  type SelectionRect,
  type InternalNodeBase,
  type NodeLookup,
  type ParentLookup,
  type EdgeLookup,
  type OnError,
  type ZIndexMode,
  type AriaLabelConfig,
  type FitViewOptionsBase,
  type InternalNodeUpdate,
} from '@angflow/system';

import type { Node, Edge, InternalNode } from '../types';
import { applyNodeChanges, applyEdgeChanges, createSelectionChange, getSelectionChanges } from '../utils/changes';

@Injectable()
export class FlowStore<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  // ── Writable signals ──────────────────────────────────────────────────

  readonly rfId = signal('1');
  readonly width = signal(0);
  readonly height = signal(0);
  readonly transform: WritableSignal<Transform> = signal<Transform>([0, 0, 1]);

  readonly nodes: WritableSignal<NodeType[]> = signal<NodeType[]>([]);
  readonly edges: WritableSignal<EdgeType[]> = signal<EdgeType[]>([]);

  readonly nodesInitialized = signal(false);

  readonly hasDefaultNodes = signal(false);
  readonly hasDefaultEdges = signal(false);

  readonly paneDragging = signal(false);
  readonly nodesSelectionActive = signal(false);
  readonly userSelectionActive = signal(false);
  readonly userSelectionRect = signal<SelectionRect | null>(null);
  readonly multiSelectionActive = signal(false);
  readonly selectionKeyActive = signal(false);

  readonly panZoom = signal<PanZoomInstance | null>(null);
  readonly minZoom = signal(0.5);
  readonly maxZoom = signal(2);
  readonly translateExtent = signal<CoordinateExtent>(infiniteExtent);
  readonly nodeExtent = signal<CoordinateExtent>(infiniteExtent);

  readonly domNode = signal<HTMLDivElement | null>(null);
  readonly noDragClassName = signal('nodrag');
  readonly noWheelClassName = signal('nowheel');
  readonly noPanClassName = signal('nopan');

  readonly nodeOrigin = signal<NodeOrigin>([0, 0]);
  readonly nodeDragThreshold = signal(1);
  readonly connectionDragThreshold = signal(1);
  readonly paneClickDistance = signal(0);
  readonly nodeClickDistance = signal(0);
  readonly snapGrid = signal<SnapGrid>([15, 15]);
  readonly snapToGrid = signal(false);

  readonly nodesDraggable = signal(true);
  readonly nodesConnectable = signal(true);
  readonly nodesFocusable = signal(true);
  readonly edgesFocusable = signal(true);
  readonly edgesReconnectable = signal(true);
  readonly elementsSelectable = signal(true);
  readonly elevateNodesOnSelect = signal(true);
  readonly elevateEdgesOnSelect = signal(true);
  readonly selectNodesOnDrag = signal(true);

  readonly connectionMode = signal<ConnectionMode>(ConnectionMode.Strict);
  readonly connection = signal<ConnectionState>({ ...initialConnection });
  readonly connectionClickStartHandle = signal<{ nodeId: string; handleId: string | null; type: import('@angflow/system').HandleType } | null>(null);
  readonly connectOnClick = signal(true);
  readonly connectionRadius = signal(20);

  readonly fitViewQueued = signal(false);
  readonly fitViewOptions = signal<FitViewOptionsBase<NodeType> | undefined>(undefined);

  readonly autoPanOnConnect = signal(true);
  readonly autoPanOnNodeDrag = signal(true);
  readonly autoPanOnNodeFocus = signal(true);
  readonly autoPanSpeed = signal(15);

  readonly isValidConnection = signal<((connection: EdgeType | import('@angflow/system').Connection) => boolean) | undefined>(undefined);
  readonly onError = signal<OnError>(devWarn);

  readonly lib = signal('ng');
  readonly debug = signal(false);
  readonly zIndexMode = signal<ZIndexMode>('basic');
  readonly ariaLabelConfig = signal<AriaLabelConfig>(defaultAriaLabelConfig);

  readonly onlyRenderVisibleElements = signal(false);
  readonly ariaLiveMessage = signal('');

  // ── Default edge options ───────────────────────────────────────────
  readonly defaultEdgeOptions = signal<import('../types').DefaultEdgeOptions | undefined>(undefined);

  // ── Connection callbacks (set by NgFlowComponent) ──────────────────
  onConnect: ((connection: import('@angflow/system').Connection) => void) | null = null;
  onConnectStart: ((event: MouseEvent | TouchEvent, params: import('@angflow/system').OnConnectStartParams) => void) | null = null;
  onConnectEnd: ((event: MouseEvent | TouchEvent) => void) | null = null;
  onClickConnectStart: ((event: MouseEvent, params: import('@angflow/system').OnConnectStartParams) => void) | null = null;
  onClickConnectEnd: ((event: MouseEvent) => void) | null = null;

  // ── Delete validation callback ────────────────────────────────────
  onBeforeDelete: ((params: { nodes: NodeType[]; edges: EdgeType[] }) => boolean | Promise<boolean>) | null = null;

  // ── Node drag callbacks (set by NgFlowComponent, consumed by XYDrag) ──
  onNodeDragStart: ((event: MouseEvent, node: NodeType, nodes: NodeType[]) => void) | null = null;
  onNodeDrag: ((event: MouseEvent, node: NodeType, nodes: NodeType[]) => void) | null = null;
  onNodeDragStop: ((event: MouseEvent, node: NodeType, nodes: NodeType[]) => void) | null = null;
  onSelectionDragStart: ((event: MouseEvent, nodes: NodeType[]) => void) | null = null;
  onSelectionDrag: ((event: MouseEvent, nodes: NodeType[]) => void) | null = null;
  onSelectionDragStop: ((event: MouseEvent, nodes: NodeType[]) => void) | null = null;

  // ── Change middleware maps ─────────────────────────────────────────
  readonly nodesChangeMiddleware = new Map<string, (changes: NodeChange<NodeType>[]) => NodeChange<NodeType>[]>();
  readonly edgesChangeMiddleware = new Map<string, (changes: EdgeChange<EdgeType>[]) => EdgeChange<EdgeType>[]>();

  // ── Mutable lookup maps (not deeply reactive, updated imperatively) ───

  readonly nodeLookup: NodeLookup<InternalNodeBase<NodeType>> = new Map();
  readonly parentLookup: ParentLookup<InternalNodeBase<NodeType>> = new Map();
  readonly edgeLookup: EdgeLookup<EdgeType> = new Map();
  readonly connectionLookup: Map<string, Map<string, import('@angflow/system').HandleConnection>> = new Map();

  // ── Callback references ───────────────────────────────────────────────

  onNodesChange: ((changes: NodeChange<NodeType>[]) => void) | null = null;
  onEdgesChange: ((changes: EdgeChange<EdgeType>[]) => void) | null = null;

  // A version counter bumped on every visual change to trigger recomputation
  // of visibleNodes/visibleEdges without rebuilding the full nodeLookup
  readonly version = signal(0);
  private batchDepth = 0;
  private batchDirty = false;

  bumpVersion(): void {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      return;
    }
    this.version.update(v => v + 1);
  }

  /**
   * Coalesce multiple updates into a single version bump / reactivity cycle.
   * Usage: `store.batch(() => { store.setNodes(...); store.setEdges(...); })`
   */
  batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        this.version.update(v => v + 1);
      }
    }
  }

  // ── Computed signals ──────────────────────────────────────────────────

  readonly viewport: Signal<Viewport> = computed(() => {
    const t = this.transform();
    return { x: t[0], y: t[1], zoom: t[2] };
  });

  readonly selectedNodes: Signal<NodeType[]> = computed(() =>
    this.nodes().filter((n) => n.selected)
  );

  readonly selectedEdges: Signal<EdgeType[]> = computed(() =>
    this.edges().filter((e) => e.selected)
  );

  readonly visibleNodes: Signal<InternalNodeBase<NodeType>[]> = computed(() => {
    // Read version to trigger recomputation on any visual change (drag, add, remove)
    this.version();

    if (!this.onlyRenderVisibleElements()) {
      return Array.from(this.nodeLookup.values());
    }
    const t = this.transform();
    return getNodesInside(this.nodeLookup, { x: 0, y: 0, width: this.width(), height: this.height() }, t, true);
  });

  readonly visibleEdgeIds: Signal<Set<string>> = computed(() => {
    // Read version + edges signal
    this.version();
    const edges = this.edges();

    if (!this.onlyRenderVisibleElements()) {
      return new Set(edges.map((e) => e.id));
    }
    const visibleNodeIds = new Set(this.visibleNodes().map((n) => n.id));
    return new Set(
      edges
        .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
        .map((e) => e.id)
    );
  });

  // ── Actions ───────────────────────────────────────────────────────────

  setNodes(nodes: NodeType[]): void {
    const { nodesInitialized, hasSelectedNodes } = adoptUserNodes(nodes, this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: this.nodeExtent(),
      elevateNodesOnSelect: this.elevateNodesOnSelect(),
      checkEquality: true,
      zIndexMode: this.zIndexMode(),
    });

    const nextNodesSelectionActive = this.nodesSelectionActive() && hasSelectedNodes;

    this.nodesInitialized.set(nodesInitialized);
    this.nodesSelectionActive.set(nextNodesSelectionActive);
    this.nodes.set(nodes);
    this.bumpVersion();

    if (this.fitViewQueued() && nodesInitialized) {
      this.resolveFitView();
      this.fitViewQueued.set(false);
      this.fitViewOptions.set(undefined);
    }
  }

  setEdges(edges: EdgeType[]): void {
    updateConnectionLookup(this.connectionLookup, this.edgeLookup, edges);
    this.edges.set(edges);
    this.bumpVersion();
  }

  setDefaultNodesAndEdges(nodes?: NodeType[], edges?: EdgeType[]): void {
    if (nodes) {
      this.setNodes(nodes);
      this.hasDefaultNodes.set(true);
    }
    if (edges) {
      this.setEdges(edges);
      this.hasDefaultEdges.set(true);
    }
  }

  updateNodeInternals(updates: Map<string, InternalNodeUpdate>): void {
    const { changes, updatedInternals } = updateNodeInternalsSystem(
      updates,
      this.nodeLookup,
      this.parentLookup,
      this.domNode(),
      this.nodeOrigin(),
      this.nodeExtent(),
      this.zIndexMode()
    );

    if (!updatedInternals) {
      return;
    }

    updateAbsolutePositions(this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: this.nodeExtent(),
      zIndexMode: this.zIndexMode(),
    });

    if (this.fitViewQueued()) {
      this.resolveFitView();
      this.fitViewQueued.set(false);
      this.fitViewOptions.set(undefined);
    }

    // Trigger reactivity by touching the nodes signal
    this.nodes.update((n) => [...n]);

    if (changes?.length > 0) {
      this.triggerNodeChanges(changes);
    }
  }

  updateNodePositions(nodeDragItems: Map<string, any>, dragging = false): void {
    const parentExpandChildren: ParentExpandChild[] = [];
    const changes: NodeChange[] = [];
    const conn = this.connection();

    for (const [id, dragItem] of nodeDragItems) {
      const node = this.nodeLookup.get(id);
      const expandParent = !!(node?.expandParent && node?.parentId && dragItem?.position);

      const change: NodeChange = {
        id,
        type: 'position',
        position: expandParent
          ? { x: Math.max(0, dragItem.position.x), y: Math.max(0, dragItem.position.y) }
          : dragItem.position,
        dragging,
      };

      if (node && conn.inProgress && (conn as any).fromNode?.id === node.id) {
        const updatedFrom = getHandlePosition(node, (conn as any).fromHandle, Position.Left, true);
        this.updateConnection({ ...conn, from: updatedFrom });
      }

      if (expandParent && node!.parentId) {
        parentExpandChildren.push({
          id,
          parentId: node!.parentId,
          rect: {
            ...dragItem.internals.positionAbsolute,
            width: dragItem.measured.width ?? 0,
            height: dragItem.measured.height ?? 0,
          },
        });
      }

      changes.push(change);
    }

    if (parentExpandChildren.length > 0) {
      const parentExpandChanges = handleExpandParent(
        parentExpandChildren,
        this.nodeLookup,
        this.parentLookup,
        this.nodeOrigin()
      );
      changes.push(...parentExpandChanges);
    }

    this.triggerNodeChanges(changes as NodeChange<NodeType>[]);
  }

  triggerNodeChanges(changes: NodeChange<NodeType>[]): void {
    if (!changes?.length) return;

    // Apply middleware pipeline
    for (const middleware of this.nodesChangeMiddleware.values()) {
      changes = middleware(changes);
      if (!changes?.length) return;
    }

    // Fast path: if all changes are position-only, update nodeLookup in-place
    // instead of rebuilding everything via setNodes
    const allPosition = changes.every(c => c.type === 'position');

    if (allPosition) {
      // Update user nodes array with new positions (cheap shallow copy).
      // Produce new user-node objects instead of mutating them so that
      // reference-equality checks in adoptUserNodes (checkEquality: true) remain
      // valid, and consumers relying on immutability are not surprised.
      let nodesChanged = false;
      const updatedNodes = this.nodes().map((userNode) => {
        const change = changes.find(c => c.type === 'position' && c.id === userNode.id);
        if (!change || change.type !== 'position') return userNode;

        const internalNode = this.nodeLookup.get(change.id);
        if (!internalNode) return userNode;

        // Update internal node data in-place (not user-visible)
        if (change.position) {
          internalNode.position = change.position;
          if (internalNode.internals) {
            internalNode.internals.positionAbsolute = change.position;
          }
        }
        if (change.dragging !== undefined) {
          internalNode.dragging = change.dragging;
        }

        // Produce a new user-node object to preserve immutability
        nodesChanged = true;
        const newUserNode: NodeType = change.position
          ? { ...userNode, position: change.position, dragging: change.dragging }
          : { ...userNode, dragging: change.dragging };
        // Keep the internal node's userNode reference in sync
        if (internalNode.internals) {
          (internalNode.internals as { userNode: NodeType }).userNode = newUserNode;
        }
        return newUserNode;
      });

      if (nodesChanged) {
        this.nodes.set(updatedNodes);
        // Bump version to trigger template re-render without full rebuild
        this.bumpVersion();
      }
    } else {
      // Full path: apply all change types (add, remove, select, dimensions, etc.)
      const updatedNodes = applyNodeChanges(changes, this.nodes());
      this.setNodes(updatedNodes);
    }

    if (this.debug()) {
      console.log('Angular Flow: trigger node changes', changes);
    }

    this.onNodesChange?.(changes);
  }

  triggerEdgeChanges(changes: EdgeChange<EdgeType>[]): void {
    if (!changes?.length) return;

    // Apply middleware pipeline
    for (const middleware of this.edgesChangeMiddleware.values()) {
      changes = middleware(changes);
      if (!changes?.length) return;
    }

    // Always apply changes internally for immediate visual feedback
    const updatedEdges = applyEdgeChanges(changes, this.edges());
    this.setEdges(updatedEdges);

    if (this.debug()) {
      console.log('Angular Flow: trigger edge changes', changes);
    }

    this.onEdgesChange?.(changes);
  }

  addSelectedNodes(selectedNodeIds: string[]): void {
    if (this.multiSelectionActive()) {
      const nodeChanges = selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true));
      this.triggerNodeChanges(nodeChanges as NodeChange<NodeType>[]);
      return;
    }

    this.triggerNodeChanges(
      getSelectionChanges(this.nodeLookup, new Set([...selectedNodeIds]), true) as NodeChange<NodeType>[]
    );
    this.triggerEdgeChanges(getSelectionChanges(this.edgeLookup) as EdgeChange<EdgeType>[]);
  }

  addSelectedEdges(selectedEdgeIds: string[]): void {
    if (this.multiSelectionActive()) {
      const changedEdges = selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true));
      this.triggerEdgeChanges(changedEdges as EdgeChange<EdgeType>[]);
      return;
    }

    this.triggerEdgeChanges(
      getSelectionChanges(this.edgeLookup, new Set([...selectedEdgeIds])) as EdgeChange<EdgeType>[]
    );
    this.triggerNodeChanges(
      getSelectionChanges(this.nodeLookup, new Set(), true) as NodeChange<NodeType>[]
    );
  }

  unselectNodesAndEdges(params: { nodes?: NodeType[]; edges?: EdgeType[] } = {}): void {
    const nodesToUnselect = params.nodes ?? this.nodes();
    const edgesToUnselect = params.edges ?? this.edges();

    const nodeChanges: NodeSelectionChange[] = [];
    for (const node of nodesToUnselect) {
      if (!node.selected) continue;
      const internalNode = this.nodeLookup.get(node.id);
      if (internalNode) {
        internalNode.selected = false;
      }
      nodeChanges.push(createSelectionChange(node.id, false) as NodeSelectionChange);
    }

    const edgeChanges: EdgeSelectionChange[] = [];
    for (const edge of edgesToUnselect) {
      if (!edge.selected) continue;
      edgeChanges.push(createSelectionChange(edge.id, false) as EdgeSelectionChange);
    }

    this.triggerNodeChanges(nodeChanges as NodeChange<NodeType>[]);
    this.triggerEdgeChanges(edgeChanges as EdgeChange<EdgeType>[]);
  }

  // ── Viewport actions ──────────────────────────────────────────────────

  panBy(delta: { x: number; y: number }): Promise<boolean> {
    return panBySystem({
      delta,
      panZoom: this.panZoom(),
      transform: this.transform(),
      translateExtent: this.translateExtent(),
      width: this.width(),
      height: this.height(),
    });
  }

  async fitView(options?: FitViewOptionsBase<NodeType>): Promise<boolean> {
    const pz = this.panZoom();
    if (!pz) return false;

    await fitViewport(
      {
        nodes: this.nodeLookup,
        width: this.width(),
        height: this.height(),
        panZoom: pz,
        minZoom: this.minZoom(),
        maxZoom: this.maxZoom(),
      },
      options
    );

    return true;
  }

  async setCenter(x: number, y: number, options?: { zoom?: number; duration?: number; ease?: (t: number) => number; interpolate?: string }): Promise<boolean> {
    const pz = this.panZoom();
    if (!pz) return false;

    const nextZoom = options?.zoom ?? this.maxZoom();

    await pz.setViewport(
      {
        x: this.width() / 2 - x * nextZoom,
        y: this.height() / 2 - y * nextZoom,
        zoom: nextZoom,
      },
      { duration: options?.duration, ease: options?.ease }
    );

    return true;
  }

  async setViewport(viewport: Viewport, options?: { duration?: number }): Promise<void> {
    const pz = this.panZoom();
    if (!pz) return;

    await pz.setViewport(viewport, { duration: options?.duration });
  }

  async zoomIn(options?: { duration?: number }): Promise<boolean> {
    const pz = this.panZoom();
    if (!pz) return false;
    return pz.scaleBy(1.2, { duration: options?.duration });
  }

  async zoomOut(options?: { duration?: number }): Promise<boolean> {
    const pz = this.panZoom();
    if (!pz) return false;
    return pz.scaleBy(1 / 1.2, { duration: options?.duration });
  }

  async zoomTo(zoomLevel: number, options?: { duration?: number }): Promise<boolean> {
    const pz = this.panZoom();
    if (!pz) return false;
    return pz.scaleTo(zoomLevel, { duration: options?.duration });
  }

  setMinZoom(minZoom: number): void {
    this.panZoom()?.setScaleExtent([minZoom, this.maxZoom()]);
    this.minZoom.set(minZoom);
  }

  setMaxZoom(maxZoom: number): void {
    this.panZoom()?.setScaleExtent([this.minZoom(), maxZoom]);
    this.maxZoom.set(maxZoom);
  }

  setTranslateExtent(extent: CoordinateExtent): void {
    this.panZoom()?.setTranslateExtent(extent);
    this.translateExtent.set(extent);
  }

  setNodeExtent(extent: CoordinateExtent): void {
    this.nodeExtent.set(extent);

    // Re-adopt nodes with the new extent so positions are clamped
    const currentNodes = this.nodes();
    adoptUserNodes(currentNodes, this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: extent,
      elevateNodesOnSelect: this.elevateNodesOnSelect(),
      checkEquality: false,
      zIndexMode: this.zIndexMode(),
    });

    updateAbsolutePositions(this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: extent,
      zIndexMode: this.zIndexMode(),
    });

    this.nodes.update(n => [...n]);
    this.bumpVersion();
  }

  resetSelectedElements(): void {
    this.unselectNodesAndEdges();
    this.nodesSelectionActive.set(false);
  }

  // ── Connection actions ────────────────────────────────────────────────

  cancelConnection(): void {
    this.connection.set({ ...initialConnection });
  }

  updateConnection(connectionState: ConnectionState): void {
    this.connection.set(connectionState);
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.nodeLookup.clear();
    this.parentLookup.clear();
    this.edgeLookup.clear();
    this.connectionLookup.clear();
    this.nodesChangeMiddleware.clear();
    this.edgesChangeMiddleware.clear();

    this.nodes.set([]);
    this.edges.set([]);
    this.transform.set([0, 0, 1]);
    this.nodesInitialized.set(false);
    this.connection.set({ ...initialConnection });
    this.paneDragging.set(false);
    this.nodesSelectionActive.set(false);
    this.userSelectionActive.set(false);
    this.userSelectionRect.set(null);
    this.multiSelectionActive.set(false);
    this.selectionKeyActive.set(false);
    this.fitViewQueued.set(false);
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private async resolveFitView(): Promise<void> {
    const pz = this.panZoom();
    if (!pz) return;

    await fitViewport(
      {
        nodes: this.nodeLookup,
        width: this.width(),
        height: this.height(),
        panZoom: pz,
        minZoom: this.minZoom(),
        maxZoom: this.maxZoom(),
      },
      this.fitViewOptions()
    );
  }

  /**
   * Returns a snapshot of store items needed by @angflow/system subsystems (XYDrag, XYHandle, etc.).
   */
  getStoreItems() {
    return {
      nodes: this.nodes(),
      nodeLookup: this.nodeLookup,
      edges: this.edges(),
      edgeLookup: this.edgeLookup,
      connectionLookup: this.connectionLookup,
      parentLookup: this.parentLookup,
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: this.nodeExtent(),
      elevateNodesOnSelect: this.elevateNodesOnSelect(),
      elevateEdgesOnSelect: this.elevateEdgesOnSelect(),
      connectionMode: this.connectionMode(),
      domNode: this.domNode(),
      transform: this.transform(),
      panZoom: this.panZoom(),
      snapGrid: this.snapGrid(),
      snapToGrid: this.snapToGrid(),
      nodesDraggable: this.nodesDraggable(),
      selectNodesOnDrag: this.selectNodesOnDrag(),
      nodeDragThreshold: this.nodeDragThreshold(),
      multiSelectionActive: this.multiSelectionActive(),
      connectionRadius: this.connectionRadius(),
      connectionDragThreshold: this.connectionDragThreshold(),
      isValidConnection: this.isValidConnection(),
      autoPanOnConnect: this.autoPanOnConnect(),
      autoPanOnNodeDrag: this.autoPanOnNodeDrag(),
      autoPanOnNodeFocus: this.autoPanOnNodeFocus(),
      autoPanSpeed: this.autoPanSpeed(),
      defaultEdgeOptions: this.defaultEdgeOptions(),
      width: this.width(),
      height: this.height(),
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      translateExtent: this.translateExtent(),
      zIndexMode: this.zIndexMode(),
      lib: this.lib(),
      connection: this.connection(),
      connectOnClick: this.connectOnClick(),
      noDragClassName: this.noDragClassName(),
      noPanClassName: this.noPanClassName(),
      noWheelClassName: this.noWheelClassName(),

      // Node drag callbacks for XYDrag multi-select support
      onNodeDragStart: this.onNodeDragStart ?? undefined,
      onNodeDrag: this.onNodeDrag ?? undefined,
      onNodeDragStop: this.onNodeDragStop ?? undefined,
      onSelectionDragStart: this.onSelectionDragStart ?? undefined,
      onSelectionDrag: this.onSelectionDrag ?? undefined,
      onSelectionDragStop: this.onSelectionDragStop ?? undefined,

      // Store-bound callbacks for system subsystems
      panBy: (delta: { x: number; y: number }) => this.panBy(delta),
      updateNodePositions: (items: Map<string, any>, dragging?: boolean) => this.updateNodePositions(items, dragging),
      unselectNodesAndEdges: (params?: any) => this.unselectNodesAndEdges(params),
      addSelectedNodes: (ids: string[]) => this.addSelectedNodes(ids),
      addSelectedEdges: (ids: string[]) => this.addSelectedEdges(ids),
      updateConnection: (conn: ConnectionState) => this.updateConnection(conn),
      cancelConnection: () => this.cancelConnection(),
      triggerNodeChanges: (changes: NodeChange[]) => this.triggerNodeChanges(changes as NodeChange<NodeType>[]),
      triggerEdgeChanges: (changes: EdgeChange[]) => this.triggerEdgeChanges(changes as EdgeChange<EdgeType>[]),
    };
  }
}

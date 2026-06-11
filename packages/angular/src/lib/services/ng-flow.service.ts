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
import { elementToRemoveChange } from '../utils/changes';
import type { Node, Edge, InternalNode, NgFlowInstance, NgFlowJsonObject, DeleteElementsOptions } from '../types';
import type { NodeTemplateSpec } from '../types/node-template';
import { prefersReducedMotion } from '../utils/position-tween';
import { getGroupBounds, type GroupBoundsOptions } from '../graph/group-bounds';

/** Keep in sync with `builtInNodeTypes` in container/node-renderer/node-renderer.component.ts. */
const BUILT_IN_NODE_TYPE_NAMES = ['default', 'input', 'output', 'group'] as const;
/** Keep in sync with `builtInEdgeTypes` in container/edge-renderer/edge-renderer.component.ts. */
const BUILT_IN_EDGE_TYPE_NAMES = ['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier'] as const;

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

  /**
   * Size and position a group node to wrap its direct children (nodes with
   * `parentId === groupId`), keeping the children visually fixed. Sets the
   * group's `width`/`height` and moves its top-left to the wrapping box (with
   * `opts.padding`/`headerHeight`/`minWidth`/`minHeight`). No-op if the group has
   * no children. Immediate (not animated).
   *
   * Resolves the box-origin ↔ child-coordinate feedback loop by capturing the
   * children's absolute positions, then applying one combined absolute map (the
   * group's new position + those child absolutes) — `setNodePositions` resolves
   * each child against the group's NEW position from the same map, so the
   * children's parent-relative positions shift to keep them visually pinned.
   */
  async sizeGroupToChildren(groupId: string, opts?: GroupBoundsOptions): Promise<void> {
    const children = this.getNodes()
      .filter((n) => n.parentId === groupId)
      .map((n) => this.getInternalNode(n.id))
      .filter((n): n is InternalNode<NodeType> => n != null);
    if (children.length === 0) return;

    const members = children.map((c) => ({
      position: c.internals.positionAbsolute,
      measured: c.measured,
      width: c.width,
      height: c.height,
    }));
    const childAbsolute: Record<string, { x: number; y: number }> = {};
    for (const c of children) {
      childAbsolute[c.id] = { x: c.internals.positionAbsolute.x, y: c.internals.positionAbsolute.y };
    }

    const bounds = getGroupBounds(members, opts);
    this.updateNode(groupId, { width: bounds.width, height: bounds.height } as Partial<NodeType>);
    // animate:false — this is a synchronous pin; tweening would drift the children mid-flight.
    // One combined absolute map: the group's new position + the children's
    // (unchanged) absolutes. toRelativePositions resolves each child against the
    // group's NEW position from this same map, keeping them visually pinned.
    await this.setNodePositions(
      { [groupId]: bounds.position, ...childAbsolute },
      { coordinateSpace: 'absolute', animate: false },
    );
  }

  /**
   * Set a (group/parent) node's `collapsed` state. Emits a `replace` node change
   * so controlled apps can journal it. angflow derives descendant hiding and
   * crossing-edge rerouting from this flag.
   */
  setNodeCollapsed(id: string, collapsed: boolean): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    const next = { ...current, collapsed } as NodeType;
    this.store.triggerNodeChanges([{ id, type: 'replace', item: next }]);
  }

  /** Flip a node's `collapsed` state. No-op for unknown ids. */
  toggleNodeCollapsed(id: string): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    this.setNodeCollapsed(id, !current.collapsed);
  }

  /**
   * Move many nodes at once from a position map (e.g. the result of
   * `layoutNodes`). Unknown ids are skipped. Animation defaults to the flow's
   * `[animate]` input; pass `opts.animate` (true/false/{duration}) to override
   * per call. Resolves when positions are applied — after the tween when
   * animating, immediately otherwise.
   *
   * Positions are in `node.position` space (parent-relative for child nodes).
   *
   * Pass `opts.coordinateSpace: 'absolute'` to provide flow-absolute coordinates
   * instead; parented nodes are translated to their parent-relative space
   * internally (top-level nodes are unaffected). Default is `'relative'`.
   */
  setNodePositions(
    positions: Record<string, { x: number; y: number }>,
    opts?: { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' },
  ): Promise<void> {
    const resolved = opts?.coordinateSpace === 'absolute' ? this.toRelativePositions(positions) : positions;
    const valid: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of Object.entries(resolved)) {
      if (this.store.nodeLookup.has(id)) valid[id] = pos;
    }
    if (Object.keys(valid).length === 0) return Promise.resolve();

    const setting = opts?.animate ?? this.store.animate();
    const animated = (setting === true || (typeof setting === 'object' && setting !== null)) && !prefersReducedMotion();
    if (animated) {
      const duration =
        typeof setting === 'object' && setting !== null && (setting as { duration?: number }).duration != null
          ? (setting as { duration?: number }).duration!
          : this.store.animationDuration();
      return this.store.tweenNodePositions(valid, duration);
    }

    const changes = Object.entries(valid).map(([id, position]) => ({
      id,
      type: 'position' as const,
      position,
    }));
    this.store.triggerNodeChanges(changes as NodeChange<NodeType>[]);
    return Promise.resolve();
  }

  /**
   * Convert a flow-absolute position map into the store's `node.position` space
   * (parent-relative for parented nodes). Inverts the store's child transform
   * (`updateChildNode` → `calculateChildXYZ` → `getNodePositionWithOrigin`):
   * `relative = absolute − parentAbs + dims·origin`, using the child's origin
   * (`node.origin ?? store.nodeOrigin`) and resolved dimensions.
   *
   * `parentAbs` is the parent's NEW absolute position when the SAME map also
   * moves the parent (`positions[parentId]`) — exactly what compound
   * `layoutNodes` returns, which moves a group and its members together. Because
   * the incoming map is already in absolute space, the parent's own entry IS its
   * new absolute, so no recursion is needed. When the map does not move the
   * parent, we fall back to the parent's current `internals.positionAbsolute`.
   * This avoids resolving the child against the parent's *pre-move* absolute,
   * which would offset children by the parent's movement delta (compounding for
   * nested groups).
   *
   * Top-level nodes, unknown ids, and nodes whose parent is missing pass through
   * unchanged. The store re-applies extent clamping on write, so we don't clamp.
   */
  private toRelativePositions(
    positions: Record<string, { x: number; y: number }>,
  ): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const storeOrigin = this.store.nodeOrigin();
    for (const [id, abs] of Object.entries(positions)) {
      const node = this.store.nodeLookup.get(id);
      const parent = node?.parentId ? this.store.nodeLookup.get(node.parentId) : undefined;
      if (!node || !parent) {
        out[id] = abs;
        continue;
      }
      const origin = node.origin ?? storeOrigin;
      const w = node.measured?.width ?? node.width ?? node.initialWidth ?? 0;
      const h = node.measured?.height ?? node.height ?? node.initialHeight ?? 0;
      const pAbs = positions[node.parentId!] ?? parent.internals.positionAbsolute;
      out[id] = { x: abs.x - pAbs.x + w * origin[0], y: abs.y - pAbs.y + h * origin[1] };
    }
    return out;
  }

  /**
   * One-call auto-layout: reads the current nodes/edges, runs `layoutFn`
   * (e.g. `layoutNodes` from `@angflow/angular/layout` — passed in, not
   * imported, so dagre stays out of bundles that never lay out), and applies
   * the returned positions via {@link setNodePositions}.
   *
   * ```ts
   * import { layoutNodes } from '@angflow/angular/layout';
   * flow.applyLayout(layoutNodes, { direction: 'LR' });
   * ```
   *
   * Internal nodes (with `measured` dimensions) are passed to `layoutFn`.
   * `opts.animate` overrides the flow's `[animate]` input for this call; all
   * other `opts` keys are forwarded to `layoutFn`.
   *
   * Positions are in `node.position` space (parent-relative for child nodes).
   *
   * Sub-flow note: `layoutNodes` and other flat layout fns emit positions in one
   * global (absolute) space. To place parented nodes from such a fn, pass
   * `opts.coordinateSpace: 'absolute'` — angflow then translates each parented
   * node into its parent-relative space on apply. (Group-aware *layout* itself —
   * clustering children within a box — is separate.)
   */
  async applyLayout<O extends Record<string, unknown>>(
    layoutFn: (
      nodes: InternalNode<NodeType>[],
      edges: EdgeType[],
      opts?: O,
    ) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>,
    opts?: O & { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' },
  ): Promise<void> {
    const { animate, coordinateSpace, ...layoutOpts } = opts ?? ({} as O & { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' });
    const nodes = this.withLiveMeasurements(
      this.getNodes().map((n) => this.getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>)),
    );
    const edges = this.withLiveEdgeLabels(this.getEdges());
    const positions = await layoutFn(nodes, edges, layoutOpts as unknown as O);
    // Passing undefined animate/coordinateSpace is safe: setNodePositions does
    // `opts?.animate ?? store.animate()` and `coordinateSpace === 'absolute'`, so
    // undefined values fall back to the same defaults as omitting opts entirely.
    await this.setNodePositions(positions, { animate, coordinateSpace });
  }

  /**
   * Override each node's `measured` from its live rendered element
   * (`.xy-flow__node[data-id]`) when present. `offsetWidth/Height` are intrinsic
   * layout dims, unaffected by the pane's CSS scale — no zoom math. Reads only;
   * returns shallow clones so store objects are never mutated. Nodes with no
   * element (hidden / SSR / not-yet-rendered) or zero size pass through unchanged
   * so `layoutNodes`' measured→width→initial→default fallback still applies.
   */
  private withLiveMeasurements(nodes: InternalNode<NodeType>[]): InternalNode<NodeType>[] {
    const container = this.store.domNode();
    if (!container) return nodes;
    return nodes.map((n) => {
      const escaped = NgFlowService.cssEscapeId(n.id);
      const el = container.querySelector(`.xy-flow__node[data-id="${escaped}"]`) as HTMLElement | null;
      if (!el) return n;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return n;
      return { ...n, measured: { width, height } };
    });
  }

  /**
   * Fill each edge's `labelWidth`/`labelHeight` from its live label element
   * (`.xy-flow__edge-label[data-id]`) when present, so `layoutNodes` can reserve
   * dagre space for the label. Reads only; returns shallow clones. Edges with no
   * rendered label pass through unchanged.
   */
  private withLiveEdgeLabels(edges: EdgeType[]): EdgeType[] {
    const container = this.store.domNode();
    if (!container) return edges;
    return edges.map((e) => {
      const escaped = NgFlowService.cssEscapeId(e.id);
      const el = container.querySelector(`.xy-flow__edge-label[data-id="${escaped}"]`) as HTMLElement | null;
      if (!el) return e;
      const labelWidth = el.offsetWidth;
      const labelHeight = el.offsetHeight;
      if (!labelWidth || !labelHeight) return e;
      return { ...e, labelWidth, labelHeight } as EdgeType;
    });
  }

  /**
   * Escape a string for use in a CSS attribute selector value.
   * Uses the native `CSS.escape` when available (browser), and falls back to a
   * minimal implementation for SSR / jsdom environments.
   */
  private static cssEscapeId(id: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(id);
    }
    // Minimal fallback: escape characters that are special inside CSS strings/selectors
    return id.replace(/["\\]/g, '\\$&');
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

  /**
   * Set or modify node/edge selection programmatically. Independent of the
   * global `multiSelectionActive()` mode — pass `additive: true` to add to the
   * current selection, omit it (or pass `false`) to replace the current
   * selection with the given ids.
   *
   * Selection changes flow through the normal change pipeline, so consumers
   * subscribed to `(nodesChange)` / `(edgesChange)` will see selection-change
   * entries.
   *
   * Pass `{}` (or empty arrays) with `additive: false` (the default) to clear
   * the entire selection.
   */
  setSelection(params: { nodeIds?: string[]; edgeIds?: string[]; additive?: boolean }): void {
    const additive = params.additive ?? false;
    const nodeIds = params.nodeIds;
    const edgeIds = params.edgeIds;

    this.store.batch(() => {
      if (!additive) {
        this.store.unselectNodesAndEdges();
      }

      if (nodeIds && nodeIds.length > 0) {
        const changes = nodeIds.map((id) => ({ id, type: 'select' as const, selected: true }));
        this.store.triggerNodeChanges(changes as NodeChange<NodeType>[]);
      }

      if (edgeIds && edgeIds.length > 0) {
        const changes = edgeIds.map((id) => ({ id, type: 'select' as const, selected: true }));
        this.store.triggerEdgeChanges(changes as EdgeChange<EdgeType>[]);
      }
    });
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
   * Whether the host has registered an `onBeforeDelete` veto hook on this flow.
   * Useful for callers (e.g. the agent bridge) that take a synchronous deletion
   * path and want to detect when they're silently bypassing the host's veto.
   */
  hasOnBeforeDeleteHook(): boolean {
    return this.store.onBeforeDelete !== null;
  }

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

    if (edgesToDelete.length > 0) {
      this.store.triggerEdgeChanges(
        edgesToDelete.map((e) => elementToRemoveChange(e)) as EdgeChange<EdgeType>[],
      );
    }
    if (nodesToDelete.length > 0) {
      this.store.triggerNodeChanges(
        nodesToDelete.map((n) => elementToRemoveChange(n)) as NodeChange<NodeType>[],
      );
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

  // ── Node templates (agent bridge) ─────────────────────────────────────

  /** Reactive view of the data-driven node templates registered on this flow. */
  readonly nodeTemplates: Signal<ReadonlyMap<string, NodeTemplateSpec>> = computed(() =>
    this.store.nodeTemplates(),
  );

  /** Register (or overwrite) a data-driven node template. Renders live via signals. */
  registerNodeTemplate(name: string, spec: NodeTemplateSpec): void {
    const next = new Map(this.store.nodeTemplates());
    next.set(name, spec);
    this.store.nodeTemplates.set(next);
  }

  /** Remove a registered template. Returns whether it existed. */
  unregisterNodeTemplate(name: string): boolean {
    const current = this.store.nodeTemplates();
    if (!current.has(name)) return false;
    const next = new Map(current);
    next.delete(name);
    this.store.nodeTemplates.set(next);
    return true;
  }

  /** List registered templates with their full specs. */
  getNodeTemplates(): Array<{ name: string; spec: NodeTemplateSpec }> {
    return Array.from(this.store.nodeTemplates().entries()).map(([name, spec]) => ({
      name,
      spec,
    }));
  }

  // ── Type discovery (agent bridge) ──────────────────────────────────────

  /**
   * Every node type name renderable on this flow, tagged with its source.
   * Later sources win for duplicate names, mirroring renderer precedence
   * (host components shadow built-ins; templates cannot collide — the bridge
   * rejects registration of names claimed by builtin/host).
   * Note: content-projected `<ng-template ngFlowNodeType>` types are reported
   * as 'host' — both host sources are equivalent from an agent's perspective
   * (app-provided, data contract unknown, not overridable).
   */
  getNodeTypeNames(): Array<{ name: string; source: 'builtin' | 'host' | 'template' }> {
    const result = new Map<string, 'builtin' | 'host' | 'template'>();
    for (const name of BUILT_IN_NODE_TYPE_NAMES) result.set(name, 'builtin');
    for (const name of this.store.hostNodeTypeNames()) result.set(name, 'host');
    for (const name of this.store.contentNodeTemplateNames()) result.set(name, 'host');
    for (const name of this.store.nodeTemplates().keys()) result.set(name, 'template');
    return Array.from(result.entries()).map(([name, source]) => ({ name, source }));
  }

  /** Every edge type name renderable on this flow, tagged with its source. */
  getEdgeTypeNames(): Array<{ name: string; source: 'builtin' | 'host' | 'template' }> {
    const result = new Map<string, 'builtin' | 'host' | 'template'>();
    for (const name of BUILT_IN_EDGE_TYPE_NAMES) result.set(name, 'builtin');
    for (const name of this.store.hostEdgeTypeNames()) result.set(name, 'host');
    return Array.from(result.entries()).map(([name, source]) => ({ name, source }));
  }
}

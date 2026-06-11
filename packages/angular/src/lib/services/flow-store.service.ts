import { Injectable, OnDestroy, signal, computed, type WritableSignal, type Signal } from '@angular/core';
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
  type HandleType,
} from '@angflow/system';

import type { Node, Edge } from '../types';
import type { NodeTemplateSpec } from '../types/node-template';
import { applyNodeChanges, applyEdgeChanges, createSelectionChange, getSelectionChanges } from '../utils/changes';
import { sampleTween, prefersReducedMotion, type TweenEntry } from '../utils/position-tween';
import { getCollapsedHiddenIds, rewriteEdgesForCollapse, type DisplayEdge } from '../graph/collapse';

/**
 * Content equality for derived string-id sets. Used as a computed `equal` so
 * a recompute that lands on identical membership keeps the previous Set
 * identity and does not notify consumers. Exported for tests.
 */
export function stringSetEquals(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

@Injectable()
export class FlowStore<NodeType extends Node = Node, EdgeType extends Edge = Edge> implements OnDestroy {
  // ── Writable signals ──────────────────────────────────────────────────

  readonly rfId = signal('1');
  readonly width = signal(0);
  readonly height = signal(0);
  readonly transform: WritableSignal<Transform> = signal<Transform>([0, 0, 1]);

  // ── Handle data registry ──────────────────────────────────────────────
  // Keyed by `${nodeId}:${handleId === null ? '\u0000' : handleId}:${type}`.
  // The null-character sentinel distinguishes null from "". Populated by
  // HandleComponent.
  private readonly _handleData = signal<Map<string, unknown>>(new Map());

  /** Internal read-only accessor for reactive consumers (edge renderer, connection line). */
  readonly handleDataRegistry: Signal<Map<string, unknown>> = this._handleData.asReadonly();

  private handleKey(nodeId: string, handleId: string | null, type: HandleType): string {
    return `${nodeId}:${handleId === null ? '\u0000' : handleId}:${type}`;
  }

  /** Register or update a handle's user-supplied data. Pass `undefined` to clear. */
  registerHandleData(nodeId: string, handleId: string | null, type: HandleType, data: unknown): void {
    const key = this.handleKey(nodeId, handleId, type);
    const current = this._handleData();
    if (data === undefined) {
      if (!current.has(key)) return;
      const next = new Map(current);
      next.delete(key);
      this._handleData.set(next);
      return;
    }
    if (current.get(key) === data) return;
    const next = new Map(current);
    next.set(key, data);
    this._handleData.set(next);
  }

  /** Remove a handle's registration. Safe to call for unknown keys. */
  unregisterHandleData(nodeId: string, handleId: string | null, type: HandleType): void {
    const key = this.handleKey(nodeId, handleId, type);
    const current = this._handleData();
    if (!current.has(key)) return;
    const next = new Map(current);
    next.delete(key);
    this._handleData.set(next);
  }

  /** Public lookup helper. Returns undefined if no data is registered. */
  getHandleData(nodeId: string, handleId: string | null, type: HandleType): unknown {
    return this._handleData().get(this.handleKey(nodeId, handleId, type));
  }

  readonly nodes: WritableSignal<NodeType[]> = signal<NodeType[]>([]);
  readonly edges: WritableSignal<EdgeType[]> = signal<EdgeType[]>([]);

  readonly nodesInitialized = signal(false);

  readonly hasDefaultNodes = signal(false);
  readonly hasDefaultEdges = signal(false);

  readonly paneDragging = signal(false);
  readonly nodesSelectionActive = signal(false);
  readonly userSelectionActive = signal(false);

  /** Id of the node currently showing Stage 2 floating-drop feedback during a connection drag.
   *  Null when no candidate is active or when Stage 1 owns the drop target. */
  readonly connectionTargetNodeId = signal<string | null>(null);
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

  // ── Agent template registry & type discovery ─────────────────────────
  /** Data-driven node templates registered at runtime (via the agent bridge). */
  readonly nodeTemplates = signal<ReadonlyMap<string, NodeTemplateSpec>>(new Map());
  /** Type names supplied by the host via the `nodeTypes` input on <ng-flow>. */
  readonly hostNodeTypeNames = signal<string[]>([]);
  /** Type names supplied by the host via the `edgeTypes` input on <ng-flow>. */
  readonly hostEdgeTypeNames = signal<string[]>([]);
  /** Type names from content-projected `<ng-template ngFlowNodeType>` templates. */
  readonly contentNodeTemplateNames = signal<string[]>([]);

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
  /**
   * 'handles' (default): edges attach at declared handles. 'floating': edges
   * ignore handles and attach at the ray-rect intersection from each node's
   * border toward the peer node's center — zero handle boilerplate. Set via
   * the `edgeMode` input on `<ng-flow>`.
   */
  readonly edgeMode = signal<'handles' | 'floating'>('handles');

  /**
   * Animation master switch, mirrored from the `[animate]` input on
   * `<ng-flow>`: `false` (default) | `true` | `{ duration?: number }`.
   * Controls node entry animation and position tweening.
   */
  readonly animate = signal<boolean | { duration?: number }>(false);

  /** True when animations should run (input on, OS reduced-motion off). */
  animationEnabled(): boolean {
    const a = this.animate();
    return (a === true || (typeof a === 'object' && a !== null)) && !prefersReducedMotion();
  }

  /** Tween/entry duration in ms. Default 300. */
  animationDuration(): number {
    const a = this.animate();
    return typeof a === 'object' && a !== null && a.duration != null ? a.duration : 300;
  }

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

  // A version counter bumped on graph changes (node/edge add/remove/move,
  // selection, measurement) to trigger recomputation of visibleNodes /
  // visibleEdges without rebuilding the full nodeLookup. Deliberately NOT
  // bumped on transform (pan/zoom) writes — transform consumers read
  // this.transform() directly.
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

  readonly collapsedHiddenIds = computed(() => {
    this.version();
    return getCollapsedHiddenIds(this.nodeLookup);
  }, { equal: stringSetEquals });

  readonly visibleNodes: Signal<InternalNodeBase<NodeType>[]> = computed(() => {
    // Read version to trigger recomputation on any visual change (drag, add, remove)
    this.version();
    const hidden = this.collapsedHiddenIds();
    const base = !this.onlyRenderVisibleElements()
      ? Array.from(this.nodeLookup.values())
      : getNodesInside(this.nodeLookup, { x: 0, y: 0, width: this.width(), height: this.height() }, this.transform(), true);
    return hidden.size ? base.filter((n) => !hidden.has(n.id)) : base;
  });

  readonly displayEdges = computed<DisplayEdge<EdgeType>[]>(() => {
    this.version();
    const edges = this.edges();
    const hidden = this.collapsedHiddenIds();
    return hidden.size ? rewriteEdgesForCollapse(edges, this.nodeLookup, hidden) : (edges as DisplayEdge<EdgeType>[]);
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
  }, { equal: stringSetEquals });

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

  updateNodeInternals(updates: Map<string, any>): void {
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
      // A user drag takes ownership of the node — kill any in-flight tween.
      // Symmetric with tweenNodePositions skipping dragging nodes: drag cancels
      // tweens here; tweens skip nodes whose dragging flag is already set.
      if (this.positionTweens.size > 0) this.cancelPositionTween(id);
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

  // ── Position tweening ───────────────────────────────────────────────────
  // One shared rAF loop interpolates every active tween and pushes plain
  // position changes through triggerNodeChanges, so nodes AND edges re-render
  // together each frame (edges read store positions — CSS transforms would
  // detach them). Zoneless-safe: the rAF callback only writes signals.

  private readonly positionTweens = new Map<string, TweenEntry>();
  private tweenWaiters: Array<{ ids: Set<string>; resolve: () => void }> = [];
  private tweenRafId: number | null = null;
  private tweenDestroyed = false;

  /**
   * Animate the given nodes from their current positions to `positions` over
   * `duration` ms. Positions are in `node.position` space — parent-relative
   * for nodes with `parentId`, absolute for top-level nodes. This matches the
   * space that `triggerNodeChanges` writes, keeping from/to/emitted coherent.
   * Unknown ids and zero-distance moves are skipped. Resolves when every
   * requested node has finished (or had its tween cancelled by a drag /
   * retarget).
   */
  tweenNodePositions(positions: Record<string, { x: number; y: number }>, duration: number): Promise<void> {
    if (this.tweenDestroyed) return Promise.resolve();
    const start = performance.now();
    const ids: string[] = [];
    for (const [id, to] of Object.entries(positions)) {
      const node = this.nodeLookup.get(id);
      if (!node) continue;
      // A node mid-drag belongs to the user — don't fight the pointer.
      // (Symmetric with updateNodePositions cancelling tweens on drag.)
      if (node.dragging) continue;
      // Tween in node.position space (parent-relative for child nodes): this is
      // the space triggerNodeChanges writes, so from/to/emitted stay coherent.
      const current = node.position;
      const from = { x: current.x, y: current.y };
      if (from.x === to.x && from.y === to.y) {
        this.positionTweens.delete(id);
        continue;
      }
      // Retarget: overwriting the entry restarts from the live position.
      this.positionTweens.set(id, { from, to: { x: to.x, y: to.y }, start, duration });
      ids.push(id);
    }
    if (ids.length === 0) {
      this.settleTweenWaiters();
      return Promise.resolve();
    }
    this.ensureTweenLoop();
    return new Promise((resolve) => {
      this.tweenWaiters.push({ ids: new Set(ids), resolve });
    });
  }

  /** Cancel one node's active tween (no-op when none). Used by drag. */
  cancelPositionTween(id: string): void {
    if (this.positionTweens.delete(id)) {
      this.settleTweenWaiters();
    }
  }

  private ensureTweenLoop(): void {
    if (this.tweenDestroyed) return;
    if (this.tweenRafId !== null) return;
    const step = () => {
      const now = performance.now();
      const changes: NodeChange[] = [];
      const finished: string[] = [];
      for (const [id, entry] of this.positionTweens) {
        const { position, done } = sampleTween(entry, now);
        changes.push({ id, type: 'position', position });
        if (done) finished.push(id);
      }
      for (const id of finished) this.positionTweens.delete(id);
      if (changes.length > 0) {
        this.triggerNodeChanges(changes as NodeChange<NodeType>[]);
      }
      this.settleTweenWaiters();
      this.tweenRafId = this.positionTweens.size > 0 ? requestAnimationFrame(step) : null;
    };
    this.tweenRafId = requestAnimationFrame(step);
  }

  private settleTweenWaiters(): void {
    if (this.tweenWaiters.length === 0) return;
    this.tweenWaiters = this.tweenWaiters.filter((w) => {
      for (const id of w.ids) {
        if (this.positionTweens.has(id)) return true;
      }
      w.resolve();
      return false;
    });
  }

  ngOnDestroy(): void {
    this.tweenDestroyed = true;
    if (this.tweenRafId !== null) {
      cancelAnimationFrame(this.tweenRafId);
      this.tweenRafId = null;
    }
    this.positionTweens.clear();
    this.settleTweenWaiters();
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
      // Update user nodes array with new positions (cheap shallow copy)
      const currentNodes = this.nodes();
      const storeOrigin = this.nodeOrigin();
      let nodesChanged = false;
      let needsAbsoluteRecompute = false;

      for (const change of changes) {
        if (change.type !== 'position') continue;
        const internalNode = this.nodeLookup.get(change.id);
        if (!internalNode) continue;

        let mutated = false;

        // Update internal node position in-place (fast)
        if (change.position) {
          internalNode.position = change.position;
          if (internalNode.internals) {
            internalNode.internals.positionAbsolute = change.position;
          }
          // The verbatim `positionAbsolute = change.position` assignment above is
          // only correct for a top-level, origin-[0,0], childless node. It is wrong
          // and needs a full recompute when the moved node:
          //   - is parented (its absolute depends on the parent chain), or
          //   - is itself a parent (children's absolutes shift with it), or
          //   - has a non-zero effective origin (absolute = position − dims·origin).
          const origin = internalNode.origin ?? storeOrigin;
          if (
            internalNode.parentId ||
            this.parentLookup.has(change.id) ||
            origin[0] !== 0 ||
            origin[1] !== 0
          ) {
            needsAbsoluteRecompute = true;
          }
          mutated = true;
        }
        if (change.dragging !== undefined) {
          internalNode.dragging = change.dragging;
          mutated = true;
        }

        // Mirror the mutation onto the user-facing node reference so that
        // external consumers observing `nodes()` see consistent state.
        const userNode = internalNode.internals?.userNode as any;
        if (userNode) {
          if (change.position) {
            userNode.position = change.position;
          }
          if (change.dragging !== undefined) {
            userNode.dragging = change.dragging;
          }
        }

        if (mutated) {
          nodesChanged = true;
        }
      }

      // Recompute absolute positions when the verbatim assignment above is not
      // sufficient (parented nodes, group/parent moves, or non-default origins).
      // This walks the whole lookup, so it's gated to those runs — plain
      // top-level, origin-[0,0], childless drags keep the O(changes) fast path.
      if (needsAbsoluteRecompute) {
        updateAbsolutePositions(this.nodeLookup, this.parentLookup, {
          nodeOrigin: this.nodeOrigin(),
          nodeExtent: this.nodeExtent(),
          zIndexMode: this.zIndexMode(),
        });
      }

      if (nodesChanged) {
        // Bump version to trigger template re-render without full rebuild
        this.bumpVersion();
        // Re-emit the nodes signal so any downstream effect (e.g. the agent
        // bridge watcher) that depends on `nodes()` observes the drag. Objects
        // are mutated in place above so identity is preserved for templates;
        // parented nodes are the exception (updateAbsolutePositions swaps a fresh
        // lookup entry), but templates re-read the lookup so that churn is fine.
        // We only swap the array reference.
        this.nodes.set([...currentNodes]);
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
    this._handleData.set(new Map());
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

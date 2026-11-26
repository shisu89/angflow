import { Injectable, inject, computed, signal, DestroyRef, type Signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  pointToRendererPoint,
  rendererPointToPoint,
  getNodesBounds as getNodesBoundsSystem,
  getConnectedEdges as getConnectedEdgesSystem,
  getElementsToRemove,
  getOutgoers as getOutgoersSystem,
  getIncomers as getIncomersSystem,
  shallowNodeData,
  getConnectionsFromLookup,
  getFitViewport,
  getViewportForBounds,
  type XYPosition,
  type SnapGrid,
  type Viewport,
  type Rect,
  type FitViewOptionsBase,
  type FitBoundsOptions,
  type Padding,
  defaultFitViewPadding,
  type NodeConnection,
  type ConnectionState,
  type NodeBase,
  type InternalNodeUpdate,
  type HandleType,
  type NodeChange,
  type EdgeChange,
  addChange,
  removeChange,
  updateChange,
  dataChange,
  positionChange,
  replaceChange,
  changeParentNode,
} from '@angflow/system';

import { injectFlowStore } from '../utils/inject-flow-store';
import type { ViewportAnimationOptions } from './flow-store.service';
import type { Node, Edge, InternalNode, DeleteElementsOptions } from '../types';
import type { NodeTemplateSpec } from '../types/node-template';
import { prefersReducedMotion } from '../utils/position-tween';
import { getGroupBounds, type GroupBoundsOptions } from '../graph/group-bounds';
import { isNode, isEdge } from '../utils/type-guards';

/** Zoom at or below `minZoom + FIT_CLAMP_EPSILON` counts as clamped at the floor. */
const FIT_CLAMP_EPSILON = 1e-6;

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
 * zoomToFit() { this.flow.fitView({ padding: '10%' }); }
 * addNode(n: Node) { this.flow.addNodes(n); }
 * ```
 */
@Injectable()
export class NgFlowService<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  private store = injectFlowStore<NodeType, EdgeType>();
  private destroyRef = inject(DestroyRef);
  private readonly doc = inject(DOCUMENT, { optional: true });

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

  /**
   * Reactive connection state during a connection drag or the click-to-connect preview. `to` is in
   * flow coordinates, `pointer` in screen coordinates.
   */
  readonly connection: Signal<ConnectionState> = computed(() => this.store.connection());

  /** Reactive signal indicating whether all nodes have been measured and positioned. */
  readonly nodesInitialized: Signal<boolean> = computed(() => this.store.nodesInitialized());

  /** Reactive access to currently visible nodes (respects onlyRenderVisibleElements). */
  readonly visibleNodes: Signal<import('@angflow/system').InternalNodeBase<NodeType>[]> = computed(() => this.store.visibleNodes());

  /** Reactive access to IDs of currently visible edges (respects onlyRenderVisibleElements). */
  readonly visibleEdgeIds: Signal<Set<string>> = computed(() => this.store.visibleEdgeIds());

  // ── Viewport operations ───────────────────────────────────────────────

  /** Zoom the viewport in by one step. Optionally animate over `duration` ms (with `ease`/`interpolate`). Resolves `true` when the animation ran to the end and `false` when a user gesture or another viewport call interrupted it. */
  zoomIn(options?: ViewportAnimationOptions) {
    return this.store.zoomIn(options);
  }

  /** Zoom the viewport out by one step. Optionally animate over `duration` ms (with `ease`/`interpolate`). Resolves `true` when the animation ran to the end and `false` when a user gesture or another viewport call interrupted it. */
  zoomOut(options?: ViewportAnimationOptions) {
    return this.store.zoomOut(options);
  }

  /** Set the viewport zoom to an absolute level (clamped to `minZoom`/`maxZoom`). Resolves `true` when the animation ran to the end and `false` when a user gesture or another viewport call interrupted it. */
  zoomTo(zoomLevel: number, options?: ViewportAnimationOptions) {
    return this.store.zoomTo(zoomLevel, options);
  }

  /**
   * Zoom and pan so all nodes (or `options.nodes`) fit in the canvas.
   * Respects `minZoom`, `maxZoom`, and `padding`.
   * Resolves `true` when the fit ran to the end or there was nothing to fit, and `false` when a user
   * gesture or another viewport call interrupted it, or pan/zoom isn't initialised.
   * Overlapping `fitView` calls share one promise, which settles with the last fit's result.
   */
  fitView(options?: FitViewOptionsBase<NodeType>): Promise<boolean> {
    return this.store.fitView(options);
  }

  /** Set the viewport to an absolute `{ x, y, zoom }`. Optionally animate (`duration`/`ease`/`interpolate`). Resolves `true` when the animation ran to the end and `false` when a user gesture or another viewport call interrupted it. */
  setViewport(viewport: Viewport, options?: ViewportAnimationOptions) {
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

  /** Center the viewport on a flow-space coordinate. Optionally animate (`duration`/`ease`/`interpolate`). Resolves `true` when the animation ran to the end and `false` when a user gesture or another viewport call interrupted it. */
  setCenter(x: number, y: number, options?: ViewportAnimationOptions & { zoom?: number }) {
    return this.store.setCenter(x, y, options);
  }

  /**
   * Fit the viewport to a specific `Rect` in flow coordinates. `minZoom`/`maxZoom` are an angflow extension.
   * Resolves `true` when the fit ran to the end, and `false` when a user gesture or another viewport call
   * interrupted it, or pan/zoom isn't initialised. Overlapping `fitBounds` calls share one promise, which
   * settles with the last call's result.
   */
  fitBounds(bounds: Rect, options?: FitBoundsOptions & { minZoom?: number; maxZoom?: number }): Promise<boolean> {
    return this.store.fitBounds(bounds, options);
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

  /**
   * Resolve a node's absolute (flow-space) top-left position by walking the
   * `parentId` chain from the current store state. Correct immediately after
   * `applyLayout` / `setNodePositions`, regardless of tween timing — unlike a
   * raw read of `internals.positionAbsolute`, which a caller may observe before
   * the derived value is recomputed. Returns `null` for an unknown id.
   *
   * Does NOT apply `extent` clamping — it returns the unclamped chain sum. For a
   * clamped absolute, read `getInternalNode(id)?.internals.positionAbsolute`.
   */
  getAbsolutePosition(id: string): { x: number; y: number } | null {
    const lookup = this.store.nodeLookup;
    const storeOrigin = this.store.nodeOrigin();
    let cur = lookup.get(id);
    if (!cur) return null;
    let x = 0;
    let y = 0;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const origin = cur.origin ?? storeOrigin;
      const w = cur.measured?.width ?? cur.width ?? cur.initialWidth ?? 0;
      const h = cur.measured?.height ?? cur.height ?? cur.initialHeight ?? 0;
      x += cur.position.x - w * origin[0];
      y += cur.position.y - h * origin[1];
      cur = cur.parentId ? lookup.get(cur.parentId) : undefined;
    }
    return { x, y };
  }

  /** Replace the full `nodes` array. Triggers `(nodesChange)` through the store. */
  setNodes(nodes: NodeType[]): void {
    this.store.setNodes(nodes);
  }

  /** Append one or more nodes to the current array. */
  addNodes(nodes: NodeType | NodeType[]): void {
    const toAdd = Array.isArray(nodes) ? nodes : [nodes];
    if (!toAdd.length) return;
    this.store.triggerNodeChanges(toAdd.map((item) => addChange(item)));
  }

  /**
   * Update a single node with a partial (or an updater function, resolved
   * against the current node first). Other nodes are left untouched; an
   * unknown id is a no-op.
   *
   * With `options.replace` and a full node, emits one `'replace'` change.
   * Otherwise the partial is split as Svelte Flow does, in one changeset:
   * - a `'position'` change when `position` differs from the current one;
   * - a `'data'` change replacing `data` when it is present and a new object;
   * - an `'update'` change carrying the remaining keys, if any. A key set to
   *   `undefined` there clears that field.
   */
  updateNode(
    id: string,
    nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>),
    options: { replace: boolean } = { replace: false },
  ): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    const nextNode = typeof nodeUpdate === 'function' ? nodeUpdate(current) : nodeUpdate;

    const changes: NodeChange<NodeType>[] = [];
    if (options.replace && isNode<NodeType>(nextNode)) {
      changes.push(replaceChange(nextNode));
    } else {
      const { position, data, ...rest } = nextNode;
      if (position && (position.x !== current.position.x || position.y !== current.position.y)) {
        changes.push(positionChange(id, position));
      }
      if (data && data !== current.data) {
        changes.push(dataChange<NodeType['data']>(id, data, true));
      }
      if (Object.keys(rest).length > 0) {
        changes.push(updateChange<NodeType>(id, rest as Partial<NodeType>));
      }
    }

    // Always the immutable full path: a position-only changeset would otherwise
    // take the in-place fast path and mutate the host's own node object.
    if (changes.length > 0) this.store.triggerNodeChanges(changes, { allowFastPath: false });
  }

  /**
   * Update a node's `data`. An updater function receives the current **node**
   * (not its `data`). Emits a `'data'` change: a shallow merge into the
   * existing `data`, or a full replacement with `options.replace`. An unknown
   * id is a no-op.
   *
   * @example
   * ```typescript
   * flow.updateNodeData('1', { label: 'Renamed' });
   * flow.updateNodeData('1', (node) => ({ count: (node.data['count'] as number) + 1 }));
   * flow.updateNodeData('1', { label: 'Only key left' }, { replace: true });
   * ```
   */
  updateNodeData(
    id: string,
    dataUpdate: Partial<NodeType['data']> | ((node: NodeType) => Partial<NodeType['data']>),
    options: { replace: boolean } = { replace: false },
  ): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    const nextData = typeof dataUpdate === 'function' ? dataUpdate(current) : dataUpdate;
    this.store.triggerNodeChanges([
      options.replace
        ? dataChange<NodeType['data']>(id, nextData as NodeType['data'], true)
        : dataChange<NodeType['data']>(id, nextData),
    ]);
  }

  /**
   * Changes the parent of a node, keeping it visually in place. Equivalent to
   * React's `changeParent`.
   *
   * `parentId === null` moves the node to the top level. The new position is
   * computed by `changeParentNode` from `@angflow/system` (origin-corrected
   * with the node's own `origin`, falling back to `nodeOrigin`) and applied
   * through one `updateNode` call, so the changeset holds an `'update'`
   * change (`parentId`) and, when the relative position differs, a
   * `'position'` change. `parentId === nodeId` is a no-op; a missing node
   * or parent logs a warning and changes nothing. The caller must avoid
   * cycles (a parent that is a descendant of the node).
   */
  changeParent(nodeId: string, parentId: string | null): void {
    changeParentNode(
      nodeId,
      this.store.nodeLookup,
      parentId,
      this.store.nodeOrigin(),
      ({ nodeId: id, parentId: nextParentId, x, y }) => {
        this.updateNode(id, { parentId: nextParentId ?? undefined, position: { x, y } } as Partial<NodeType>);
      },
    );
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
   * Create a `type:'group'` node wrapping the given nodes, reparent them into it,
   * and pin them visually (their absolute positions are preserved). Returns the
   * group id. The group box wraps members with `padding`/`headerHeight` insets.
   */
  async groupNodes(
    nodeIds: string[],
    opts?: { groupId?: string; label?: string; collapsed?: boolean; padding?: number; headerHeight?: number },
  ): Promise<string> {
    const groupId = opts?.groupId ?? `group_${nodeIds.join('-')}`;
    if (this.getNode(groupId)) {
      throw new Error(`groupNodes: a node with id "${groupId}" already exists.`);
    }
    const members = nodeIds
      .map((id) => this.getInternalNode(id))
      .filter((n): n is InternalNode<NodeType> => n != null);
    const abs: Record<string, { x: number; y: number }> = {};
    const memberBoxes: { position: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number | null; height?: number | null }[] = [];
    for (const m of members) {
      const a = this.getAbsolutePosition(m.id);
      if (!a) continue;
      abs[m.id] = a;
      memberBoxes.push({ position: a, measured: m.measured, width: m.width, height: m.height });
    }
    const box = getGroupBounds(memberBoxes, {
      padding: opts?.padding ?? 20,
      headerHeight: opts?.headerHeight ?? 40,
    });
    // One atomic emission: add the group node and reparent members together.
    this.store.batch(() => {
      this.addNodes({
        id: groupId,
        type: 'group',
        position: box.position,
        width: box.width,
        height: box.height,
        data: opts?.label != null ? { label: opts.label } : {},
        ...(opts?.collapsed != null ? { collapsed: opts.collapsed } : {}),
      } as unknown as NodeType);
      for (const m of members) this.updateNode(m.id, { parentId: groupId } as Partial<NodeType>);
    });
    await this.setNodePositions(
      { [groupId]: box.position, ...abs },
      { coordinateSpace: 'absolute', animate: false },
    );
    return groupId;
  }

  /**
   * Reparent a node into `groupId` (or detach to top-level when `null`), keeping
   * it visually fixed. Caller must ensure no cycle (the agent bridge guards this).
   * Delegates to {@link changeParent}, so the reparent is one synchronous
   * changeset; the returned promise is already settled when it resolves.
   * Detaching (`null`) a node with `extent: 'parent'` also clears `extent` in
   * that changeset, as {@link dissolveGroup} does: a top-level node cannot use a
   * parent extent (error 005 on every drag frame otherwise).
   * A missing node or a missing (non-null) group is a silent no-op.
   */
  async setNodeGroup(nodeId: string, groupId: string | null): Promise<void> {
    const node = this.getNode(nodeId);
    if (!node) return;
    // Don't orphan parentId against a non-existent group (corrupts absolute coords).
    if (groupId != null && !this.getNode(groupId)) return;
    if (groupId != null || node.extent !== 'parent') {
      this.changeParent(nodeId, groupId);
      return;
    }
    // changeParent stays verbatim with upstream React; the extent clear is
    // angflow-only, so it rides on the same updateNode call here.
    changeParentNode(nodeId, this.store.nodeLookup, null, this.store.nodeOrigin(), ({ nodeId: id, x, y }) => {
      this.updateNode(id, { parentId: undefined, extent: undefined, position: { x, y } } as Partial<NodeType>);
    });
  }

  /**
   * Remove a group node; its direct children survive. Returns the freed ids.
   *
   * The children are first reparented to the group's own parent (top-level if
   * it had none) in one raw `replace` write, staying where they are drawn
   * (`internals.positionAbsolute`, including any `extent: 'parent'` clamp; the one
   * exception is an `extent: 'parent'` child overhanging a grandparent, which the
   * grandparent's clamp pulls inside). A
   * child of a top-level group loses `extent: 'parent'`; under a grandparent it
   * keeps it. Only then is the group deleted, so `onBeforeDelete` sees just the
   * group and its connected edges. If the group survives (a veto, a narrowing
   * hook that keeps it, or a `deletable: false` group) the children's raw
   * `parentId`/`position`/`extent` are restored and `[]` is returned. The
   * intermediate reparent is visible in `(nodesChange)`.
   *
   * While an async `onBeforeDelete` is pending, the children are already
   * reparented. A veto restores the parent/position/extent captured before the
   * reparent, so a move made to a child in the meantime is reverted.
   */
  async dissolveGroup(groupId: string): Promise<string[]> {
    const group = this.getNode(groupId);
    if (!group) return [];
    const newParentId = group.parentId;
    const children = this.getNodes().filter((n) => n.parentId === groupId);

    // Capture while the group still exists.
    const raw: Record<string, { parentId?: string; position: XYPosition; extent: NodeType['extent'] }> = {};
    const next: Record<string, XYPosition> = {};
    const newParentPA = newParentId
      ? (this.getInternalNode(newParentId)?.internals.positionAbsolute ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };
    for (const c of children) {
      raw[c.id] = { parentId: c.parentId, position: { ...c.position }, extent: c.extent };
      const internal = this.getInternalNode(c.id);
      next[c.id] = internal
        ? this.absoluteToRelative(internal, internal.internals.positionAbsolute, newParentPA)
        : { x: c.position.x + group.position.x, y: c.position.y + group.position.y };
    }

    if (children.length > 0) {
      this.store.triggerNodeChanges(
        children.map((c) => ({
          id: c.id,
          type: 'replace',
          item: {
            ...c,
            parentId: newParentId,
            position: next[c.id],
            ...(c.extent === 'parent' && newParentId === undefined ? { extent: undefined } : {}),
          },
        })) as NodeChange<NodeType>[],
      );
    }

    const restore = (): void => {
      const surviving = children.map((c) => this.getNode(c.id)).filter((n): n is NodeType => !!n);
      if (surviving.length === 0) return;
      this.store.triggerNodeChanges(
        surviving.map((current) => ({
          id: current.id,
          type: 'replace',
          item: { ...current, ...raw[current.id] },
        })) as NodeChange<NodeType>[],
      );
    };

    let deletedNodes: NodeType[];
    try {
      ({ deletedNodes } = await this.deleteElements({ nodes: [{ id: groupId } as NodeType] }));
    } catch (err) {
      restore(); // a throwing/rejecting onBeforeDelete must not leave the children reparented
      throw err;
    }

    if (!deletedNodes.some((n) => n.id === groupId)) {
      restore();
      return [];
    }
    return children.map((c) => this.getNode(c.id)).filter((n): n is NodeType => !!n).map((n) => n.id);
  }

  /**
   * Current rendered box of a group on the canvas: absolute top-left +
   * measured (or declared) size. Returns null for an unknown id.
   */
  getGroupBox(groupId: string): { x: number; y: number; width: number; height: number } | null {
    const node = this.getNode(groupId);
    if (!node) return null;
    const pos = this.getAbsolutePosition(groupId) ?? node.position;
    const internal = this.getInternalNode(groupId);
    const width = internal?.measured?.width ?? node.width ?? 0;
    const height = internal?.measured?.height ?? node.height ?? 0;
    return { x: pos.x, y: pos.y, width, height };
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
    for (const [id, abs] of Object.entries(positions)) {
      const node = this.store.nodeLookup.get(id);
      const parent = node?.parentId ? this.store.nodeLookup.get(node.parentId) : undefined;
      if (!node || !parent) {
        out[id] = abs;
        continue;
      }
      const pAbs = positions[node.parentId!] ?? parent.internals.positionAbsolute;
      out[id] = this.absoluteToRelative(node, abs, pAbs);
    }
    return out;
  }

  /** Inverse of the store's child transform: the raw `position` that draws `node` at `abs` under a parent drawn at `parentAbs`. */
  private absoluteToRelative(node: InternalNode<NodeType>, abs: XYPosition, parentAbs: XYPosition): XYPosition {
    const origin = node.origin ?? this.store.nodeOrigin();
    const w = node.measured?.width ?? node.width ?? node.initialWidth ?? 0;
    const h = node.measured?.height ?? node.height ?? node.initialHeight ?? 0;
    return { x: abs.x - parentAbs.x + w * origin[0], y: abs.y - parentAbs.y + h * origin[1] };
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
      // Fallback for not-yet-measured nodes: a user NodeType lacks `internals`/`measured`,
      // so it cannot be proven an InternalNode<NodeType>; layout reads only position/id.
      this.getNodes().map((n) => this.getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>)),
    );
    const edges = this.withLiveEdgeLabels(this.getEdges());
    // Omit<O & {animate,coordinateSpace}, 'animate'|'coordinateSpace'> is structurally O but
    // TS can't prove it; the stripped keys are exactly the two we destructured out.
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
   * when present, so `layoutNodes` can reserve dagre space for the label.
   * Edges render their label as an SVG
   * `<g class="xy-flow__edge-textwrapper">` inside the edge's `<g data-id>`;
   * it is measured with `getBBox()`, which is in the label's own user units
   * (flow units, unaffected by the viewport zoom) and includes the background
   * rect's padding. Reads only; returns shallow clones. Edges with no rendered
   * label pass through unchanged.
   */
  private withLiveEdgeLabels(edges: EdgeType[]): EdgeType[] {
    const container = this.store.domNode();
    if (!container) return edges;
    return edges.map((e) => {
      const escaped = NgFlowService.cssEscapeId(e.id);
      // Custom edges render their label through BaseEdgeComponent inside the
      // `.ng-flow__custom-edge` overlay, which is tagged with the edge id.
      const el = (container.querySelector(
        `.xy-flow__edge [data-id="${escaped}"] .xy-flow__edge-textwrapper`,
      ) ?? container.querySelector(
        `.ng-flow__custom-edge[data-edge-label-for="${escaped}"] .xy-flow__edge-textwrapper`,
      )) as SVGGraphicsElement | null;
      const box = el?.getBBox?.();
      if (!box) return e;
      const labelWidth = box.width;
      const labelHeight = box.height;
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
    this.store.triggerEdgeChanges(toAdd.map((item) => addChange(item)));
  }

  /**
   * Update a single edge with a partial (or an updater function, resolved
   * against the current edge first). An unknown id is a no-op.
   *
   * With `options.replace` and a full edge, emits one `'replace'` change.
   * Otherwise the partial is split: a `'data'` change replacing `data` when
   * it is present and a new object, and an `'update'` change carrying the
   * remaining keys, if any.
   */
  updateEdge(
    id: string,
    edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>),
    options: { replace: boolean } = { replace: false },
  ): void {
    const current = this.store.edges().find((e) => e.id === id);
    if (!current) return;
    const nextEdge = typeof edgeUpdate === 'function' ? edgeUpdate(current) : edgeUpdate;

    const changes: EdgeChange<EdgeType>[] = [];
    if (options.replace && isEdge<EdgeType>(nextEdge)) {
      changes.push(replaceChange(nextEdge));
    } else {
      const { data, ...rest } = nextEdge;
      if (data && data !== current.data) {
        changes.push(dataChange<NonNullable<EdgeType['data']>>(id, data, true));
      }
      if (Object.keys(rest).length > 0) {
        changes.push(updateChange<EdgeType>(id, rest as Partial<EdgeType>));
      }
    }

    if (changes.length > 0) this.store.triggerEdgeChanges(changes);
  }

  /**
   * Update an edge's `data`. An updater function receives the current **edge**
   * (not its `data`). Emits a `'data'` change: a shallow merge into the
   * existing `data`, or a full replacement with `options.replace`. An unknown
   * id is a no-op.
   */
  updateEdgeData(
    id: string,
    dataUpdate: Partial<EdgeType['data']> | ((edge: EdgeType) => Partial<EdgeType['data']>),
    options: { replace: boolean } = { replace: false },
  ): void {
    const current = this.store.edges().find((e) => e.id === id);
    if (!current) return;
    const nextData = typeof dataUpdate === 'function' ? dataUpdate(current) : dataUpdate;
    type EdgeData = NonNullable<EdgeType['data']>;
    this.store.triggerEdgeChanges([
      options.replace
        ? dataChange<EdgeData>(id, nextData as EdgeData, true)
        : dataChange<EdgeData>(id, nextData as Partial<EdgeData>),
    ]);
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
   * @internal Agent-bridge helper, not public API (like hasOnBeforeDeleteHook): the zoom
   * `fitView(options)` would land on and whether the min-zoom floor clamps it, from the same
   * inputs as the fit. `null` when there is nothing to fit or pan/zoom isn't initialised.
   */
  measureFitView(options?: FitViewOptionsBase<NodeType>): { zoom: number; clamped: boolean } | null {
    if (!this.store.panZoom()) return null;
    const viewport = getFitViewport(
      {
        nodes: this.store.nodeLookup,
        width: this.store.width(),
        height: this.store.height(),
        minZoom: this.store.minZoom(),
        maxZoom: this.store.maxZoom(),
      },
      options
    );
    if (!viewport) return null;
    const effMin = options?.minZoom ?? this.store.minZoom();
    return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + FIT_CLAMP_EPSILON };
  }

  /** @internal Agent-bridge helper: the target of `fitBounds(bounds, options)`; `null` without pan/zoom. */
  measureFitBounds(
    bounds: Rect,
    options?: { padding?: Padding; minZoom?: number; maxZoom?: number }
  ): { zoom: number; clamped: boolean } | null {
    if (!this.store.panZoom()) return null;
    const effMin = options?.minZoom ?? this.store.minZoom();
    const effMax = options?.maxZoom ?? this.store.maxZoom();
    const viewport = getViewportForBounds(bounds, this.store.width(), this.store.height(), effMin, effMax, options?.padding ?? defaultFitViewPadding);
    return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + FIT_CLAMP_EPSILON };
  }

  /**
   * Delete the specified nodes and/or edges, like pressing the delete key
   * (upstream `useReactFlow().deleteElements`). `{ id }` stubs are accepted.
   *
   * - Deleting a node also deletes its descendants (child nodes, recursively).
   * - Nodes and edges with `deletable: false` are skipped; a protected child of
   *   a deleted parent survives and keeps its now-dangling `parentId`.
   * - Deletable edges connected to deleted nodes are included.
   * - If an `onBeforeDelete` hook is set it receives the matched set and may
   *   return `false` to cancel, `true` to proceed, or `{ nodes, edges }` to
   *   delete exactly that set instead (sync or async). It is never called with
   *   an empty set.
   * - `onEdgesDelete`, `onNodesDelete` and `onDelete` each fire once, before
   *   their removal is applied.
   *
   * @returns The nodes and edges that were actually deleted (empty arrays if
   *          `onBeforeDelete` vetoed the deletion).
   */
  async deleteElements(params: DeleteElementsOptions): Promise<{ deletedNodes: NodeType[]; deletedEdges: EdgeType[] }> {
    const hook = this.store.onBeforeDelete;
    const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove<NodeType, EdgeType>({
      nodesToRemove: (params.nodes ?? []) as Partial<NodeType>[],
      edgesToRemove: (params.edges ?? []) as Partial<EdgeType>[],
      nodes: this.store.nodes(),
      edges: this.store.edges(),
      // Angflow never asks the host about an empty set.
      onBeforeDelete: hook
        ? async (p) => (p.nodes.length === 0 && p.edges.length === 0 ? true : hook(p))
        : undefined,
    });

    if (matchingEdges.length > 0) {
      this.store.onEdgesDelete?.(matchingEdges);
      this.store.triggerEdgeChanges(matchingEdges.map((e) => removeChange(e.id)));
    }
    if (matchingNodes.length > 0) {
      this.store.onNodesDelete?.(matchingNodes);
      this.store.triggerNodeChanges(matchingNodes.map((n) => removeChange(n.id)));
    }
    if (matchingNodes.length > 0 || matchingEdges.length > 0) {
      this.store.onDelete?.({ nodes: matchingNodes, edges: matchingEdges });
    }

    return { deletedNodes: matchingNodes, deletedEdges: matchingEdges };
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
    return getNodesBoundsSystem(nodes, { nodeLookup: this.store.nodeLookup, nodeOrigin: this.store.nodeOrigin() });
  }

  /**
   * Ids of all nodes currently hidden because an ancestor group is collapsed
   * (nesting-aware). Non-reactive snapshot — prefer the store signal in templates.
   */
  getCollapsedHiddenIds(): string[] {
    return Array.from(this.store.collapsedHiddenIds());
  }

  // ── Connection Queries ────────────────────────────────────────────────

  /** Return all edges that are incident to any of the given node ids (either end). */
  getConnectedEdges(nodeIds: string | string[]): EdgeType[] {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    // getConnectedEdges only reads `.id`; pass id-only stubs as NodeBase.
    const nodeObjects = ids.map(id => ({ id })) as NodeBase[];
    return getConnectedEdgesSystem<NodeBase, EdgeType>(nodeObjects, this.store.edges());
  }

  /**
   * Connections of a node (`Connection & { edgeId }`), optionally narrowed to one handle type
   * and, together with `type`, one handle id. A `handleId` without a `type` is ignored, as upstream.
   */
  getNodeConnections(params: { nodeId: string; type?: HandleType | null; handleId?: string | null }): NodeConnection[] {
    return getConnectionsFromLookup(this.store.connectionLookup, params);
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
    }, { equal: shallowNodeData });
  }

  /**
   * Returns a signal with the connections of a node, optionally narrowed by handle type and handle id.
   * Equivalent to React's `useNodeConnections({ id, handleType, handleId })`.
   */
  selectNodeConnections(params: { nodeId: string; type?: HandleType | null; handleId?: string | null }): Signal<NodeConnection[]> {
    return computed(() => {
      this.store.version();
      return getConnectionsFromLookup(this.store.connectionLookup, params);
    });
  }

  /**
   * Returns a signal with the user node for a given ID (`undefined` when missing).
   * Notifies when the node object, its `position` or its `dragging` flag changes
   * (the drag fast path mutates nodes in place), not when other nodes change.
   * Equivalent to React's `useNode()`.
   */
  selectNode(nodeId: string): Signal<NodeType | undefined> {
    // The drag fast path mutates the user node in place (assigning fresh
    // `position` objects and a new `dragging` value), so the node's identity
    // alone misses moves. Track a snapshot of those fields, then notify
    // whenever the snapshot changes.
    const snapshot = computed(
      () => {
        // nodes() is read for the dependency only. setNodes updates the lookup
        // before writing nodes(), and its internals.userNode is the very object
        // held in nodes() (the fast path mutates that same object), so the O(1)
        // lookup returns what find() would.
        this.store.nodes();
        const node = this.store.nodeLookup.get(nodeId)?.internals.userNode;
        return [node, node?.position, node?.dragging] as const;
      },
      { equal: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
    );
    return computed(() => snapshot()[0], { equal: () => false });
  }

  /**
   * Returns a signal with the edge for a given ID (`undefined` when missing).
   * Notifies only when the edge object itself changes, not when other edges change.
   * Equivalent to React's `useEdge()`.
   */
  selectEdge(edgeId: string): Signal<EdgeType | undefined> {
    return computed(() => {
      // edges() is read for the dependency only; setEdges fills the edge lookup
      // with the same objects before writing edges().
      this.store.edges();
      return this.store.edgeLookup.get(edgeId);
    });
  }

  /**
   * Returns a signal with the internal nodes for the given IDs, in the given
   * order. Duplicate IDs are collapsed and missing IDs are skipped. Notifies when
   * a tracked node, its position or its `dragging` flag changes.
   * Equivalent to React's `useInternalNodes()`.
   */
  selectInternalNodes(nodeIds: readonly string[]): Signal<InternalNode<NodeType>[]> {
    // Snapshot of each node plus the fields the drag fast path writes in place
    // (position, positionAbsolute, dragging); see selectNode.
    const snapshot = computed(
      () => {
        this.store.version();
        const flat: unknown[] = [];
        for (const id of new Set(nodeIds)) {
          const node = this.store.nodeLookup.get(id) as InternalNode<NodeType> | undefined;
          if (node) // positionAbsolute is compared by value: updateAbsolutePositions reassigns a fresh
          // object for every root node on parented moves.
          flat.push(node, node.position, node.internals?.positionAbsolute?.x, node.internals?.positionAbsolute?.y, node.dragging);
        }
        return flat;
      },
      { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
    );
    return computed(
      () => {
        const flat = snapshot();
        const result: InternalNode<NodeType>[] = [];
        for (let i = 0; i < flat.length; i += 5) result.push(flat[i] as InternalNode<NodeType>);
        return result;
      },
      { equal: () => false },
    );
  }

  /**
   * Returns a signal with the internal node for a given ID.
   * Equivalent to React's `useInternalNode()`.
   */
  selectInternalNode(nodeId: string): Signal<InternalNode<NodeType> | undefined> {
    // See selectNode: the drag fast path mutates in place, so track the fields it writes.
    const snapshot = computed(
      () => {
        this.store.version();
        const node = this.store.nodeLookup.get(nodeId) as InternalNode<NodeType> | undefined;
        // positionAbsolute by value: updateAbsolutePositions reassigns a fresh object per root node.
        const abs = node?.internals?.positionAbsolute;
        return [node, node?.position, abs?.x, abs?.y, node?.dragging] as const;
      },
      { equal: (a, b) => a.every((v, i) => v === b[i]) },
    );
    return computed(() => snapshot()[0], { equal: () => false });
  }

  /**
   * Returns a signal indicating whether all nodes have been initialized (have
   * measured dimensions). Equivalent to React's `useNodesInitialized()`.
   *
   * By default `hidden` nodes are ignored (they are never measured). Pass
   * `{ includeHiddenNodes: true }` to require hidden nodes to be measured too.
   */
  selectNodesInitialized(options?: { includeHiddenNodes?: boolean }): Signal<boolean> {
    if (!options?.includeHiddenNodes) return this.store.nodesInitialized;
    return computed(() => {
      this.store.version();
      const lookup = this.store.nodeLookup;
      if (lookup.size === 0) return false;
      for (const node of lookup.values()) {
        const m = node.measured;
        if (!m || m.width === undefined || m.height === undefined) return false;
      }
      return true;
    });
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
      const nodeEl = domNode.querySelector(
        `[data-id="${NgFlowService.cssEscapeId(id)}"]`,
      ) as HTMLDivElement | null;
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

  private readonly keyPressedSignals = new Map<string, Signal<boolean>>();

  /**
   * Returns a signal that tracks whether a specific key (or any key in an array) is currently pressed.
   * Equivalent to React's `useKeyPress()`. Signals are cached per key set, so
   * repeated calls don't stack document listeners. SSR-safe: returns an inert
   * `false` signal when `document` is unavailable.
   * Automatically cleaned up when the service is destroyed.
   */
  selectKeyPressed(keyCode: string | string[]): Signal<boolean> {
    const keys = Array.isArray(keyCode) ? keyCode : [keyCode];
    const cacheKey = keys.join('\0');
    const cached = this.keyPressedSignals.get(cacheKey);
    if (cached) return cached;

    if (!this.doc) {
      const inert = signal(false).asReadonly();
      this.keyPressedSignals.set(cacheKey, inert);
      return inert;
    }

    // Each spec is a '+'-separated combo whose parts must all be held together;
    // the signal is true when ANY spec matches. Parts match against both
    // KeyboardEvent.key and .code, so 'a', 'KeyA', 'Meta+a', 'Control+Shift+s'
    // all work. A plain 'Shift' or an array ['a','d'] behaves as before.
    const keySpecs = keys.map((k) => k.split('+').map((s) => s.trim()).filter(Boolean));
    const downKeys = new Set<string>();
    const matches = () => keySpecs.some((parts) => parts.length > 0 && parts.every((p) => downKeys.has(p)));

    const pressed = signal(false);
    const onKeyDown = (e: KeyboardEvent) => {
      downKeys.add(e.key);
      downKeys.add(e.code);
      pressed.set(matches());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      downKeys.delete(e.key);
      downKeys.delete(e.code);
      pressed.set(matches());
    };
    // Reset on blur: keyup is not delivered after the window loses focus
    // (Cmd/Alt+Tab, native menus), which would otherwise leave the key stuck.
    const onBlur = () => {
      downKeys.clear();
      pressed.set(false);
    };
    const win = this.doc.defaultView;

    this.doc.addEventListener('keydown', onKeyDown);
    this.doc.addEventListener('keyup', onKeyUp);
    win?.addEventListener('blur', onBlur);

    this.destroyRef.onDestroy(() => {
      this.doc!.removeEventListener('keydown', onKeyDown);
      this.doc!.removeEventListener('keyup', onKeyUp);
      win?.removeEventListener('blur', onBlur);
    });

    const readonlySignal = pressed.asReadonly();
    this.keyPressedSignals.set(cacheKey, readonlySignal);
    return readonlySignal;
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
      return getOutgoersSystem<NodeType, EdgeType>(node, nodes, edges);
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
      return getIncomersSystem<NodeType, EdgeType>(node, nodes, edges);
    });
  }

  /**
   * Returns a reactive signal of all edges connected to a given node ID (as source or target).
   */
  selectConnectedEdges(nodeId: string): Signal<EdgeType[]> {
    return computed(() => {
      this.store.version();
      return getConnectedEdgesSystem<NodeBase, EdgeType>(
        [{ id: nodeId }] as NodeBase[],
        this.store.edges()
      );
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

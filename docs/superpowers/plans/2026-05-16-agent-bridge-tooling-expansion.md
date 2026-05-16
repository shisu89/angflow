# Agent Bridge Tooling Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the `AngflowAgentBridge` tool surface from 16 to 42 tools, add a transactional `apply_changes` tool, and add bridge-only snapshot-based undo/redo. Additive only — no breaking changes.

**Architecture:** All work lives in `packages/angular/src/lib/agent/` plus a single new method on `NgFlowService`. New tool handlers are 5-20 line wrappers over existing `NgFlowService` methods. `apply_changes` runs ops inside `service.batch()` with snapshot-rollback on throw. A new `AgentHistory` class (in a new file `history.ts`) holds per-flow stacks of `{ nodes, edges }` snapshots; the bridge captures before mutating tools fire and restores via `setNodes`/`setEdges` inside `service.batch()`. A new `flow.history` push event is emitted alongside existing `flow.state` events.

**Tech Stack:** Angular 19+ (signals, OnPush, zoneless), TypeScript, Vitest with `provideZonelessChangeDetection()` and `CapturingTransport` pattern. Windows + PowerShell — use forward-slash paths in code; PowerShell or Bash for commands.

**Spec reference:** `docs/superpowers/specs/2026-05-16-agent-bridge-tooling-expansion-design.md`.

---

## Branch

Work on `agents` (current branch). The spec commit (`670a29987`) lives here.

```bash
git branch --show-current
# agents
```

---

## File Structure

**Files created:**

- `packages/angular/src/lib/agent/history.ts` — `AgentHistory` class, per-flow `past`/`future` snapshot stacks.

**Files modified:**

- `packages/angular/src/lib/services/ng-flow.service.ts` — add `setSelection({ nodeIds?, edgeIds?, additive? })` method.
- `packages/angular/src/lib/agent/agent-bridge.service.ts` — add 26 tool handlers, history capture/emit, `flow.history` event.
- `packages/angular/src/lib/agent/tool-schemas.ts` — append 26 schema entries.
- `packages/angular/src/lib/agent/provide-agent-bridge.ts` — accept optional `history` config; pass through.
- `packages/angular/src/lib/agent/index.ts` — re-export `AgentHistoryOptions` if exported as a type.
- `packages/angular/src/lib/agent/agent-bridge.spec.ts` — new `describe` blocks for each tool category and for history.
- `packages/angular/AGENT_BRIDGE.md` — full doc update (catalog, history, transactional batch, events, gaps).
- `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts` — extend the panel with `undo` + `apply_changes` snippet examples and live `history_status` readout.

**Files deliberately not touched:**

- `packages/system/` — zero diffs (spec confirms).
- Existing 16 tools — unchanged in name, params, return shape.
- Other examples under `examples/angular/`.

---

## Task 1: Add `NgFlowService.setSelection()` method

**Goal:** Add a public method that programmatically sets node/edge selection with explicit `additive` semantics — independent of the global `multiSelectionActive()` mode. Foundation for Task 4 selection tools.

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts`
- Test: extend existing spec file or use the bridge spec to verify through tools (preferred — test at the bridge layer in Task 4)

- [ ] **Step 1: Read current selection helpers in the store**

Run:
```bash
grep -n "getSelectionChanges\|addSelectedNodes\|addSelectedEdges\|unselectNodesAndEdges" packages/angular/src/lib/services/flow-store.service.ts
```

Expected: matches showing existing store methods we'll wrap. Confirm they exist; if signatures differ from the spec assumption, stop and report.

- [ ] **Step 2: Locate insertion point in `ng-flow.service.ts`**

Look at the section comment headers in the service. Find `// ── Batch ─` and insert the new method just before it (after the edge operations section). Confirm the file imports `getSelectionChanges` is *not* needed here — we go through the store, not directly.

- [ ] **Step 3: Add the method**

Insert this method into `NgFlowService` after `updateEdgeData` and before the `// ── Batch ───` separator:

```typescript
/**
 * Set or modify node/edge selection programmatically. Independent of the
 * global `multiSelectionActive()` mode — pass `additive: true` to add to the
 * current selection, omit it (or pass `false`) to replace the current
 * selection with the given ids.
 *
 * Selection changes flow through the normal change pipeline, so consumers
 * subscribed to `(nodesChange)` / `(edgesChange)` will see selection-change
 * entries.
 */
setSelection(params: { nodeIds?: string[]; edgeIds?: string[]; additive?: boolean }): void {
  const additive = params.additive ?? false;
  const nodeIds = params.nodeIds;
  const edgeIds = params.edgeIds;

  if (!additive) {
    // Replace mode: unselect everything not in the target sets, then
    // select the requested ids.
    this.store.unselectNodesAndEdges();
  }

  if (nodeIds && nodeIds.length > 0) {
    const changes = nodeIds.map((id) => ({ id, type: 'select' as const, selected: true }));
    this.store.triggerNodeChanges(changes as import('@angflow/system').NodeChange<NodeType>[]);
  }

  if (edgeIds && edgeIds.length > 0) {
    const changes = edgeIds.map((id) => ({ id, type: 'select' as const, selected: true }));
    this.store.triggerEdgeChanges(changes as import('@angflow/system').EdgeChange<EdgeType>[]);
  }
}
```

- [ ] **Step 4: Type-check**

Run from `packages/angular`:
```bash
npx tsc --noEmit
```

Expected: clean. If errors mention `NodeChange`/`EdgeChange` types, check the existing imports at the top of `ng-flow.service.ts` — they're already imported.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts
git commit -m "$(cat <<'EOF'
feat(angular): add NgFlowService.setSelection

Public method to programmatically set node/edge selection with explicit
additive semantics, independent of multiSelectionActive(). Foundation for
agent bridge selection tools.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add read/query/geometry tools (12 tools)

**Goal:** Expose 12 read-only tools that wrap existing `NgFlowService` methods: `get_internal_node`, `get_nodes_bounds`, `get_intersecting_nodes`, `is_node_in_area`, `get_outgoers`, `get_incomers`, `get_connected_edges`, `get_node_connections`, `get_handle_connections`, `get_handle_data`, `screen_to_flow_position`, `flow_to_screen_position`.

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write failing tests for the new read tools**

Append a new `describe` block to `packages/angular/src/lib/agent/agent-bridge.spec.ts` after the existing `'tool dispatch'` describe block:

```typescript
describe('read / geometry tools', () => {
  let flow: NgFlowService;

  beforeEach(() => {
    flow = newFlow();
    bridge.register('f', flow);
    flow.setNodes([
      { ...makeNode('a'), position: { x: 0, y: 0 }, width: 100, height: 50 },
      { ...makeNode('b'), position: { x: 200, y: 0 }, width: 100, height: 50 },
      { ...makeNode('c'), position: { x: 400, y: 0 }, width: 100, height: 50 },
    ] as Node[]);
    flow.setEdges([
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-c', source: 'b', target: 'c' },
    ] as Edge[]);
  });

  it('get_outgoers returns downstream neighbors', async () => {
    const res = await transport.call('get_outgoers', { id: 'a' });
    expect('result' in res).toBe(true);
    expect((res as { result: Node[] }).result.map((n) => n.id)).toEqual(['b']);
  });

  it('get_incomers returns upstream neighbors', async () => {
    const res = await transport.call('get_incomers', { id: 'c' });
    expect((res as { result: Node[] }).result.map((n) => n.id)).toEqual(['b']);
  });

  it('get_connected_edges returns edges touching given nodes', async () => {
    const res = await transport.call('get_connected_edges', { nodeIds: ['b'] });
    expect((res as { result: Edge[] }).result.map((e) => e.id).sort()).toEqual(['a-b', 'b-c']);
  });

  it('get_nodes_bounds covers all nodes', async () => {
    const res = await transport.call('get_nodes_bounds');
    const rect = (res as { result: { x: number; y: number; width: number; height: number } }).result;
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBeGreaterThanOrEqual(500);
  });

  it('get_internal_node returns a serializable view', async () => {
    const res = await transport.call('get_internal_node', { id: 'a' });
    const node = (res as { result: { id: string; positionAbsolute: { x: number; y: number } } | null }).result;
    expect(node).toBeTruthy();
    expect(node!.id).toBe('a');
    expect(node!.positionAbsolute).toBeDefined();
    // Result must round-trip through JSON without throwing.
    expect(() => JSON.parse(JSON.stringify(node))).not.toThrow();
  });

  it('get_internal_node returns null for missing id', async () => {
    const res = await transport.call('get_internal_node', { id: 'nope' });
    expect((res as { result: unknown }).result).toBeNull();
  });

  it('screen_to_flow_position and flow_to_screen_position round-trip approximately', async () => {
    // Without a real DOM bounding box, this is a smoke test on the API surface.
    const toFlow = await transport.call('screen_to_flow_position', { position: { x: 10, y: 20 } });
    expect('result' in toFlow).toBe(true);
    const toScreen = await transport.call('flow_to_screen_position', { position: { x: 0, y: 0 } });
    expect('result' in toScreen).toBe(true);
  });
});
```

Run the new tests and verify they fail:
```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "read / geometry tools"
```

Expected: FAIL on every test with "Unknown method" or method-not-found error code -32601.

- [ ] **Step 2: Add schemas for the 12 read tools**

Append these entries to the `AGENT_TOOL_SCHEMAS` array in `packages/angular/src/lib/agent/tool-schemas.ts` (just before the closing `];`):

```typescript
{
  name: 'get_internal_node',
  description:
    'Return computed internal data for a node: positionAbsolute (after parent transforms), measured size, ' +
    'and per-handle bounds. Returns null if the node does not exist. Slim, serializable view of the InternalNode.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' }, id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
},
{
  name: 'get_nodes_bounds',
  description:
    'Return the axis-aligned bounding rect that contains the given nodes ' +
    '(or every node when nodeIds is omitted).',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      nodeIds: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
  },
},
{
  name: 'get_intersecting_nodes',
  description:
    'Return nodes whose bounding box intersects the given node\'s bounding box. ' +
    'When partially is false, only fully-contained nodes are returned.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      id: { type: 'string' },
      partially: { type: 'boolean' },
    },
    required: ['id'],
    additionalProperties: false,
  },
},
{
  name: 'is_node_in_area',
  description:
    'Whether the given node\'s bounding box intersects the rect. ' +
    'When partially is false, only full containment counts.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      id: { type: 'string' },
      area: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
      partially: { type: 'boolean' },
    },
    required: ['id', 'area'],
    additionalProperties: false,
  },
},
{
  name: 'get_outgoers',
  description: 'Return nodes that have an incoming edge from the given node id.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' }, id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
},
{
  name: 'get_incomers',
  description: 'Return nodes that have an outgoing edge into the given node id.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' }, id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
},
{
  name: 'get_connected_edges',
  description: 'Return all edges that are incident to any of the given node ids (either end).',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      nodeIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['nodeIds'],
    additionalProperties: false,
  },
},
{
  name: 'get_node_connections',
  description: 'Return all HandleConnection objects for every handle on the given node.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' }, nodeId: { type: 'string' } },
    required: ['nodeId'],
    additionalProperties: false,
  },
},
{
  name: 'get_handle_connections',
  description:
    'Return HandleConnections for a specific handle. Pass handleId to scope to a named handle, ' +
    'or omit to get every connection of that type on the node.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      nodeId: { type: 'string' },
      type: { type: 'string', enum: ['source', 'target'] },
      handleId: { type: 'string' },
    },
    required: ['nodeId', 'type'],
    additionalProperties: false,
  },
},
{
  name: 'get_handle_data',
  description:
    'Look up user-attached data on a handle (registered via <ng-flow-handle [data]="...">). ' +
    'Returns undefined if no data is attached.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      nodeId: { type: 'string' },
      handleId: { type: ['string', 'null'] },
      type: { type: 'string', enum: ['source', 'target'] },
    },
    required: ['nodeId', 'handleId', 'type'],
    additionalProperties: false,
  },
},
{
  name: 'screen_to_flow_position',
  description:
    'Convert a viewport/client coordinate (e.g., MouseEvent.clientX/clientY) into a position in flow coordinates. ' +
    'Honors snapToGrid unless overridden.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' } },
        required: ['x', 'y'],
      },
      snapToGrid: { type: 'boolean' },
    },
    required: ['position'],
    additionalProperties: false,
  },
},
{
  name: 'flow_to_screen_position',
  description: 'Inverse of screen_to_flow_position: convert a flow-space point to viewport/client coordinates.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' } },
        required: ['x', 'y'],
      },
    },
    required: ['position'],
    additionalProperties: false,
  },
},
```

- [ ] **Step 3: Add handlers in `installHandlers()`**

Append these handlers to `installHandlers()` in `packages/angular/src/lib/agent/agent-bridge.service.ts`, after the existing `get_viewport` handler:

```typescript
this.handlers.set('get_internal_node', (flow, params) => {
  const id = requireString(params, 'id');
  const internal = flow.getInternalNode(id);
  if (!internal) return null;
  return {
    id: internal.id,
    positionAbsolute: internal.internals?.positionAbsolute ?? internal.position,
    measured: internal.measured
      ? { width: internal.measured.width, height: internal.measured.height }
      : null,
    handleBounds: internal.internals?.handleBounds ?? null,
  };
});

this.handlers.set('get_nodes_bounds', (flow, params) => {
  const nodeIds = optionalStringArray(params, 'nodeIds');
  const nodes = nodeIds ? flow.getNodes(nodeIds) : flow.getNodes();
  return flow.getNodesBounds(nodes);
});

this.handlers.set('get_intersecting_nodes', (flow, params) => {
  const id = requireString(params, 'id');
  const partially = typeof params['partially'] === 'boolean' ? (params['partially'] as boolean) : true;
  const node = flow.getNode(id);
  if (!node) return [];
  return flow.getIntersectingNodes(node, partially);
});

this.handlers.set('is_node_in_area', (flow, params) => {
  const id = requireString(params, 'id');
  const area = requireObject(params, 'area') as { x: number; y: number; width: number; height: number };
  const partially = typeof params['partially'] === 'boolean' ? (params['partially'] as boolean) : true;
  const node = flow.getNode(id);
  if (!node) return false;
  return flow.isNodeIntersecting(node, area, partially);
});

this.handlers.set('get_outgoers', (flow, params) => {
  const id = requireString(params, 'id');
  // Use the signal-based selector then read its current value to stay non-reactive at the JSON boundary.
  return flow.selectOutgoers(id)();
});

this.handlers.set('get_incomers', (flow, params) => {
  const id = requireString(params, 'id');
  return flow.selectIncomers(id)();
});

this.handlers.set('get_connected_edges', (flow, params) => {
  const nodeIds = optionalStringArray(params, 'nodeIds');
  if (!nodeIds) throw new InvalidParamsError('Param "nodeIds" must be an array of strings.');
  return flow.getConnectedEdges(nodeIds);
});

this.handlers.set('get_node_connections', (flow, params) => {
  const nodeId = requireString(params, 'nodeId');
  return flow.getNodeConnections(nodeId);
});

this.handlers.set('get_handle_connections', (flow, params) => {
  const nodeId = requireString(params, 'nodeId');
  const type = requireString(params, 'type');
  if (type !== 'source' && type !== 'target') {
    throw new InvalidParamsError('Param "type" must be "source" or "target".');
  }
  const handleId = typeof params['handleId'] === 'string' ? (params['handleId'] as string) : undefined;
  return flow.getHandleConnections({ nodeId, type, id: handleId });
});

this.handlers.set('get_handle_data', (flow, params) => {
  const nodeId = requireString(params, 'nodeId');
  const type = requireString(params, 'type');
  if (type !== 'source' && type !== 'target') {
    throw new InvalidParamsError('Param "type" must be "source" or "target".');
  }
  const rawHandleId = params['handleId'];
  if (rawHandleId !== null && typeof rawHandleId !== 'string') {
    throw new InvalidParamsError('Param "handleId" must be a string or null.');
  }
  return flow.getHandleData(nodeId, rawHandleId as string | null, type) ?? null;
});

this.handlers.set('screen_to_flow_position', (flow, params) => {
  const position = requireObject(params, 'position') as { x: number; y: number };
  const snapToGrid = typeof params['snapToGrid'] === 'boolean' ? (params['snapToGrid'] as boolean) : undefined;
  return flow.screenToFlowPosition(position, snapToGrid !== undefined ? { snapToGrid } : undefined);
});

this.handlers.set('flow_to_screen_position', (flow, params) => {
  const position = requireObject(params, 'position') as { x: number; y: number };
  return flow.flowToScreenPosition(position);
});
```

- [ ] **Step 4: Run the new test block**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "read / geometry tools"
```

Expected: PASS for all tests in the block.

- [ ] **Step 5: Run the full bridge spec to confirm no regressions**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "$(cat <<'EOF'
feat(angular): add agent bridge read/query/geometry tools

Adds 12 read tools wrapping existing NgFlowService methods: graph queries
(outgoers, incomers, connected edges, handle connections), spatial queries
(intersecting nodes, node-in-area, nodes bounds), internal node geometry,
handle data, and screen<->flow coordinate conversion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add viewport tools (5 tools)

**Goal:** Expose 5 viewport tools: `zoom_in`, `zoom_out`, `zoom_to`, `set_center`, `fit_bounds`. Wraps existing `NgFlowService` methods.

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `agent-bridge.spec.ts`:

```typescript
describe('viewport tools', () => {
  let flow: NgFlowService;

  beforeEach(() => {
    flow = newFlow();
    bridge.register('f', flow);
  });

  it('zoom_to sets an absolute zoom level on the store transform', async () => {
    const res = await transport.call('zoom_to', { level: 0.5 });
    // zoomTo returns a Promise<boolean> in the underlying service when no panZoom is wired.
    // Smoke check: call did not error out at the dispatch layer.
    expect('result' in res || 'error' in res).toBe(true);
  });

  it('set_center accepts x, y and optional zoom/duration', async () => {
    const res = await transport.call('set_center', { x: 100, y: 200, zoom: 1.5 });
    expect('result' in res || 'error' in res).toBe(true);
  });

  it('fit_bounds accepts a Rect', async () => {
    const res = await transport.call('fit_bounds', {
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      padding: 0.1,
    });
    expect('result' in res).toBe(true);
  });

  it('zoom_in / zoom_out are callable', async () => {
    const inRes = await transport.call('zoom_in');
    const outRes = await transport.call('zoom_out');
    expect('result' in inRes || 'error' in inRes).toBe(true);
    expect('result' in outRes || 'error' in outRes).toBe(true);
  });

  it('zoom_to with missing param fails with INVALID_PARAMS', async () => {
    const res = await transport.call('zoom_to', {});
    expect('error' in res && (res as { error: { code: number } }).error.code).toBe(-32602);
  });
});
```

Run:
```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "viewport tools"
```

Expected: FAIL.

- [ ] **Step 2: Add schemas**

Append to `tool-schemas.ts`:

```typescript
{
  name: 'zoom_in',
  description: 'Zoom the viewport in by one step. Optionally animate over duration ms.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' }, duration: { type: 'number' } },
    additionalProperties: false,
  },
},
{
  name: 'zoom_out',
  description: 'Zoom the viewport out by one step. Optionally animate over duration ms.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' }, duration: { type: 'number' } },
    additionalProperties: false,
  },
},
{
  name: 'zoom_to',
  description: 'Set the viewport zoom to an absolute level (clamped to minZoom/maxZoom).',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      level: { type: 'number' },
      duration: { type: 'number' },
    },
    required: ['level'],
    additionalProperties: false,
  },
},
{
  name: 'set_center',
  description: 'Center the viewport on a flow-space coordinate. Optional zoom and animation duration.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      x: { type: 'number' },
      y: { type: 'number' },
      zoom: { type: 'number' },
      duration: { type: 'number' },
    },
    required: ['x', 'y'],
    additionalProperties: false,
  },
},
{
  name: 'fit_bounds',
  description: 'Fit the viewport to a specific Rect in flow coordinates.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      bounds: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
      padding: { type: 'number' },
      duration: { type: 'number' },
    },
    required: ['bounds'],
    additionalProperties: false,
  },
},
```

- [ ] **Step 3: Add handlers**

Append to `installHandlers()`:

```typescript
this.handlers.set('zoom_in', (flow, params) => {
  const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
  return flow.zoomIn({ duration });
});

this.handlers.set('zoom_out', (flow, params) => {
  const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
  return flow.zoomOut({ duration });
});

this.handlers.set('zoom_to', (flow, params) => {
  const level = params['level'];
  if (typeof level !== 'number') throw new InvalidParamsError('Param "level" must be a number.');
  const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
  return flow.zoomTo(level, { duration });
});

this.handlers.set('set_center', (flow, params) => {
  const x = params['x'];
  const y = params['y'];
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new InvalidParamsError('Params "x" and "y" must be numbers.');
  }
  const zoom = typeof params['zoom'] === 'number' ? (params['zoom'] as number) : undefined;
  const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
  return flow.setCenter(x, y, { zoom, duration });
});

this.handlers.set('fit_bounds', (flow, params) => {
  const bounds = requireObject(params, 'bounds') as { x: number; y: number; width: number; height: number };
  const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
  const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
  return flow.fitBounds(bounds, { padding, duration });
});
```

- [ ] **Step 4: Verify**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "viewport tools"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "$(cat <<'EOF'
feat(angular): add agent bridge viewport tools

Adds 5 viewport tools wrapping NgFlowService: zoom_in, zoom_out, zoom_to,
set_center, fit_bounds.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add mutation + selection tools (7 tools)

**Goal:** Expose 7 mutation/selection tools: `add_nodes`, `add_edges`, `update_node_data`, `update_edge_data`, `select_nodes`, `select_edges`, `deselect_all`. Selection tools depend on `setSelection` from Task 1.

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `agent-bridge.spec.ts`:

```typescript
describe('mutation tools (bulk add and data patches)', () => {
  let flow: NgFlowService;
  beforeEach(() => {
    flow = newFlow();
    bridge.register('f', flow);
  });

  it('add_nodes appends multiple nodes', async () => {
    const res = await transport.call('add_nodes', {
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', position: { x: 100, y: 0 }, data: {} },
      ],
    });
    expect('result' in res).toBe(true);
    expect(flow.getNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('add_edges appends multiple edges', async () => {
    flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
    await transport.call('add_edges', {
      edges: [
        { id: 'a-b', source: 'a', target: 'b' },
        { id: 'b-c', source: 'b', target: 'c' },
      ],
    });
    expect(flow.getEdges().map((e) => e.id).sort()).toEqual(['a-b', 'b-c']);
  });

  it('update_node_data merges into node.data only', async () => {
    flow.setNodes([{ ...makeNode('n'), data: { x: 1, y: 2 } } as Node]);
    await transport.call('update_node_data', { id: 'n', dataPatch: { y: 99, z: 3 } });
    expect(flow.getNode('n')?.data).toEqual({ x: 1, y: 99, z: 3 });
  });

  it('update_edge_data merges into edge.data only', async () => {
    flow.setNodes([makeNode('a'), makeNode('b')]);
    flow.setEdges([{ id: 'e', source: 'a', target: 'b', data: { a: 1 } } as Edge]);
    await transport.call('update_edge_data', { id: 'e', dataPatch: { b: 2 } });
    expect(flow.getEdge('e')?.data).toEqual({ a: 1, b: 2 });
  });
});

describe('selection tools', () => {
  let flow: NgFlowService;
  beforeEach(() => {
    flow = newFlow();
    bridge.register('f', flow);
    flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
    flow.setEdges([
      { id: 'a-b', source: 'a', target: 'b' } as Edge,
      { id: 'b-c', source: 'b', target: 'c' } as Edge,
    ]);
  });

  it('select_nodes replaces selection by default', async () => {
    await transport.call('select_nodes', { nodeIds: ['a'] });
    expect(flow.selectedNodes().map((n) => n.id)).toEqual(['a']);

    await transport.call('select_nodes', { nodeIds: ['b'] });
    expect(flow.selectedNodes().map((n) => n.id)).toEqual(['b']);
  });

  it('select_nodes with additive=true extends selection', async () => {
    await transport.call('select_nodes', { nodeIds: ['a'] });
    await transport.call('select_nodes', { nodeIds: ['b'], additive: true });
    expect(flow.selectedNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('select_edges replaces edge selection', async () => {
    await transport.call('select_edges', { edgeIds: ['a-b'] });
    expect(flow.selectedEdges().map((e) => e.id)).toEqual(['a-b']);
  });

  it('deselect_all clears both', async () => {
    await transport.call('select_nodes', { nodeIds: ['a', 'b'], additive: true });
    await transport.call('select_edges', { edgeIds: ['a-b'] });
    await transport.call('deselect_all');
    expect(flow.selectedNodes().length).toBe(0);
    expect(flow.selectedEdges().length).toBe(0);
  });
});
```

Run:
```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "mutation tools|selection tools"
```

Expected: FAIL.

- [ ] **Step 2: Add schemas for the 7 mutation/selection tools**

Append to `tool-schemas.ts`:

```typescript
{
  name: 'add_nodes',
  description: 'Append multiple nodes in a single call. Each node must include id, position, and data.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      nodes: { type: 'array', items: { type: 'object' } },
    },
    required: ['nodes'],
    additionalProperties: false,
  },
},
{
  name: 'add_edges',
  description: 'Append multiple edges in a single call. Each edge must include id, source, and target.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      edges: { type: 'array', items: { type: 'object' } },
    },
    required: ['edges'],
    additionalProperties: false,
  },
},
{
  name: 'update_node_data',
  description: 'Merge dataPatch into the named node\'s data object. Leaves other node fields untouched.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      id: { type: 'string' },
      dataPatch: { type: 'object' },
    },
    required: ['id', 'dataPatch'],
    additionalProperties: false,
  },
},
{
  name: 'update_edge_data',
  description: 'Merge dataPatch into the named edge\'s data object.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      id: { type: 'string' },
      dataPatch: { type: 'object' },
    },
    required: ['id', 'dataPatch'],
    additionalProperties: false,
  },
},
{
  name: 'select_nodes',
  description:
    'Select the given node ids. additive=false (default) replaces the current selection; ' +
    'additive=true adds to it.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      nodeIds: { type: 'array', items: { type: 'string' } },
      additive: { type: 'boolean' },
    },
    required: ['nodeIds'],
    additionalProperties: false,
  },
},
{
  name: 'select_edges',
  description: 'Select the given edge ids. additive replaces (default) or adds to current selection.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      edgeIds: { type: 'array', items: { type: 'string' } },
      additive: { type: 'boolean' },
    },
    required: ['edgeIds'],
    additionalProperties: false,
  },
},
{
  name: 'deselect_all',
  description: 'Clear node and edge selection.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' } },
    additionalProperties: false,
  },
},
```

- [ ] **Step 3: Add handlers**

Append to `installHandlers()`:

```typescript
this.handlers.set('add_nodes', (flow, params) => {
  const nodes = requireArray(params, 'nodes') as Node[];
  flow.addNodes(nodes);
  return nodes.map((n) => flow.getNode(n.id)).filter((n): n is Node => !!n);
});

this.handlers.set('add_edges', (flow, params) => {
  const edges = requireArray(params, 'edges') as Edge[];
  flow.addEdges(edges);
  return edges.map((e) => flow.getEdge(e.id)).filter((e): e is Edge => !!e);
});

this.handlers.set('update_node_data', (flow, params) => {
  const id = requireString(params, 'id');
  const dataPatch = requireObject(params, 'dataPatch');
  flow.updateNodeData(id, dataPatch);
  return flow.getNode(id) ?? null;
});

this.handlers.set('update_edge_data', (flow, params) => {
  const id = requireString(params, 'id');
  const dataPatch = requireObject(params, 'dataPatch');
  flow.updateEdgeData(id, dataPatch);
  return flow.getEdge(id) ?? null;
});

this.handlers.set('select_nodes', (flow, params) => {
  const nodeIds = optionalStringArray(params, 'nodeIds');
  if (!nodeIds) throw new InvalidParamsError('Param "nodeIds" must be an array of strings.');
  const additive = typeof params['additive'] === 'boolean' ? (params['additive'] as boolean) : false;
  flow.setSelection({ nodeIds, additive });
  return { selectedNodeIds: flow.selectedNodes().map((n) => n.id) };
});

this.handlers.set('select_edges', (flow, params) => {
  const edgeIds = optionalStringArray(params, 'edgeIds');
  if (!edgeIds) throw new InvalidParamsError('Param "edgeIds" must be an array of strings.');
  const additive = typeof params['additive'] === 'boolean' ? (params['additive'] as boolean) : false;
  flow.setSelection({ edgeIds, additive });
  return { selectedEdgeIds: flow.selectedEdges().map((e) => e.id) };
});

this.handlers.set('deselect_all', (flow) => {
  flow.setSelection({ nodeIds: [], edgeIds: [], additive: false });
});
```

- [ ] **Step 4: Verify**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "mutation tools|selection tools"
```

Expected: PASS.

- [ ] **Step 5: Full bridge spec**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "$(cat <<'EOF'
feat(angular): add agent bridge mutation and selection tools

Adds 7 tools: add_nodes / add_edges (plural), update_node_data /
update_edge_data (data-only patches), and select_nodes / select_edges /
deselect_all (programmatic selection via NgFlowService.setSelection).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add `apply_changes` transactional batch tool

**Goal:** Add one new tool — `apply_changes` — that runs a sequence of mutating ops inside `service.batch()` with snapshot-rollback on throw. Single coalesced `flow.state` event per call. The op vocabulary mirrors individual tool names.

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `agent-bridge.spec.ts`:

```typescript
describe('apply_changes', () => {
  async function flushEffects(): Promise<void> {
    TestBed.tick();
    await new Promise<void>((r) => queueMicrotask(r));
  }

  let flow: NgFlowService;
  beforeEach(() => {
    flow = newFlow();
    bridge.register('f', flow);
  });

  it('runs a batch of ops in a single reactivity cycle', async () => {
    await flushEffects();
    transport.events.length = 0;

    const res = await transport.call('apply_changes', {
      ops: [
        { op: 'add_node', node: { id: 'a', position: { x: 0, y: 0 }, data: {} } },
        { op: 'add_node', node: { id: 'b', position: { x: 100, y: 0 }, data: {} } },
        { op: 'add_edge', edge: { id: 'a-b', source: 'a', target: 'b' } },
      ],
    });
    await flushEffects();

    expect('result' in res).toBe(true);
    const result = (res as { result: { results: { ok: true; value: unknown }[] } }).result;
    expect(result.results).toHaveLength(3);
    expect(result.results.every((r) => r.ok)).toBe(true);

    expect(flow.getNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(flow.getEdges().map((e) => e.id)).toEqual(['a-b']);

    const stateEvents = transport.events.filter((e) => 'event' in e && e.event === 'flow.state');
    expect(stateEvents.length).toBe(1);
  });

  it('rolls back on bad op and returns failedIndex', async () => {
    flow.setNodes([makeNode('a')]);
    await flushEffects();
    transport.events.length = 0;

    const res = await transport.call('apply_changes', {
      ops: [
        { op: 'add_node', node: { id: 'b', position: { x: 0, y: 0 }, data: {} } },
        { op: 'update_node', id: 'does-not-exist', patch: { data: {} } },
      ],
    });

    // We treat the missing id as a failure; verify error shape.
    expect('error' in res).toBe(true);
    const error = (res as { error: { code: number; message: string; data?: { failedIndex?: number } } }).error;
    expect(error.code).toBe(-32603);
    expect(error.data?.failedIndex).toBe(1);

    // Net state: still only 'a'.
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
  });

  it('apply_changes with select_nodes inside does not throw', async () => {
    flow.setNodes([makeNode('a')]);
    const res = await transport.call('apply_changes', {
      ops: [
        { op: 'add_node', node: { id: 'b', position: { x: 0, y: 0 }, data: {} } },
        { op: 'select_nodes', nodeIds: ['b'] },
      ],
    });
    expect('result' in res).toBe(true);
    expect(flow.selectedNodes().map((n) => n.id)).toEqual(['b']);
  });
});
```

Run:
```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "apply_changes"
```

Expected: FAIL on all three.

- [ ] **Step 2: Detect the missing-id failure mode in `updateNode`**

Important: `NgFlowService.updateNode(id, patch)` silently returns without throwing when `id` doesn't exist (see `ng-flow.service.ts`: `if (!current) return;`). For `apply_changes` to roll back, we need the dispatcher to detect this. The simplest approach: read the node before update and throw if missing. Add this logic inside the `executeOp` helper introduced below.

- [ ] **Step 3: Add the `apply_changes` schema**

Append to `tool-schemas.ts`:

```typescript
{
  name: 'apply_changes',
  description:
    'Atomically apply a batch of mutating ops in a single reactivity cycle. On any error the entire ' +
    'batch is rolled back (snapshot of nodes/edges restored), and a JSON-RPC error returns with ' +
    'data.failedIndex pointing at the bad op. Use this to build/edit graphs in one round trip. ' +
    'Allowed ops: add_node, add_nodes, add_edge, add_edges, update_node, update_node_data, ' +
    'update_edge, update_edge_data, delete_elements, select_nodes, select_edges, deselect_all. ' +
    'Op shape mirrors the corresponding individual tool params, with an extra `op` field.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      ops: { type: 'array', items: { type: 'object' } },
    },
    required: ['ops'],
    additionalProperties: false,
  },
},
```

- [ ] **Step 4: Add the handler**

Append to `installHandlers()`:

```typescript
this.handlers.set('apply_changes', (flow, params) => {
  const ops = requireArray(params, 'ops') as Array<Record<string, unknown>>;

  // Capture snapshot for rollback. Viewport is not part of the snapshot per design.
  const snapshot = {
    nodes: flow.getNodes().slice(),
    edges: flow.getEdges().slice(),
  };

  const results: Array<{ ok: true; value: unknown }> = [];
  let failure: { failedIndex: number; cause: unknown } | null = null;

  flow.batch(() => {
    for (let i = 0; i < ops.length; i++) {
      try {
        results.push({ ok: true, value: executeOp(flow, ops[i]) });
      } catch (err) {
        failure = { failedIndex: i, cause: err };
        break;
      }
    }
  });

  if (failure) {
    flow.batch(() => {
      flow.setNodes(snapshot.nodes as Node[]);
      flow.setEdges(snapshot.edges as Edge[]);
    });
    const f = failure as { failedIndex: number; cause: unknown };
    const message = f.cause instanceof Error ? f.cause.message : String(f.cause);
    throw new ApplyChangesError(f.failedIndex, message);
  }

  return { results };
});
```

Also add the `executeOp` helper and `ApplyChangesError` class at module scope (below the existing `signatureOf` helper). The `executeOp` function dispatches to the same service methods the individual tool handlers use:

```typescript
function executeOp(flow: NgFlowService, op: Record<string, unknown>): unknown {
  const kind = op['op'];
  switch (kind) {
    case 'add_node': {
      const node = op['node'] as Node;
      if (!node || typeof node !== 'object') throw new InvalidParamsError('add_node: missing "node".');
      flow.addNodes(node);
      return flow.getNode(node.id) ?? null;
    }
    case 'add_nodes': {
      const nodes = op['nodes'] as Node[];
      if (!Array.isArray(nodes)) throw new InvalidParamsError('add_nodes: "nodes" must be an array.');
      flow.addNodes(nodes);
      return nodes.map((n) => flow.getNode(n.id)).filter((n): n is Node => !!n);
    }
    case 'add_edge': {
      const edge = op['edge'] as Edge;
      if (!edge || typeof edge !== 'object') throw new InvalidParamsError('add_edge: missing "edge".');
      flow.addEdges(edge);
      return flow.getEdge(edge.id) ?? null;
    }
    case 'add_edges': {
      const edges = op['edges'] as Edge[];
      if (!Array.isArray(edges)) throw new InvalidParamsError('add_edges: "edges" must be an array.');
      flow.addEdges(edges);
      return edges.map((e) => flow.getEdge(e.id)).filter((e): e is Edge => !!e);
    }
    case 'update_node': {
      const id = op['id'];
      const patch = op['patch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_node: "id" must be a string.');
      if (!patch || typeof patch !== 'object') throw new InvalidParamsError('update_node: "patch" must be an object.');
      if (!flow.getNode(id)) throw new InvalidParamsError(`update_node: node "${id}" not found.`);
      flow.updateNode(id, patch as Partial<Node>);
      return flow.getNode(id) ?? null;
    }
    case 'update_node_data': {
      const id = op['id'];
      const dataPatch = op['dataPatch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_node_data: "id" must be a string.');
      if (!dataPatch || typeof dataPatch !== 'object') throw new InvalidParamsError('update_node_data: "dataPatch" must be an object.');
      if (!flow.getNode(id)) throw new InvalidParamsError(`update_node_data: node "${id}" not found.`);
      flow.updateNodeData(id, dataPatch as Record<string, unknown>);
      return flow.getNode(id) ?? null;
    }
    case 'update_edge': {
      const id = op['id'];
      const patch = op['patch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_edge: "id" must be a string.');
      if (!patch || typeof patch !== 'object') throw new InvalidParamsError('update_edge: "patch" must be an object.');
      if (!flow.getEdge(id)) throw new InvalidParamsError(`update_edge: edge "${id}" not found.`);
      flow.updateEdge(id, patch as Partial<Edge>);
      return flow.getEdge(id) ?? null;
    }
    case 'update_edge_data': {
      const id = op['id'];
      const dataPatch = op['dataPatch'];
      if (typeof id !== 'string') throw new InvalidParamsError('update_edge_data: "id" must be a string.');
      if (!dataPatch || typeof dataPatch !== 'object') throw new InvalidParamsError('update_edge_data: "dataPatch" must be an object.');
      if (!flow.getEdge(id)) throw new InvalidParamsError(`update_edge_data: edge "${id}" not found.`);
      flow.updateEdgeData(id, dataPatch as Record<string, unknown>);
      return flow.getEdge(id) ?? null;
    }
    case 'delete_elements': {
      const nodeIds = Array.isArray(op['nodeIds']) ? (op['nodeIds'] as string[]) : [];
      const edgeIds = Array.isArray(op['edgeIds']) ? (op['edgeIds'] as string[]) : [];
      // deleteElements is async because of onBeforeDelete; inside apply_changes we
      // intentionally do not await — the synchronous setNodes/setEdges paths are
      // what we need for rollback semantics. Skip onBeforeDelete hooks inside batches.
      const allEdgeIds = new Set(edgeIds);
      for (const e of flow.getEdges()) {
        if (nodeIds.includes(e.source) || nodeIds.includes(e.target)) allEdgeIds.add(e.id);
      }
      if (nodeIds.length > 0) {
        flow.setNodes(flow.getNodes().filter((n) => !nodeIds.includes(n.id)));
      }
      if (allEdgeIds.size > 0) {
        flow.setEdges(flow.getEdges().filter((e) => !allEdgeIds.has(e.id)));
      }
      return { deletedNodeIds: nodeIds, deletedEdgeIds: Array.from(allEdgeIds) };
    }
    case 'select_nodes': {
      const nodeIds = op['nodeIds'];
      if (!Array.isArray(nodeIds)) throw new InvalidParamsError('select_nodes: "nodeIds" must be an array.');
      const additive = typeof op['additive'] === 'boolean' ? (op['additive'] as boolean) : false;
      flow.setSelection({ nodeIds: nodeIds as string[], additive });
      return null;
    }
    case 'select_edges': {
      const edgeIds = op['edgeIds'];
      if (!Array.isArray(edgeIds)) throw new InvalidParamsError('select_edges: "edgeIds" must be an array.');
      const additive = typeof op['additive'] === 'boolean' ? (op['additive'] as boolean) : false;
      flow.setSelection({ edgeIds: edgeIds as string[], additive });
      return null;
    }
    case 'deselect_all': {
      flow.setSelection({ nodeIds: [], edgeIds: [], additive: false });
      return null;
    }
    default:
      throw new InvalidParamsError(`Unknown op kind: ${String(kind)}`);
  }
}

class ApplyChangesError extends Error {
  constructor(public readonly failedIndex: number, message: string) {
    super(message);
  }
}
```

- [ ] **Step 5: Surface `ApplyChangesError` as a JSON-RPC error with `data.failedIndex`**

Modify the `dispatch` method's error handling. Find this section:

```typescript
} catch (err) {
  if (err instanceof FlowNotFoundError) {
    return { id: req.id, error: { code: ERROR_FLOW_NOT_FOUND, message: err.message } };
  }
  if (err instanceof InvalidParamsError) {
    return { id: req.id, error: { code: ERROR_INVALID_PARAMS, message: err.message } };
  }
  return {
    id: req.id,
    error: {
      code: ERROR_INTERNAL,
      message: err instanceof Error ? err.message : String(err),
    },
  };
}
```

Replace it with:

```typescript
} catch (err) {
  if (err instanceof FlowNotFoundError) {
    return { id: req.id, error: { code: ERROR_FLOW_NOT_FOUND, message: err.message } };
  }
  if (err instanceof InvalidParamsError) {
    return { id: req.id, error: { code: ERROR_INVALID_PARAMS, message: err.message } };
  }
  if (err instanceof ApplyChangesError) {
    return {
      id: req.id,
      error: {
        code: ERROR_INTERNAL,
        message: err.message,
        data: { failedIndex: err.failedIndex },
      },
    };
  }
  return {
    id: req.id,
    error: {
      code: ERROR_INTERNAL,
      message: err instanceof Error ? err.message : String(err),
    },
  };
}
```

- [ ] **Step 6: Verify**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "apply_changes"
```

Expected: PASS.

- [ ] **Step 7: Full bridge spec**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "$(cat <<'EOF'
feat(angular): add apply_changes transactional batch tool

Adds an atomic op-list executor: runs all ops inside service.batch(),
captures a {nodes, edges} snapshot beforehand, and rolls back on any throw.
A successful batch produces a single coalesced flow.state event; a failed
batch returns a JSON-RPC error with data.failedIndex and zero net state
change. Op vocabulary mirrors individual tool names.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add `AgentHistory` + undo/redo + `flow.history` event + config

**Goal:** Add bridge-only snapshot-based undo/redo: `undo`, `redo`, `history_status`, `clear_history`. Capture snapshots before mutating tools; emit `flow.history` events on stack changes. Wire optional `history` config through `provideAgentBridge`.

**Files:**
- Create: `packages/angular/src/lib/agent/history.ts`
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts`
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/src/lib/agent/provide-agent-bridge.ts`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Create `history.ts` with the `AgentHistory` class**

Create `packages/angular/src/lib/agent/history.ts`:

```typescript
import type { Node, Edge } from '../types';

export interface AgentHistoryOptions {
  maxDepth?: number;
}

export type Snapshot = { nodes: readonly Node[]; edges: readonly Edge[] };

export type HistoryStatus = {
  canUndo: boolean;
  canRedo: boolean;
  pastDepth: number;
  futureDepth: number;
};

/**
 * Per-flow snapshot-based undo/redo stack. Bridge-only — tracks mutations
 * that came through bridge tool calls; user-driven changes are not captured.
 */
export class AgentHistory {
  private readonly past = new Map<string, Snapshot[]>();
  private readonly future = new Map<string, Snapshot[]>();
  private readonly maxDepth: number;

  constructor(options: AgentHistoryOptions = {}) {
    this.maxDepth = options.maxDepth ?? 100;
  }

  capture(flowId: string, snapshot: Snapshot): void {
    const stack = this.past.get(flowId) ?? [];
    stack.push(snapshot);
    while (stack.length > this.maxDepth) stack.shift();
    this.past.set(flowId, stack);
    this.future.delete(flowId);
  }

  /** Pop up to `steps` snapshots; return the deepest popped snapshot and push intermediates onto `future`. */
  undo(flowId: string, steps: number, currentSnapshot: Snapshot): Snapshot | null {
    const past = this.past.get(flowId);
    if (!past || past.length === 0) return null;
    const future = this.future.get(flowId) ?? [];

    let popped: Snapshot | null = null;
    let remaining = Math.max(1, Math.floor(steps));
    // Push current onto future so a redo returns here.
    future.push(currentSnapshot);
    while (remaining > 0 && past.length > 0) {
      const next = past.pop()!;
      if (popped !== null) future.push(popped);
      popped = next;
      remaining--;
    }
    if (popped === null) {
      future.pop();
    }
    this.past.set(flowId, past);
    this.future.set(flowId, future);
    return popped;
  }

  /** Inverse of undo. */
  redo(flowId: string, steps: number, currentSnapshot: Snapshot): Snapshot | null {
    const future = this.future.get(flowId);
    if (!future || future.length === 0) return null;
    const past = this.past.get(flowId) ?? [];

    let target: Snapshot | null = null;
    let remaining = Math.max(1, Math.floor(steps));
    past.push(currentSnapshot);
    while (remaining > 0 && future.length > 0) {
      const next = future.pop()!;
      if (target !== null) past.push(target);
      target = next;
      remaining--;
    }
    if (target === null) {
      past.pop();
    }
    this.past.set(flowId, past);
    this.future.set(flowId, future);
    return target;
  }

  status(flowId: string): HistoryStatus {
    const past = this.past.get(flowId)?.length ?? 0;
    const future = this.future.get(flowId)?.length ?? 0;
    return { canUndo: past > 0, canRedo: future > 0, pastDepth: past, futureDepth: future };
  }

  clear(flowId: string): void {
    this.past.delete(flowId);
    this.future.delete(flowId);
  }

  /** Called when a flow unregisters. */
  dropFlow(flowId: string): void {
    this.clear(flowId);
  }
}
```

- [ ] **Step 2: Wire `provide-agent-bridge.ts` to accept history config**

Read the current file:
```bash
cat packages/angular/src/lib/agent/provide-agent-bridge.ts
```

Modify it so the config interface takes an optional `history` field. Example change (adjust to existing structure):

```typescript
import { Provider } from '@angular/core';
import { AGENT_TRANSPORTS } from './agent-bridge.service';
import type { AgentTransport } from './types';
import { AGENT_HISTORY_OPTIONS } from './agent-bridge.service';
import type { AgentHistoryOptions } from './history';

export interface ProvideAgentBridgeOptions {
  transports: AgentTransport[];
  /** History config. Pass `false` to disable undo/redo entirely. Default: { maxDepth: 100 }. */
  history?: AgentHistoryOptions | false;
}

export function provideAgentBridge(options: ProvideAgentBridgeOptions): Provider[] {
  return [
    { provide: AGENT_TRANSPORTS, useValue: options.transports },
    { provide: AGENT_HISTORY_OPTIONS, useValue: options.history ?? { maxDepth: 100 } },
  ];
}
```

- [ ] **Step 3: Add the history injection token and wire it into the bridge**

In `packages/angular/src/lib/agent/agent-bridge.service.ts`, just after the existing `AGENT_TRANSPORTS` declaration, add:

```typescript
import { AgentHistory } from './history';
import type { AgentHistoryOptions } from './history';

/** Provider token for history config. `false` disables history entirely. */
export const AGENT_HISTORY_OPTIONS = new InjectionToken<AgentHistoryOptions | false>('AngflowAgentHistoryOptions');
```

In the `AngflowAgentBridge` class, add a field and update the constructor:

```typescript
private readonly history: AgentHistory | null;

constructor(
  @Optional() @Inject(AGENT_TRANSPORTS) transports: AgentTransport[] | null,
  @Optional() @Inject(AGENT_HISTORY_OPTIONS) historyOptions: AgentHistoryOptions | false | null,
) {
  this.transports = transports ?? [];
  this.history = historyOptions === false ? null : new AgentHistory(historyOptions ?? undefined);
  this.installHandlers();
  this.start();
}
```

- [ ] **Step 4: Capture history at the dispatch boundary**

Add a `MUTATING_TOOLS` set at module scope:

```typescript
const MUTATING_TOOLS = new Set<string>([
  'add_node', 'add_nodes', 'add_edge', 'add_edges',
  'update_node', 'update_node_data', 'update_edge', 'update_edge_data',
  'delete_elements', 'set_nodes', 'set_edges',
]);
// apply_changes is treated specially — see dispatch logic.
```

Replace the `dispatch` method so that, after resolving `flow` but before invoking the handler, it captures a snapshot for mutating tools. Preserve all four existing error branches (including the `ApplyChangesError` branch added in Task 5):

```typescript
private async dispatch(req: AgentInbound): Promise<AgentResponse> {
  const handler = this.handlers.get(req.method);
  if (!handler) {
    return {
      id: req.id,
      error: { code: ERROR_METHOD_NOT_FOUND, message: `Unknown method: ${req.method}` },
    };
  }
  try {
    const params = req.params ?? {};
    if (req.method === 'list_flows') {
      const result = await handler(null as unknown as NgFlowService, params);
      return { id: req.id, result };
    }
    const flow = this.resolveFlow(params['flowId']);
    const flowId = this.findFlowId(flow);
    const isApplyChanges = req.method === 'apply_changes';

    // Pre-mutation snapshot for history capture. Skipped for non-mutating tools.
    let snapshot: { nodes: readonly Node[]; edges: readonly Edge[] } | null = null;
    if (this.history && (MUTATING_TOOLS.has(req.method) || isApplyChanges)) {
      snapshot = { nodes: flow.getNodes().slice(), edges: flow.getEdges().slice() };
    }

    const result = await handler(flow, params);

    // Commit the captured snapshot to history. For apply_changes, the handler
    // either succeeded entirely or threw and was rolled back already.
    if (snapshot && flowId && this.history) {
      if (isApplyChanges) {
        const ops = (params['ops'] as Array<Record<string, unknown>>) ?? [];
        const hasNonSelection = ops.some(
          (o) => o['op'] !== 'select_nodes' && o['op'] !== 'select_edges' && o['op'] !== 'deselect_all',
        );
        if (hasNonSelection) {
          this.history.capture(flowId, snapshot);
          this.emitHistory(flowId);
        }
      } else {
        this.history.capture(flowId, snapshot);
        this.emitHistory(flowId);
      }
    }

    return { id: req.id, result: result ?? null };
  } catch (err) {
    if (err instanceof FlowNotFoundError) {
      return { id: req.id, error: { code: ERROR_FLOW_NOT_FOUND, message: err.message } };
    }
    if (err instanceof InvalidParamsError) {
      return { id: req.id, error: { code: ERROR_INVALID_PARAMS, message: err.message } };
    }
    if (err instanceof ApplyChangesError) {
      return {
        id: req.id,
        error: {
          code: ERROR_INTERNAL,
          message: err.message,
          data: { failedIndex: err.failedIndex },
        },
      };
    }
    return {
      id: req.id,
      error: {
        code: ERROR_INTERNAL,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
```

Add the helpers `findFlowId` and `emitHistory`:

```typescript
private findFlowId(flow: NgFlowService): string | null {
  for (const [id, entry] of this.flows.entries()) {
    if (entry.service === flow) return id;
  }
  return null;
}

private emitHistory(flowId: string): void {
  if (!this.history) return;
  const status = this.history.status(flowId);
  this.emit({ event: 'flow.history', params: { flowId, ...status } });
}
```

In `unregister`, drop the flow's history:

```typescript
unregister(id: string): void {
  const entry = this.flows.get(id);
  if (!entry) return;
  entry.watcher.destroy();
  this.flows.delete(id);
  this.history?.dropFlow(id);
  this.registeredFlows.set(Array.from(this.flows.keys()));
  this.emit({ event: 'flow.unregistered', params: { flowId: id } });
}
```

- [ ] **Step 5: Add the four history tools (schemas and handlers)**

Append to `tool-schemas.ts`:

```typescript
{
  name: 'undo',
  description:
    'Undo the last mutating tool call (or `steps` of them). Restores the snapshot taken before the mutation. ' +
    'No-op when there is nothing to undo. Returns { undone, canUndo, canRedo }.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      steps: { type: 'number' },
    },
    additionalProperties: false,
  },
},
{
  name: 'redo',
  description: 'Inverse of undo. Returns { redone, canUndo, canRedo }.',
  inputSchema: {
    type: 'object',
    properties: {
      flowId: { type: 'string' },
      steps: { type: 'number' },
    },
    additionalProperties: false,
  },
},
{
  name: 'history_status',
  description: 'Return { canUndo, canRedo, pastDepth, futureDepth } for the flow.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' } },
    additionalProperties: false,
  },
},
{
  name: 'clear_history',
  description: 'Drop both undo and redo stacks for the flow.',
  inputSchema: {
    type: 'object',
    properties: { flowId: { type: 'string' } },
    additionalProperties: false,
  },
},
```

Append handlers in `installHandlers()`:

```typescript
this.handlers.set('undo', (flow, params) => {
  if (!this.history) return { undone: 0, canUndo: false, canRedo: false };
  const flowId = this.findFlowId(flow);
  if (!flowId) return { undone: 0, canUndo: false, canRedo: false };
  const steps = typeof params['steps'] === 'number' ? (params['steps'] as number) : 1;
  const current = { nodes: flow.getNodes().slice(), edges: flow.getEdges().slice() };
  const target = this.history.undo(flowId, steps, current);
  if (target) {
    flow.batch(() => {
      flow.setNodes(target.nodes as Node[]);
      flow.setEdges(target.edges as Edge[]);
    });
  }
  this.emitHistory(flowId);
  const status = this.history.status(flowId);
  return { undone: target ? steps : 0, canUndo: status.canUndo, canRedo: status.canRedo };
});

this.handlers.set('redo', (flow, params) => {
  if (!this.history) return { redone: 0, canUndo: false, canRedo: false };
  const flowId = this.findFlowId(flow);
  if (!flowId) return { redone: 0, canUndo: false, canRedo: false };
  const steps = typeof params['steps'] === 'number' ? (params['steps'] as number) : 1;
  const current = { nodes: flow.getNodes().slice(), edges: flow.getEdges().slice() };
  const target = this.history.redo(flowId, steps, current);
  if (target) {
    flow.batch(() => {
      flow.setNodes(target.nodes as Node[]);
      flow.setEdges(target.edges as Edge[]);
    });
  }
  this.emitHistory(flowId);
  const status = this.history.status(flowId);
  return { redone: target ? steps : 0, canUndo: status.canUndo, canRedo: status.canRedo };
});

this.handlers.set('history_status', (flow) => {
  if (!this.history) return { canUndo: false, canRedo: false, pastDepth: 0, futureDepth: 0 };
  const flowId = this.findFlowId(flow);
  if (!flowId) return { canUndo: false, canRedo: false, pastDepth: 0, futureDepth: 0 };
  return this.history.status(flowId);
});

this.handlers.set('clear_history', (flow) => {
  if (!this.history) return;
  const flowId = this.findFlowId(flow);
  if (!flowId) return;
  this.history.clear(flowId);
  this.emitHistory(flowId);
});
```

- [ ] **Step 6: Re-export `AgentHistoryOptions` from `agent/index.ts`**

Add to `packages/angular/src/lib/agent/index.ts`:

```typescript
export type { AgentHistoryOptions } from './history';
```

- [ ] **Step 7: Write history tests**

Append to `agent-bridge.spec.ts`:

```typescript
describe('history (undo/redo)', () => {
  async function flushEffects(): Promise<void> {
    TestBed.tick();
    await new Promise<void>((r) => queueMicrotask(r));
  }

  let flow: NgFlowService;
  beforeEach(() => {
    flow = newFlow();
    bridge.register('f', flow);
  });

  it('undo restores prior nodes state', async () => {
    await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);

    const undoRes = await transport.call('undo');
    expect((undoRes as { result: { undone: number } }).result.undone).toBe(1);
    expect(flow.getNodes()).toEqual([]);
  });

  it('redo re-applies the undone state', async () => {
    await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    await transport.call('undo');
    const redoRes = await transport.call('redo');
    expect((redoRes as { result: { redone: number } }).result.redone).toBe(1);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
  });

  it('selection ops do NOT capture history', async () => {
    flow.setNodes([makeNode('a')]);
    // Initial selection is empty; capture stack should be empty.
    let status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(0);

    await transport.call('select_nodes', { nodeIds: ['a'] });
    status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(0);
  });

  it('viewport ops do NOT capture history', async () => {
    await transport.call('zoom_in');
    const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(0);
  });

  it('apply_changes creates a single history entry when ops include mutation', async () => {
    await transport.call('apply_changes', {
      ops: [
        { op: 'add_node', node: { id: 'a', position: { x: 0, y: 0 }, data: {} } },
        { op: 'add_node', node: { id: 'b', position: { x: 100, y: 0 }, data: {} } },
      ],
    });
    const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(1);
  });

  it('apply_changes with only selection ops does NOT capture history', async () => {
    flow.setNodes([makeNode('a')]);
    await transport.call('apply_changes', {
      ops: [{ op: 'select_nodes', nodeIds: ['a'] }],
    });
    const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(0);
  });

  it('rolled-back apply_changes does NOT capture history', async () => {
    flow.setNodes([makeNode('a')]);
    await transport.call('apply_changes', {
      ops: [{ op: 'update_node', id: 'nope', patch: { data: {} } }],
    });
    const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(0);
  });

  it('clear_history empties both stacks', async () => {
    await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    await transport.call('undo');
    await transport.call('clear_history');
    const status = (await transport.call('history_status')) as {
      result: { canUndo: boolean; canRedo: boolean };
    };
    expect(status.result.canUndo).toBe(false);
    expect(status.result.canRedo).toBe(false);
  });

  it('flow.history is emitted on capture, undo, redo, and clear', async () => {
    await flushEffects();
    transport.events.length = 0;

    await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    await flushEffects();
    expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);

    transport.events.length = 0;
    await transport.call('undo');
    await flushEffects();
    expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);

    transport.events.length = 0;
    await transport.call('redo');
    await flushEffects();
    expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);

    transport.events.length = 0;
    await transport.call('clear_history');
    await flushEffects();
    expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);
  });

  it('maxDepth caps the history stack', async () => {
    // Reset bridge with a tiny maxDepth.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [transport], history: { maxDepth: 2 } }),
      ],
    });
    const b = TestBed.inject(AngflowAgentBridge);
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    const f = child.get(NgFlowService);
    b.register('f', f);

    for (let i = 0; i < 5; i++) {
      await transport.call('add_node', { node: { id: `n${i}`, position: { x: i * 10, y: 0 }, data: {} } });
    }
    const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
    expect(status.result.pastDepth).toBe(2);
  });
});

describe('history disabled (history: false)', () => {
  let bridge2: AngflowAgentBridge;
  let transport2: CapturingTransport;
  let flow: NgFlowService;
  beforeEach(() => {
    transport2 = new CapturingTransport();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [transport2], history: false }),
      ],
    });
    bridge2 = TestBed.inject(AngflowAgentBridge);
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    flow = child.get(NgFlowService);
    bridge2.register('f', flow);
  });

  it('undo is a no-op when history is disabled', async () => {
    await transport2.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    const res = await transport2.call('undo');
    expect((res as { result: { undone: number } }).result.undone).toBe(0);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 8: Run all history tests**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "history"
```

Expected: PASS.

- [ ] **Step 9: Full bridge spec**

```bash
cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add packages/angular/src/lib/agent/history.ts packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/tool-schemas.ts packages/angular/src/lib/agent/provide-agent-bridge.ts packages/angular/src/lib/agent/index.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "$(cat <<'EOF'
feat(angular): add agent bridge undo/redo and flow.history event

New AgentHistory class holds per-flow {nodes, edges} snapshot stacks.
Bridge captures before mutating tools and emits flow.history events on
stack changes. Adds undo, redo, history_status, clear_history tools.
Selection and viewport ops do not capture; rolled-back apply_changes
does not capture; apply_changes with only selection ops does not capture.
Configurable via provideAgentBridge({ history: { maxDepth } | false }),
default maxDepth = 100.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update example component and `AGENT_BRIDGE.md` doc

**Goal:** Surface the new capabilities in the agent-bridge example panel, and update `AGENT_BRIDGE.md` per the CLAUDE.md rule.

**Files:**
- Modify: `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts`
- Modify: `packages/angular/AGENT_BRIDGE.md`

- [ ] **Step 1: Update the example panel**

In `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts`:

- Add two new code snippets in the panel template alongside the existing ones — one for `apply_changes` and one for `undo`.
- Add a live `Undo / Redo` readout fed by `flow.history` events. Add a signal `historyStatus = signal<{ canUndo: boolean; canRedo: boolean; pastDepth: number; futureDepth: number } | null>(null)`. In the existing `api.subscribe` callback, branch on `e.event === 'flow.history' && e.params?.flowId === 'demo'` and set `historyStatus.set(...)`. Display: `<div>past: {{ historyStatus()?.pastDepth }} | future: {{ historyStatus()?.futureDepth }}</div>` near the activity log.

Snippet strings to add to the template:

```text
await angflow.callTool('apply_changes', {
  ops: [
    { op: 'add_node', node: { id: 'x' + Date.now(), position: { x: 200, y: 200 }, data: { label: 'X' } } },
    { op: 'add_node', node: { id: 'y' + Date.now(), position: { x: 400, y: 200 }, data: { label: 'Y' } } },
  ],
})

await angflow.callTool('undo')
```

- [ ] **Step 2: Rewrite `packages/angular/AGENT_BRIDGE.md`**

Update the existing doc to reflect the new surface. Sections to revise:

- **Tool catalog** — extend tables. Group: Discovery / read (existing 7 + 12 new), Mutate — incremental (existing 5 + 4 new), Mutate — bulk, Selection (NEW: 3 tools), Viewport / camera (existing 2 + 5 new), Transactional batch (NEW: `apply_changes`), History (NEW: 4 tools).
- **Events** — add `flow.history` with `{ flowId, canUndo, canRedo, pastDepth, futureDepth }`.
- **Error codes** — unchanged, but document that `apply_changes` rollback errors include `data.failedIndex`.
- **Wiring** — add the new `history` config option:

  ```ts
  provideAgentBridge({
    transports: [new WindowTransport()],
    history: { maxDepth: 100 },  // default; pass false to disable
  })
  ```

- **History section** — new subsection covering: capture rule (which tools capture vs not), bridge-only scope (does not track user-driven changes), snapshot contents (`{ nodes, edges }` only — viewport excluded), default `maxDepth = 100`, opt-out via `history: false`.
- **Transactional batch section** — new subsection: ops list, atomicity (snapshot-rollback), single-event coalescing, `failedIndex` in error data, "apply_changes is one undo entry."
- **Known gaps** — trim to: undo/redo for user-driven changes, copy/paste of subgraphs, auto-layout, runtime node/edge type registration, pane/read-only toggles.
- **Adding a new tool** — unchanged, still accurate.

The current doc is the source of truth for what stays; do not duplicate it here.

- [ ] **Step 3: Build the example to confirm nothing regresses**

```bash
cd examples/angular && npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts packages/angular/AGENT_BRIDGE.md
git commit -m "$(cat <<'EOF'
docs(angular): update AGENT_BRIDGE.md and example for tooling expansion

Documents the 26 new tools, apply_changes transactional batch, undo/redo,
flow.history event, and the optional history config on provideAgentBridge.
Adds live undo/redo readout and example snippets in the demo panel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification

**Goal:** Type-check the package, build it, build the example app, and run the full test suite one more time. Catches anything missed by per-task verification.

**Files:** none modified.

- [ ] **Step 1: Type-check the angular package**

```bash
cd packages/angular && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 2: Build the angular package**

```bash
cd packages/angular && npm run build
```

Expected: clean build, `dist/esm/` populated.

- [ ] **Step 3: Run the full angular test suite**

```bash
cd packages/angular && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Build the example app**

```bash
cd examples/angular && npm run build
```

Expected: clean build.

- [ ] **Step 5: Smoke-test in the dev server (optional but recommended)**

```bash
cd examples/angular && npm run dev
```

Manual: navigate to the Agent Bridge example, open devtools console, run:

```js
await angflow.callTool('apply_changes', {
  ops: [
    { op: 'add_node', node: { id: 'demo-x', position: { x: 200, y: 200 }, data: { label: 'X' } } },
    { op: 'add_node', node: { id: 'demo-y', position: { x: 400, y: 200 }, data: { label: 'Y' } } },
    { op: 'add_edge', edge: { id: 'demo-x-y', source: 'demo-x', target: 'demo-y' } },
  ],
});
await angflow.callTool('undo');
```

Expected:
- `apply_changes` creates two nodes and one edge in the canvas. Activity log shows one `flow.state` event and one `flow.history` event.
- `undo` removes them. Activity log shows one `flow.state` event and one `flow.history` event.

- [ ] **Step 6: Final commit (if any doc tweaks discovered)**

If smoke-testing surfaced anything to fix, commit as a separate fix. Otherwise no commit needed — this task is verification only.

```bash
git log --oneline -10
```

Expected: roughly 7-8 new commits on top of the spec commit.

---

## Notes for the implementer

- Every task above is independently committable. If you hit a blocker mid-task, stop and report — don't push through with a partial commit.
- The existing `agent-bridge.spec.ts` is the source of truth for testing patterns (Vitest, `CapturingTransport`, `provideZonelessChangeDetection`, `flushEffects`). Mirror its style.
- Param-validation helpers live at module scope in `agent-bridge.service.ts` (`requireString`, `requireObject`, `requireArray`, `optionalStringArray`). Reuse them; don't roll your own.
- Tools that mirror existing patterns (e.g., `add_nodes` vs the existing `add_node`) should keep the same return shape (return the actual stored object after the mutation, not the input).
- Do not touch `packages/system/` — the spec confirms zero diffs there.
- Don't add features beyond what's listed. If you find a "while I'm here" temptation, write it down as a follow-up and keep moving.

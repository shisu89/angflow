# Agent Tool-Surface Completeness — Design

**Date:** 2026-06-03
**Status:** Approved design; ready for implementation planning
**Scope:** Sub-project 1 of 3 in the "solidify the agentic entry point" effort. Adds auto-layout (`layout_nodes`), node/edge type discovery (`list_node_types`, `list_edge_types`), and runtime data-driven node templates (`register_node_template` family) to `AngflowAgentBridge`, backed by a new signal-based per-flow template registry and a generic `TemplateNodeComponent` renderer. Purely additive; no breaking changes.

## Context

`AngflowAgentBridge` (in `packages/angular/src/lib/agent/`) exposes 42 JSON-RPC tools, a transactional `apply_changes`, bridge-scoped undo/redo, and push events. See `packages/angular/AGENT_BRIDGE.md` for the current catalog and the prior expansion spec at `docs/superpowers/specs/2026-05-16-agent-bridge-tooling-expansion-design.md`.

This spec is the first of three sequenced sub-projects agreed during brainstorming:

1. **Tool-surface completeness** (this spec) — make the tool catalog complete enough that an agent can build visually meaningful, well-laid-out diagrams without host-side component work.
2. **`@angflow/mcp` server** (future spec) — a standalone Node package that connects to a live canvas via the existing WebSocket transport and re-exposes `AGENT_TOOL_SCHEMAS` as MCP tools for Claude Desktop / Claude Code / Cursor.
3. **In-browser chat harness** (future spec) — `provideAgentChat({ complete })` + a chat panel component running the tool-use loop in-process against the bridge.

### Cross-cutting decisions binding on future sub-projects

Recorded here so they are not lost before specs 2 and 3 are written:

- **No API keys in the library or the browser.** The chat harness takes a pluggable `complete(req): Promise<response>` function. The documented production path is a small host-owned backend proxy holding the key as a server env var; a ~30-line reference proxy ships in `examples/angular`. No BYOK mode, no direct-from-browser Anthropic calls.
- **Both runtimes share `AGENT_TOOL_SCHEMAS`** as the single source of tool truth.
- **Sub-projects 2 and 3 are independent of each other**; both depend on this spec landing first.

## Problem

An agent driving the canvas today is limited in three concrete ways:

1. **Every agent-built node is a generic gray box.** Visually meaningful nodes require an Angular developer to write and register components at compile time. The agent cannot introduce a "service" or "database" card on its own, so agent-generated diagrams look like wireframes.
2. **Agents are bad at choosing coordinates.** Without a layout tool, the model must do positional arithmetic; multi-node graphs end up overlapping. There is no "build it, then tidy it" affordance.
3. **The agent cannot discover the host's vocabulary.** There is no way to ask "what node types does this app render?", so the agent either guesses type names or ignores host components entirely.

## Goals

- Add `layout_nodes` backed by a host-pluggable layout function, plus a turnkey `dagreLayout` adapter shipped from a new `@angflow/angular/layout` subpath export (optional dagre peer dependency; zero impact on the core bundle).
- Add `list_node_types` / `list_edge_types` discovery tools reporting name + source (`builtin` | `host` | `template`).
- Add `register_node_template`, `unregister_node_template`, `list_node_templates` — runtime registration of data-driven node kinds rendered by a new generic `TemplateNodeComponent` ("Card + slots/variants" expressiveness).
- Render agent-registered templates live via a signal-backed per-flow `NodeTemplateRegistry`, inserted as a new step in the node renderer's type-resolution order.
- Keep the template system free of code execution and HTML injection: dotted-path interpolation only, allowlisted badge palette, no raw HTML.
- Update `AGENT_BRIDGE.md` in the same commit per the CLAUDE.md repository rule.
- Zero diffs in `packages/system/`.

## Non-goals

- **Edge templates.** Edges are paths + labels; the card spec does not map onto them. `list_edge_types` ships for discovery, but `register_edge_template` is deferred until a concrete need defines its spec shape.
- **Copy/paste, pane/interactivity toggles.** Cut as YAGNI during brainstorming (user-confirmed).
- **Template persistence.** Registered templates live in memory per flow. Hosts that want them across reloads re-register on boot (e.g., replaying `list_node_templates` output). No localStorage, no serialization API.
- **Undo/redo of template registration.** Templates are rendering configuration, not graph state; they are never captured in history snapshots (see History semantics).
- **Bundling a layout engine in the core.** dagre is reachable only via the `@angflow/angular/layout` subpath and only if the host imports it.
- **ELK support.** The pluggable `AgentLayoutFn` contract means hosts can wire elkjs themselves; we ship only the dagre adapter.
- **MCP server and chat harness.** Sub-projects 2 and 3; separate specs.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Sub-project decomposition | 1) tool surface → 2) MCP server → 3) chat harness | Three independently shippable pieces sharing `AGENT_TOOL_SCHEMAS`; the tool surface is the foundation both runtimes consume. User-confirmed. |
| Layout engine | Pluggable `AgentLayoutFn` on `provideAgentBridge` + shipped `dagreLayout` adapter via subpath export | Keeps `@angflow/angular` core dependency-free (zoneless-first lean-core philosophy), stays turnkey (one import), and gives an escape hatch for ELK/custom without library changes. Same pluggable-contract shape as the future `complete()` fn. |
| dagre dependency type | Optional peer dependency of `@angflow/angular` | Only consumers importing `@angflow/angular/layout` need it; core consumers see no install-time change. |
| Template expressiveness | "Card + slots/variants": title, icon, accent, variant, badges, fields, body, handles | Middle option between "minimal card" (too constrained) and "sandboxed HTML" (XSS/sanitizer maintenance surface). User-confirmed. |
| Interpolation engine | Dotted-path resolver against `node.data` only (`{{data.x}}`, `showIf: 'data.x'`) | No `eval`, no expression language, no prototype-chain walking. Unknown paths render empty. Eliminates code-execution and injection classes by construction. |
| Badge colors | Fixed allowlisted palette keys (`slate`/`indigo`/`emerald`/`amber`/`rose`), not raw CSS | Prevents style-attribute injection through agent-supplied strings. `accent` is the one raw CSS color, bound via Angular style binding which sanitizes. |
| Registry scope | Per flow (keyed by the bridge's `flowId`), signal-backed | Matches the bridge's flow model; registering a template on flow A must not restyle flow B. Signal write → renderer reflows live with no host code (zoneless rule 2). |
| Renderer integration | New resolution step between host `nodeTypes` and `DefaultNodeComponent` | Content templates and host components keep priority; agent templates extend rather than override the host's vocabulary. |
| Name shadowing | `register_node_template` rejects names claimed by built-in or host types with `-32602` | Resolution order would silently shadow the template otherwise; failing loudly beats a silent no-op. |
| Template overwrite | Re-registering an existing *template* name overwrites; existing nodes re-render | Lets an agent iterate on a design ("make the badge amber") without delete/re-add churn. |
| Discovery return shape | `{ types: [{ name, source }] }` | `source` tells the agent whether a type's `data` contract is knowable (`template` — introspect via `list_node_templates`) or host-defined (`host` — use cautiously). |
| `layout_nodes` history | One history entry per successful call (added to `MUTATING_TOOLS`) | A layout pass is a single user-meaningful action; one `undo` reverts it entirely. |
| `layout_nodes` without a configured fn | Distinct, actionable error ("no layout function configured") | The agent must be able to distinguish missing capability from bad params. |
| Unknown ids in layout output | Dropped with one `console.warn`; known ids still apply | A host layout fn returning a few stray ids should not fail the whole pass; a *throw* still rolls back cleanly. |
| Template registration vs. history | Never captured in undo/redo snapshots | Templates change rendering, not `{ nodes, edges }`. Documented explicitly: `register_node_template` → `add_node` → `undo` keeps the template, removes the node. |
| Versioning | `@angflow/angular` minor bump | Additive but substantial new public surface (subpath export, new component, new tools). |

## Architecture

### New files

```
packages/angular/src/lib/
  agent/
    agent-bridge.service.ts        # + 6 handlers; layout fn config; MUTATING_TOOLS += layout_nodes
    tool-schemas.ts                # + 6 schema entries
    node-template-registry.ts      # NEW — signal-backed per-flow registry
    provide-agent-bridge.ts        # + optional `layout` config key
  components/nodes/
    template-node.component.ts     # NEW — generic Card+slots/variants renderer
  layout/                          # NEW subpath export @angflow/angular/layout
    dagre-layout.ts                # dagreLayout: AgentLayoutFn
    index.ts
  types/
    node-template.ts               # NEW — NodeTemplateSpec, AgentLayoutFn
```

### NodeTemplateRegistry

A small class (not an injectable; owned by the bridge, one instance per registered flow, torn down on `unregister` / re-registration with a different service — same lifecycle as the per-flow history stack):

- `templates: Signal<ReadonlyMap<string, NodeTemplateSpec>>` — the reactive source the renderer reads.
- `register(name, spec)` / `unregister(name)` / `list()`.
- Validation lives in the bridge handler (so `-32602` errors carry JSON-RPC shape), not the registry.

The renderer needs access to the registry for *its* flow. The bridge exposes the registry through `NgFlowService` (the service the renderer already reaches via `FlowStore`/DI): `register(flowId, service)` attaches the registry to the service; the node renderer reads it through a store signal. Exact wiring (store signal vs. service getter) is an implementation-plan detail; the contract is: **renderer resolution is reactive to registry changes with no host involvement.**

### Node type resolution order (node-renderer.component.ts)

```
1. content-projected <ng-template ngFlowNodeType>   (existing)
2. host nodeTypes[type] component                    (existing)
3. agent template registry[type] → TemplateNodeComponent(spec)   ← NEW
4. DefaultNodeComponent                              (existing)
```

Step 3 renders `TemplateNodeComponent` via the existing `ngComponentOutlet` path, with the spec supplied alongside the standard node inputs/`NG_FLOW_NODE_CONTEXT` injector.

### Discovery signal

The store gains a `registeredNodeTypeNames` (and edge equivalent) computed from: built-in type keys ∪ host `nodeTypes` input keys ∪ content-template keys ∪ registry keys, each tagged with its source. `NgFlowComponent` feeds its `nodeTypes` input keys and `nodeTemplateMap` keys into the store; the bridge reads the union through `NgFlowService`.

### TemplateNodeComponent

Reads its `NodeTemplateSpec` plus the live node via the existing `NG_FLOW_NODE_CONTEXT` (signals for `data`, `selected`, `id`, …), so it is reactive and selection-aware identically to hand-authored nodes. Handles render through the existing `<ng-flow-handle>` component so connection behavior, handle bounds, and `XYHandle` interop are inherited, not reimplemented. Ships with minimal scoped styles consistent with the library's existing node CSS; `variant: 'compact' | 'detailed'` switches a class.

### NodeTemplateSpec

```ts
export interface NodeTemplateSpec {
  /** Card title. Supports {{data.x}} interpolation against node.data. */
  title?: string;
  /** Icon name resolved against a small built-in glyph set; unknown names render nothing. */
  icon?: string;
  /** Accent color (header bar / left border). Any CSS color string; bound via Angular style binding. */
  accent?: string;
  /** Layout density. Default 'detailed'. */
  variant?: 'compact' | 'detailed';
  /** Small colored pills under the title. */
  badges?: Array<{ text: string; color?: NodeTemplateBadgeColor; showIf?: string }>;
  /** Labeled rows in the body. */
  fields?: Array<{ label: string; value: string; showIf?: string }>;
  /** Free body text (interpolated), shown under fields. */
  body?: string;
  /** Connection handles. Defaults: one target left, one source right when omitted. */
  handles?: Array<{
    type: 'source' | 'target';
    position?: 'top' | 'right' | 'bottom' | 'left';
    id?: string;
  }>;
}

export type NodeTemplateBadgeColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';
```

**Interpolation semantics.** `{{data.x.y}}` and `showIf: 'data.x'` resolve by splitting on `.` and walking own-properties of `node.data` (the leading `data` segment is required; anything else resolves to undefined). Resolved values are stringified for display (`null`/`undefined` → empty string); `showIf` uses truthiness. No function calls, no bracket syntax, no prototype access (`hasOwnProperty` walk). Interpolated output is rendered as text bindings only — never `innerHTML`.

### AgentLayoutFn and the dagre adapter

```ts
export interface AgentLayoutOptions {
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
}

export type AgentLayoutFn = (
  nodes: Array<{ id: string; width: number; height: number; position: { x: number; y: number } }>,
  edges: Array<{ source: string; target: string }>,
  opts: AgentLayoutOptions
) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>;
```

- Configured via `provideAgentBridge({ layout: dagreLayout })`.
- `dagreLayout` lives in `@angflow/angular/layout` (new `package.json` exports entry + ng-packagr/rollup secondary entry point) and imports `@dagrejs/dagre`, declared as an **optional peer dependency**. Width/height fall back to measured dimensions, then to the library's default node size, so layout works before first paint measurement if needed.
- The handler resolves node dimensions from internal nodes (measured sizes), builds the induced subgraph when `nodeIds` is given (only edges whose both endpoints are in the subset), awaits the layout fn, and applies positions inside one `service.batch()`.

## New tools

All follow existing conventions: optional `flowId`, `-32602` validation before touching the service, schemas added to `AGENT_TOOL_SCHEMAS`.

### Discovery

| Tool | Params | Returns |
|---|---|---|
| `list_node_types` | — | `{ types: Array<{ name: string; source: 'builtin' \| 'host' \| 'template' }> }` |
| `list_edge_types` | — | same shape |

### Templates

| Tool | Params | Returns / behavior |
|---|---|---|
| `register_node_template` | `name: string`, `spec: NodeTemplateSpec` | Validates name (non-empty, not shadowing builtin/host) and spec shape; overwrites an existing template of the same name; returns `{ name }` |
| `unregister_node_template` | `name: string` | Returns `{ removed: boolean }`; nodes of that type fall back to `DefaultNodeComponent` |
| `list_node_templates` | — | `{ templates: Array<{ name: string; spec: NodeTemplateSpec }> }` |

### Layout

| Tool | Params | Returns |
|---|---|---|
| `layout_nodes` | `direction?: 'TB'\|'LR'\|'BT'\|'RL'` (default `'TB'`), `nodeIds?: string[]` (omit = all), `nodeSep?: number`, `rankSep?: number`, `fitView?: boolean` (default `true`) | `{ positions: Record<string, { x: number; y: number }> }` |

Handler flow: validate params → resolve internal nodes (measured dims) → induced subgraph if `nodeIds` → call host layout fn (await) → apply positions in one `batch()` → capture one history entry → optional `fit_view` → return applied positions.

## Error handling

| Condition | Code | Notes |
|---|---|---|
| Malformed spec (bad palette key, unknown variant, bad handle position/type), empty/shadowing template name, bad `direction`, unknown `nodeIds` entries | `-32602` | Message names the offending field |
| Host layout fn throws / rejects | `-32603` | Whole pass rolls back: no positions applied, no history entry |
| Layout fn returns unknown node ids | — (success) | Unknown ids dropped with one `console.warn`; known ids applied |
| `layout_nodes` with no configured layout fn | `-32601`, message `"layout_nodes unavailable: no layout function configured"` | The tool is effectively absent from this deployment; distinct message distinguishes missing capability from bad params |

## History semantics

- `layout_nodes` (successful, ≥1 position applied) captures **one** history entry; added to `MUTATING_TOOLS`.
- `register_node_template` / `unregister_node_template` capture **no** history entry and are never restored by `undo`/`redo`. Documented in `AGENT_BRIDGE.md`: an agent that registers a template, adds a node, then undoes, keeps the template and loses the node.
- Discovery and `list_node_templates` are read-only.

## Push events

No new event types. Template registration does not emit `flow.state` (graph unchanged); the live re-render is driven by the registry signal. `layout_nodes` emits the usual `flow.history` (sync) + coalesced `flow.state` (microtask) like any mutating tool.

## Testing

Extends `agent-bridge.spec.ts` plus new spec files:

1. **Registry** — register / overwrite / unregister; shadowing rejection; signal reactivity (resolution recomputes when the registry changes); per-flow isolation (flow A's template invisible to flow B); teardown on flow re-registration.
2. **TemplateNodeComponent** — interpolation incl. missing paths → empty; `showIf` truthiness; badge palette allowlisting; default handles when `handles` omitted; handles connectable through existing handle machinery; variant classes; selection styling via context.
3. **Bridge handlers** — each tool: happy path, validation failures, `layout_nodes` with/without configured fn, subset layout induced-subgraph correctness, one-history-entry rule, rollback on layout throw, unknown-id drop with warn.
4. **dagreLayout adapter** — deterministic positions for a small known graph; `TB` vs `LR` orientation differences.
5. **Security** — `<script>` in `title` renders as inert text; `accent: 'red; background:url(...)'` does not escape the style binding; `{{constructor.constructor}}` / `{{__proto__.x}}` resolve to empty; `showIf: 'data.constructor'` does not walk the prototype chain.

## Example app

Extend the agent-bridge example (or add a sibling `agent-templates` example) demonstrating in console snippets: `register_node_template('service', …)` → `add_nodes` of that type → `layout_nodes` → `undo`. App config wires `provideAgentBridge({ layout: dagreLayout })` as living documentation of the subpath import.

## Documentation

`AGENT_BRIDGE.md` updated in the same commit: 6 new catalog entries, template spec reference, interpolation/security semantics, layout configuration, history notes, and removal of the now-shipped items from "Known gaps" (auto-layout, runtime type registration), leaving copy/paste, pane toggles, and user-driven undo as remaining gaps.

## Versioning

`@angflow/angular` minor bump. No `@angflow/system` changes.

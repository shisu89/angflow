# Agent Tool-Surface Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-layout (`layout_nodes`), node/edge type discovery (`list_node_types`/`list_edge_types`), and runtime data-driven node templates (`register_node_template` family) to `AngflowAgentBridge`, per the spec at `docs/superpowers/specs/2026-06-03-agent-tool-surface-completeness-design.md`.

**Architecture:** A signal-backed template registry lives in `FlowStore` (already per-flow — one instance per `<ng-flow>`), accessed through new `NgFlowService` methods. The node renderer gains one resolution step that maps registered template names to a new generic `TemplateNodeComponent`. Layout is a host-pluggable `AgentLayoutFn` configured on `provideAgentBridge`, with a `dagreLayout` adapter shipped from a new `@angflow/angular/layout` subpath export so dagre stays out of the core bundle.

**Tech Stack:** Angular 19+ signals (zoneless), vitest + Angular TestBed (jsdom), plain `ngc` build (no ng-packagr — subpath export is just a `package.json` `exports` entry pointing into `dist/esm/lib/layout/`), `@dagrejs/dagre` as optional peer dep.

**Repository rules that bind every task:**
- Zoneless: never inject `NgZone`; drive view updates via signal writes (CLAUDE.md).
- `AGENT_BRIDGE.md` must be updated in the same commit as any tool/bridge change. Tasks 5–7 each add tools; their commits each include the corresponding `AGENT_BRIDGE.md` rows (Task 9 does the full-document pass).
- Bridge handlers call `NgFlowService` methods only — never reach into `FlowStore` directly from the bridge.

**Key commands** (run from `packages/angular/`):
- All tests: `npx vitest run`
- One file: `npx vitest run src/lib/utils/template-interpolation.spec.ts`
- Typecheck: `npm run typecheck`
- Build: `npm run build`

---

## Pre-flight (do before Task 1)

The working tree currently has ~40 modified, uncommitted files including `node-renderer.component.ts` and `ng-flow.component.ts`, which this plan modifies. **Do not start until the working tree is clean** — otherwise task commits will swallow unrelated hunks. Ask the user to commit or stash their work; do not commit it yourself.

Verify clean: `git status --porcelain` → empty output.

---

### Task 1: NodeTemplateSpec types + interpolation utilities

**Files:**
- Create: `packages/angular/src/lib/types/node-template.ts`
- Modify: `packages/angular/src/lib/types/index.ts`
- Create: `packages/angular/src/lib/utils/template-interpolation.ts`
- Test: `packages/angular/src/lib/utils/template-interpolation.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/utils/template-interpolation.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveTemplatePath,
  interpolateTemplateString,
  isTemplateConditionTrue,
} from './template-interpolation';

describe('resolveTemplatePath', () => {
  it('resolves a simple data path', () => {
    expect(resolveTemplatePath('data.name', { name: 'api' })).toBe('api');
  });

  it('resolves a nested path', () => {
    expect(resolveTemplatePath('data.config.port', { config: { port: 8080 } })).toBe(8080);
  });

  it('returns undefined for a missing path', () => {
    expect(resolveTemplatePath('data.missing', { name: 'api' })).toBeUndefined();
  });

  it('returns undefined when the leading segment is not "data"', () => {
    expect(resolveTemplatePath('name', { name: 'api' })).toBeUndefined();
    expect(resolveTemplatePath('window.location', {})).toBeUndefined();
  });

  it('returns the whole data object for the bare "data" path', () => {
    const data = { a: 1 };
    expect(resolveTemplatePath('data', data)).toBe(data);
  });

  it('does not walk the prototype chain', () => {
    expect(resolveTemplatePath('data.constructor', {})).toBeUndefined();
    expect(resolveTemplatePath('data.toString', {})).toBeUndefined();
    expect(resolveTemplatePath('data.constructor.constructor', {})).toBeUndefined();
  });

  it('rejects expressions with brackets, parens, or spaces', () => {
    expect(resolveTemplatePath('data["a"]', { a: 1 })).toBeUndefined();
    expect(resolveTemplatePath('data.a()', { a: () => 1 })).toBeUndefined();
    expect(resolveTemplatePath('data .a', { a: 1 })).toBeUndefined();
  });

  it('returns undefined when data is null or a primitive mid-walk', () => {
    expect(resolveTemplatePath('data.a.b', { a: null })).toBeUndefined();
    expect(resolveTemplatePath('data.a.b', { a: 5 })).toBeUndefined();
    expect(resolveTemplatePath('data.a', null)).toBeUndefined();
  });
});

describe('interpolateTemplateString', () => {
  it('replaces {{data.x}} with the value', () => {
    expect(interpolateTemplateString('Port: {{data.port}}', { port: 8080 })).toBe('Port: 8080');
  });

  it('replaces multiple placeholders', () => {
    expect(
      interpolateTemplateString('{{data.name}}:{{data.port}}', { name: 'api', port: 80 }),
    ).toBe('api:80');
  });

  it('renders empty string for unresolvable placeholders', () => {
    expect(interpolateTemplateString('x{{data.missing}}y', {})).toBe('xy');
  });

  it('renders empty string for null and undefined values', () => {
    expect(interpolateTemplateString('[{{data.a}}]', { a: null })).toBe('[]');
  });

  it('tolerates whitespace inside braces', () => {
    expect(interpolateTemplateString('{{ data.name }}', { name: 'api' })).toBe('api');
  });

  it('stringifies object values as JSON', () => {
    expect(interpolateTemplateString('{{data.cfg}}', { cfg: { a: 1 } })).toBe('{"a":1}');
  });

  it('leaves text without placeholders untouched', () => {
    expect(interpolateTemplateString('plain', {})).toBe('plain');
  });

  it('renders dangerous-looking expressions as empty, not as code', () => {
    expect(interpolateTemplateString('{{constructor.constructor}}', {})).toBe('');
    expect(interpolateTemplateString('{{data.__proto__.polluted}}', {})).toBe('');
  });

  it('passes <script> through as inert text (caller binds as text, never HTML)', () => {
    expect(interpolateTemplateString('<script>alert(1)</script>', {})).toBe(
      '<script>alert(1)</script>',
    );
  });
});

describe('isTemplateConditionTrue', () => {
  it('returns true when expr is undefined (no condition)', () => {
    expect(isTemplateConditionTrue(undefined, {})).toBe(true);
  });

  it('uses truthiness of the resolved value', () => {
    expect(isTemplateConditionTrue('data.env', { env: 'prod' })).toBe(true);
    expect(isTemplateConditionTrue('data.env', { env: '' })).toBe(false);
    expect(isTemplateConditionTrue('data.env', {})).toBe(false);
    expect(isTemplateConditionTrue('data.n', { n: 0 })).toBe(false);
  });

  it('returns false for prototype-chain expressions', () => {
    expect(isTemplateConditionTrue('data.constructor', {})).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/utils/template-interpolation.spec.ts`
Expected: FAIL — cannot resolve `./template-interpolation`.

- [ ] **Step 3: Create the types file**

Create `packages/angular/src/lib/types/node-template.ts`:

```ts
/**
 * Data-driven node template types for the agent bridge.
 *
 * A `NodeTemplateSpec` is pure JSON an agent can emit over the wire; the
 * library renders it with `TemplateNodeComponent`. Interpolation is a dotted
 * `{{data.x}}` path resolver against `node.data` only — no expressions, no
 * code execution. See `utils/template-interpolation.ts`.
 */

/** Allowlisted badge palette. Raw CSS is deliberately not accepted here. */
export type NodeTemplateBadgeColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';

export interface NodeTemplateBadge {
  /** Badge text. Supports {{data.x}} interpolation. */
  text: string;
  /** Palette key; defaults to 'slate'. */
  color?: NodeTemplateBadgeColor;
  /** Dotted data path; badge renders only when truthy (e.g. 'data.env'). */
  showIf?: string;
}

export interface NodeTemplateField {
  /** Row label (literal, not interpolated). */
  label: string;
  /** Row value. Supports {{data.x}} interpolation. */
  value: string;
  /** Dotted data path; row renders only when truthy. */
  showIf?: string;
}

export interface NodeTemplateHandle {
  type: 'source' | 'target';
  /** Defaults: target → 'left', source → 'right'. */
  position?: 'top' | 'right' | 'bottom' | 'left';
  id?: string;
}

export interface NodeTemplateSpec {
  /** Card title. Supports {{data.x}} interpolation. */
  title?: string;
  /** Icon name resolved against the built-in glyph set; unknown names render nothing. */
  icon?: string;
  /** Accent color (header text / left border). Any CSS color string. */
  accent?: string;
  /** Layout density. Default 'detailed'. */
  variant?: 'compact' | 'detailed';
  badges?: NodeTemplateBadge[];
  fields?: NodeTemplateField[];
  /** Free body text (interpolated), shown under fields. */
  body?: string;
  /** Defaults to one target handle (left) and one source handle (right) when omitted. */
  handles?: NodeTemplateHandle[];
}

// ── Layout ──────────────────────────────────────────────────────────────

export interface AgentLayoutOptions {
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
}

/**
 * Host-pluggable layout function for the `layout_nodes` agent tool.
 * Positions returned are top-left corners in flow coordinates.
 * See `dagreLayout` in `@angflow/angular/layout` for a turnkey adapter.
 */
export type AgentLayoutFn = (
  nodes: Array<{ id: string; width: number; height: number; position: { x: number; y: number } }>,
  edges: Array<{ source: string; target: string }>,
  opts: AgentLayoutOptions,
) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>;
```

Then add to `packages/angular/src/lib/types/index.ts` (after the existing exports):

```ts
export * from './node-template';
```

- [ ] **Step 4: Implement the interpolation utilities**

Create `packages/angular/src/lib/utils/template-interpolation.ts`:

```ts
/**
 * Dotted-path interpolation for node template specs.
 *
 * Security stance: the only "language" is `data(.identifier)*`. No brackets,
 * no calls, no expressions. Resolution walks own-properties only, so
 * `data.constructor` / prototype-chain access resolves to undefined. Callers
 * must render results via text bindings — never innerHTML.
 */

const PATH_RE = /^data(\.[A-Za-z_$][\w$]*)*$/;

/** Resolve a dotted `data.x.y` path against a node's `data`. Unknown → undefined. */
export function resolveTemplatePath(expr: string, data: unknown): unknown {
  if (!PATH_RE.test(expr)) return undefined;
  const segments = expr.split('.').slice(1); // drop the leading 'data'
  let current: unknown = data;
  if (current === null || current === undefined) return undefined;
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, seg)) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** Replace every `{{data.x}}` in `template` with its resolved value (or ''). */
export function interpolateTemplateString(template: string, data: unknown): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const value = resolveTemplatePath(expr, data);
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return String(value);
  });
}

/** Evaluate a `showIf` condition: undefined → true; otherwise truthiness of the path. */
export function isTemplateConditionTrue(expr: string | undefined, data: unknown): boolean {
  if (expr === undefined) return true;
  return !!resolveTemplatePath(expr, data);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/utils/template-interpolation.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/types/node-template.ts src/lib/types/index.ts src/lib/utils/template-interpolation.ts src/lib/utils/template-interpolation.spec.ts
git commit -m "feat(angular): add NodeTemplateSpec types and safe dotted-path interpolation"
```

---

### Task 2: FlowStore registry signals + NgFlowService template/discovery API

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (add signals near the other config signals, ~line 145)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (add methods at the end of the class)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (constructor effects, ~line 692)
- Test: `packages/angular/src/lib/services/ng-flow.service.template.spec.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/services/ng-flow.service.template.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
import type { NodeTemplateSpec } from '../types/node-template';

function newFlow(): { flow: NgFlowService; store: FlowStore } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const child = Injector.create({
    providers: [FlowStore, NgFlowService],
    parent: TestBed.inject(Injector),
  });
  return { flow: child.get(NgFlowService), store: child.get(FlowStore) };
}

describe('NgFlowService node templates', () => {
  let flow: NgFlowService;
  let store: FlowStore;

  beforeEach(() => {
    ({ flow, store } = newFlow());
  });

  it('registerNodeTemplate adds a template readable via getNodeTemplates', () => {
    const spec: NodeTemplateSpec = { title: '{{data.name}}' };
    flow.registerNodeTemplate('service', spec);
    expect(flow.getNodeTemplates()).toEqual([{ name: 'service', spec }]);
    expect(store.nodeTemplates().get('service')).toBe(spec);
  });

  it('re-registering the same name overwrites the spec', () => {
    flow.registerNodeTemplate('service', { title: 'v1' });
    flow.registerNodeTemplate('service', { title: 'v2' });
    expect(flow.getNodeTemplates()).toEqual([{ name: 'service', spec: { title: 'v2' } }]);
  });

  it('unregisterNodeTemplate removes and reports whether it existed', () => {
    flow.registerNodeTemplate('service', {});
    expect(flow.unregisterNodeTemplate('service')).toBe(true);
    expect(flow.unregisterNodeTemplate('service')).toBe(false);
    expect(flow.getNodeTemplates()).toEqual([]);
  });

  it('registry writes replace the map reference (signal consumers re-fire)', () => {
    const before = store.nodeTemplates();
    flow.registerNodeTemplate('a', {});
    expect(store.nodeTemplates()).not.toBe(before);
  });

  it('two flows have isolated registries', () => {
    const other = newFlow();
    other.flow.registerNodeTemplate('only-there', {});
    expect(flow.getNodeTemplates()).toEqual([]);
  });
});

describe('NgFlowService type discovery', () => {
  let flow: NgFlowService;
  let store: FlowStore;

  beforeEach(() => {
    ({ flow, store } = newFlow());
  });

  it('reports built-in node types', () => {
    const types = flow.getNodeTypeNames();
    for (const name of ['default', 'input', 'output', 'group']) {
      expect(types).toContainEqual({ name, source: 'builtin' });
    }
  });

  it('reports host node types from the store signal', () => {
    store.hostNodeTypeNames.set(['decision']);
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'decision', source: 'host' });
  });

  it('reports content-projected template types as host', () => {
    store.contentNodeTemplateNames.set(['card']);
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'card', source: 'host' });
  });

  it('host overrides builtin for the same name (mirrors renderer precedence)', () => {
    store.hostNodeTypeNames.set(['default']);
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'default', source: 'host' });
    expect(
      flow.getNodeTypeNames().filter((t) => t.name === 'default'),
    ).toHaveLength(1);
  });

  it('reports registered templates with source "template"', () => {
    flow.registerNodeTemplate('service', {});
    expect(flow.getNodeTypeNames()).toContainEqual({ name: 'service', source: 'template' });
  });

  it('reports built-in and host edge types', () => {
    store.hostEdgeTypeNames.set(['wavy']);
    const types = flow.getEdgeTypeNames();
    for (const name of ['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier']) {
      expect(types).toContainEqual({ name, source: 'builtin' });
    }
    expect(types).toContainEqual({ name: 'wavy', source: 'host' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/services/ng-flow.service.template.spec.ts`
Expected: FAIL — `flow.registerNodeTemplate is not a function` / `store.hostNodeTypeNames` undefined.

- [ ] **Step 3: Add the FlowStore signals**

In `packages/angular/src/lib/services/flow-store.service.ts`, add the import:

```ts
import type { NodeTemplateSpec } from '../types/node-template';
```

and add these signals next to the other configuration signals (after `elevateNodesOnSelect` / `elevateEdgesOnSelect`, ~line 146):

```ts
  // ── Agent template registry & type discovery ─────────────────────────
  /** Data-driven node templates registered at runtime (via the agent bridge). */
  readonly nodeTemplates = signal<ReadonlyMap<string, NodeTemplateSpec>>(new Map());
  /** Type names supplied by the host via the `nodeTypes` input on <ng-flow>. */
  readonly hostNodeTypeNames = signal<string[]>([]);
  /** Type names supplied by the host via the `edgeTypes` input on <ng-flow>. */
  readonly hostEdgeTypeNames = signal<string[]>([]);
  /** Type names from content-projected `<ng-template ngFlowNodeType>` templates. */
  readonly contentNodeTemplateNames = signal<string[]>([]);
```

- [ ] **Step 4: Add the NgFlowService methods**

In `packages/angular/src/lib/services/ng-flow.service.ts`, add the import:

```ts
import type { NodeTemplateSpec } from '../types/node-template';
```

Add module-level constants above the class (these mirror the renderer maps in
`node-renderer.component.ts` / `edge-renderer.component.ts`; keep in sync — a
comment in each renderer file is added in Task 4):

```ts
/** Keep in sync with `builtInNodeTypes` in container/node-renderer/node-renderer.component.ts. */
const BUILT_IN_NODE_TYPE_NAMES = ['default', 'input', 'output', 'group'] as const;
/** Keep in sync with `builtInEdgeTypes` in container/edge-renderer/edge-renderer.component.ts. */
const BUILT_IN_EDGE_TYPE_NAMES = ['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier'] as const;
```

Add these methods at the end of the `NgFlowService` class:

```ts
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
```

Check the file's existing imports: `Signal` and `computed` are already imported from `@angular/core` (the class uses them at the top for `nodes`, `edges`, etc.).

- [ ] **Step 5: Sync host type names from NgFlowComponent inputs**

In `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`, inside the constructor where the other input→store sync effects live (after the `isValidConnection` effect, ~line 712), add:

```ts
    // Sync registered type names → store for agent-bridge discovery.
    effect(() => {
      this.store.hostNodeTypeNames.set(Object.keys(this.nodeTypes()));
      this.store.hostEdgeTypeNames.set(Object.keys(this.edgeTypes()));
      this.store.contentNodeTemplateNames.set(Array.from(this.nodeTemplateMap().keys()));
    });
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/services/ng-flow.service.template.spec.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite, typecheck, commit**

Run: `npx vitest run && npm run typecheck`
Expected: all green.

```bash
git add src/lib/services/flow-store.service.ts src/lib/services/ng-flow.service.ts src/lib/services/ng-flow.service.template.spec.ts src/lib/container/ng-flow/ng-flow.component.ts
git commit -m "feat(angular): per-flow node template registry and type-name discovery on NgFlowService"
```

---

### Task 3: TemplateNodeComponent (generic Card + slots/variants renderer)

**Files:**
- Create: `packages/angular/src/lib/components/nodes/template-node.component.ts`
- Test: `packages/angular/src/lib/components/nodes/template-node.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/components/nodes/template-node.component.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { NODE_ID } from '../../services/tokens';
import { TemplateNodeComponent } from './template-node.component';
import type { NodeTemplateSpec } from '../../types/node-template';

function mount(
  spec: NodeTemplateSpec,
  data: Record<string, unknown>,
): { fixture: ComponentFixture<TemplateNodeComponent>; el: HTMLElement; store: FlowStore } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      FlowStore,
      NgFlowService,
      { provide: NODE_ID, useValue: 'n1' },
    ],
  });
  const store = TestBed.inject(FlowStore);
  store.nodeTemplates.set(new Map([['service', spec]]));
  const fixture = TestBed.createComponent(TemplateNodeComponent);
  fixture.componentRef.setInput('id', 'n1');
  fixture.componentRef.setInput('type', 'service');
  fixture.componentRef.setInput('data', data);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, store };
}

describe('TemplateNodeComponent', () => {
  it('renders an interpolated title as text', () => {
    const { el } = mount({ title: '{{data.name}}' }, { name: 'api' });
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toBe('api');
  });

  it('renders <script> in interpolated values as inert text', () => {
    const { el } = mount({ title: '{{data.name}}' }, { name: '<script>alert(1)</script>' });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toContain('<script>');
  });

  it('renders fields with labels and interpolated values', () => {
    const { el } = mount(
      { fields: [{ label: 'Port', value: '{{data.port}}' }] },
      { port: 8080 },
    );
    expect(el.querySelector('.ng-flow__template-node__field dt')?.textContent).toBe('Port');
    expect(el.querySelector('.ng-flow__template-node__field dd')?.textContent).toBe('8080');
  });

  it('hides fields whose showIf is falsy', () => {
    const { el } = mount(
      {
        fields: [
          { label: 'Port', value: '{{data.port}}', showIf: 'data.port' },
          { label: 'Env', value: '{{data.env}}', showIf: 'data.env' },
        ],
      },
      { port: 8080 },
    );
    const fields = el.querySelectorAll('.ng-flow__template-node__field');
    expect(fields).toHaveLength(1);
    expect(fields[0].querySelector('dt')?.textContent).toBe('Port');
  });

  it('renders badges with allowlisted palette classes, defaulting unknown colors to slate', () => {
    const { el } = mount(
      {
        badges: [
          { text: 'prod', color: 'amber' },
          { text: 'x', color: 'red; background:url(x)' as never },
        ],
      },
      {},
    );
    const badges = el.querySelectorAll('.ng-flow__template-node__badge');
    expect(badges).toHaveLength(2);
    expect(badges[0].classList.contains('ng-flow__template-node__badge--amber')).toBe(true);
    expect(badges[1].classList.contains('ng-flow__template-node__badge--slate')).toBe(true);
    // The malicious string must not appear in any class or style attribute.
    expect(el.innerHTML).not.toContain('url(x)');
  });

  it('renders default handles (target left, source right) when handles omitted', () => {
    const { el } = mount({}, {});
    const handles = el.querySelectorAll('.ng-flow__handle');
    expect(handles).toHaveLength(2);
  });

  it('renders declared handles', () => {
    const { el } = mount(
      { handles: [{ type: 'target', position: 'top' }, { type: 'source', position: 'bottom' }, { type: 'source', position: 'right', id: 'aux' }] },
      {},
    );
    expect(el.querySelectorAll('.ng-flow__handle')).toHaveLength(3);
  });

  it('applies the compact variant class', () => {
    const { el } = mount({ variant: 'compact' }, {});
    expect(
      el.querySelector('.ng-flow__template-node--compact'),
    ).not.toBeNull();
  });

  it('renders a known icon and skips unknown icon names', () => {
    const withIcon = mount({ icon: 'database' }, {});
    expect(withIcon.el.querySelector('svg.ng-flow__template-node__icon')).not.toBeNull();
    const withoutIcon = mount({ icon: 'no-such-icon' }, {});
    expect(withoutIcon.el.querySelector('svg.ng-flow__template-node__icon')).toBeNull();
  });

  it('re-renders when the registry spec is overwritten', () => {
    const { fixture, el, store } = mount({ title: 'v1' }, {});
    store.nodeTemplates.set(new Map([['service', { title: 'v2' }]]));
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toBe('v2');
  });

  it('renders nothing when no spec matches its type', () => {
    const { fixture, el, store } = mount({ title: 'x' }, {});
    store.nodeTemplates.set(new Map());
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__template-node')).toBeNull();
  });
});
```

Note for the executor: if `ng-flow-handle` requires additional injected context not provided here, check how `HandleComponent` is injected (`src/lib/components/handle/handle.component.ts`) and add the missing providers to the test module rather than weakening assertions. The handle CSS class to assert on is whatever `HandleComponent` puts on its host — verify with `el.innerHTML` in a debug run and adjust the selector if it is not `.ng-flow__handle`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/nodes/template-node.component.spec.ts`
Expected: FAIL — cannot resolve `./template-node.component`.

- [ ] **Step 3: Implement the component**

Create `packages/angular/src/lib/components/nodes/template-node.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Position } from '@angflow/system';
import { HandleComponent } from '../handle/handle.component';
import { FlowStore } from '../../services/flow-store.service';
import type { NodeTemplateBadgeColor } from '../../types/node-template';
import {
  interpolateTemplateString,
  isTemplateConditionTrue,
} from '../../utils/template-interpolation';

const POSITION_MAP: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const BADGE_COLORS = new Set<NodeTemplateBadgeColor>(['slate', 'indigo', 'emerald', 'amber', 'rose']);

/**
 * Built-in icon glyphs (24×24 stroke paths). Unknown names render nothing.
 * Deliberately tiny — hosts wanting richer icons register their own
 * component node types instead.
 */
const ICONS: Record<string, string> = {
  database:
    'M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3Zm0 0v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01',
  queue: 'M4 6h16M4 12h16M4 18h10',
  cloud: 'M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.2 9.6 4.2 4.2 0 0 1 16.8 18H7Z',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21a7 7 0 0 1 14 0',
  document: 'M6 2h8l4 4v16H6V2Zm8 0v4h4',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  settings: 'M4 7h9M17 7h3M13 4v6M4 17h3M11 17h9M7 14v6',
};

/**
 * Generic renderer for data-driven node templates registered through the
 * agent bridge (`register_node_template`). Looks up its spec in the per-flow
 * registry (`FlowStore.nodeTemplates`) by its own `type`, so overwriting a
 * template re-renders every node of that type live.
 *
 * Security: every interpolated value is rendered through Angular text
 * bindings; badge colors are palette classes, never raw CSS; `accent` is the
 * only raw color and is bound via a style binding (sanitized by Angular).
 */
@Component({
  selector: 'ng-flow-template-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec(); as s) {
      <div
        class="ng-flow__template-node"
        [class.ng-flow__template-node--compact]="(s.variant ?? 'detailed') === 'compact'"
        [class.ng-flow__template-node--selected]="selected()"
        [style.borderLeftColor]="s.accent ?? null"
      >
        <div class="ng-flow__template-node__header" [style.color]="s.accent ?? null">
          @if (iconPath(); as path) {
            <svg
              class="ng-flow__template-node__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path [attr.d]="path" />
            </svg>
          }
          @if (title()) {
            <span class="ng-flow__template-node__title">{{ title() }}</span>
          }
        </div>
        @if (badges().length > 0) {
          <div class="ng-flow__template-node__badges">
            @for (b of badges(); track $index) {
              <span
                class="ng-flow__template-node__badge ng-flow__template-node__badge--{{ b.color }}"
                >{{ b.text }}</span
              >
            }
          </div>
        }
        @if (fields().length > 0) {
          <dl class="ng-flow__template-node__fields">
            @for (f of fields(); track $index) {
              <div class="ng-flow__template-node__field">
                <dt>{{ f.label }}</dt>
                <dd>{{ f.value }}</dd>
              </div>
            }
          </dl>
        }
        @if (bodyText()) {
          <p class="ng-flow__template-node__body">{{ bodyText() }}</p>
        }
        @for (h of handles(); track $index) {
          <ng-flow-handle
            [type]="h.type"
            [id]="h.id ?? null"
            [position]="h.position"
            [isConnectable]="isConnectable()"
          />
        }
      </div>
    }
  `,
  styles: [
    `
      .ng-flow__template-node {
        min-width: 140px;
        max-width: 280px;
        padding: 8px 10px;
        border: 1px solid #d4d4d8;
        border-left: 3px solid #94a3b8;
        border-radius: 6px;
        background: #ffffff;
        font-size: 12px;
        color: #1e293b;
      }
      .ng-flow__template-node--selected {
        box-shadow: 0 0 0 1px #6366f1;
      }
      .ng-flow__template-node--compact {
        padding: 4px 8px;
        min-width: 100px;
      }
      .ng-flow__template-node__header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
      }
      .ng-flow__template-node__icon {
        width: 16px;
        height: 16px;
        flex: none;
      }
      .ng-flow__template-node__badges {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }
      .ng-flow__template-node__badge {
        padding: 0 6px;
        border-radius: 999px;
        font-size: 10px;
        line-height: 16px;
      }
      .ng-flow__template-node__badge--slate { background: #f1f5f9; color: #475569; }
      .ng-flow__template-node__badge--indigo { background: #e0e7ff; color: #4338ca; }
      .ng-flow__template-node__badge--emerald { background: #d1fae5; color: #047857; }
      .ng-flow__template-node__badge--amber { background: #fef3c7; color: #b45309; }
      .ng-flow__template-node__badge--rose { background: #ffe4e6; color: #be123c; }
      .ng-flow__template-node__fields {
        margin: 6px 0 0;
      }
      .ng-flow__template-node__field {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .ng-flow__template-node__field dt {
        color: #64748b;
        font-weight: 400;
      }
      .ng-flow__template-node__field dd {
        margin: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .ng-flow__template-node__body {
        margin: 6px 0 0;
        color: #475569;
      }
    `,
  ],
})
export class TemplateNodeComponent {
  private readonly store = inject(FlowStore);

  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<Position>();
  readonly targetPosition = input<Position>();
  readonly dragHandle = input<string>();

  readonly spec = computed(() => this.store.nodeTemplates().get(this.type() ?? ''));

  readonly title = computed(() =>
    interpolateTemplateString(this.spec()?.title ?? '', this.data()),
  );

  readonly iconPath = computed(() => {
    const icon = this.spec()?.icon;
    return icon ? ICONS[icon] ?? null : null;
  });

  readonly badges = computed(() =>
    (this.spec()?.badges ?? [])
      .filter((b) => isTemplateConditionTrue(b.showIf, this.data()))
      .map((b) => ({
        text: interpolateTemplateString(b.text, this.data()),
        color: BADGE_COLORS.has(b.color as NodeTemplateBadgeColor) ? b.color! : 'slate',
      })),
  );

  readonly fields = computed(() =>
    (this.spec()?.fields ?? [])
      .filter((f) => isTemplateConditionTrue(f.showIf, this.data()))
      .map((f) => ({ label: f.label, value: interpolateTemplateString(f.value, this.data()) })),
  );

  readonly bodyText = computed(() =>
    interpolateTemplateString(this.spec()?.body ?? '', this.data()),
  );

  readonly handles = computed(() => {
    const declared = this.spec()?.handles ?? [
      { type: 'target' as const, position: 'left' as const },
      { type: 'source' as const, position: 'right' as const },
    ];
    return declared.map((h) => ({
      type: h.type,
      id: h.id,
      position: POSITION_MAP[h.position ?? (h.type === 'target' ? 'left' : 'right')],
    }));
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/nodes/template-node.component.spec.ts`
Expected: PASS. If handle rendering fails on missing DI, fix providers per the note in Step 1.

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npx vitest run && npm run typecheck`

```bash
git add src/lib/components/nodes/template-node.component.ts src/lib/components/nodes/template-node.component.spec.ts
git commit -m "feat(angular): generic TemplateNodeComponent for data-driven node templates"
```

---

### Task 4: Node-renderer resolution step for registry templates

**Files:**
- Modify: `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts` (`getNodeComponent`, ~line 307)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (comment only)
- Test: `packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts` (extend the existing file)

- [ ] **Step 1: Write the failing test**

Open the existing `node-renderer.component.spec.ts`, study its setup helper, and add a new `describe` block using the same harness conventions. The resolution logic itself can be tested directly on the component instance:

```ts
import { TemplateNodeComponent } from '../../components/nodes/template-node.component';
import { DefaultNodeComponent } from '../../components/nodes/default-node.component';

describe('node template resolution', () => {
  it('resolves a registered template type to TemplateNodeComponent', () => {
    // Use this file's existing setup helper to create the fixture + store,
    // then:
    store.nodeTemplates.set(new Map([['service', { title: 'svc' }]]));
    expect(component.getNodeComponent('service')).toBe(TemplateNodeComponent);
  });

  it('falls back to DefaultNodeComponent for unknown types', () => {
    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
  });

  it('host component types take precedence over registry templates', () => {
    // Set customNodeTypes input to { service: DefaultNodeComponent } via the
    // harness, register a 'service' template, and assert resolution returns
    // DefaultNodeComponent (the host component), not TemplateNodeComponent.
    store.nodeTemplates.set(new Map([['service', {}]]));
    fixture.componentRef.setInput('customNodeTypes', { service: DefaultNodeComponent });
    expect(component.getNodeComponent('service')).toBe(DefaultNodeComponent);
  });

  it('unregistering live falls back to DefaultNodeComponent', () => {
    store.nodeTemplates.set(new Map([['service', {}]]));
    expect(component.getNodeComponent('service')).toBe(TemplateNodeComponent);
    store.nodeTemplates.set(new Map());
    expect(component.getNodeComponent('service')).toBe(DefaultNodeComponent);
  });
});
```

Adapt variable names (`store`, `component`, `fixture`) to the existing harness in that spec file. If the existing harness mounts a full `<ng-flow>` host, prefer a minimal direct `TestBed.createComponent(NodeRendererComponent)` with `providers: [provideZonelessChangeDetection(), FlowStore]` for this block.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/container/node-renderer/node-renderer.component.spec.ts`
Expected: FAIL — `getNodeComponent('service')` returns `DefaultNodeComponent` instead of `TemplateNodeComponent`.

- [ ] **Step 3: Implement the resolution step**

In `node-renderer.component.ts`:

Add the import:

```ts
import { TemplateNodeComponent } from '../../components/nodes/template-node.component';
```

Add a sync-warning comment above `builtInNodeTypes` (~line 26):

```ts
// Keep the key set in sync with BUILT_IN_NODE_TYPE_NAMES in services/ng-flow.service.ts.
```

Replace `getNodeComponent` (~line 307):

```ts
  getNodeComponent(type?: string): Type<unknown> {
    const resolvedType = type || 'default';
    const hostOrBuiltIn = this.customNodeTypes()[resolvedType] ?? builtInNodeTypes[resolvedType];
    if (hostOrBuiltIn) return hostOrBuiltIn;
    // Agent-registered data-driven templates: reading the registry signal here
    // makes the template binding reactive — registering/unregistering a
    // template re-renders affected nodes with no host involvement.
    if (this.store.nodeTemplates().has(resolvedType)) return TemplateNodeComponent;
    return DefaultNodeComponent;
  }
```

In `edge-renderer.component.ts`, add the matching sync comment above `builtInEdgeTypes` (~line 40):

```ts
// Keep the key set in sync with BUILT_IN_EDGE_TYPE_NAMES in services/ng-flow.service.ts.
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/container/node-renderer/node-renderer.component.spec.ts`
Expected: PASS, including all pre-existing tests in the file.

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npx vitest run && npm run typecheck`

```bash
git add src/lib/container/node-renderer/node-renderer.component.ts src/lib/container/node-renderer/node-renderer.component.spec.ts src/lib/container/edge-renderer/edge-renderer.component.ts
git commit -m "feat(angular): resolve agent-registered template types in the node renderer"
```

---

### Task 5: Bridge discovery tools — `list_node_types` / `list_edge_types`

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (append entries)
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`installHandlers()`)
- Modify: `packages/angular/AGENT_BRIDGE.md` (catalog rows)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts` (extend)

- [ ] **Step 1: Write the failing test**

In `agent-bridge.spec.ts`, add (using the file's existing `setup`/`CapturingTransport` helpers and `bridge.callTool`):

```ts
describe('type discovery tools', () => {
  it('list_node_types reports builtins and registered templates', async () => {
    const flow = newFlow();
    bridge.register('main', flow);
    await bridge.callTool('register_node_template', { name: 'service', spec: {} });
    const result = (await bridge.callTool('list_node_types')) as {
      types: Array<{ name: string; source: string }>;
    };
    expect(result.types).toContainEqual({ name: 'default', source: 'builtin' });
    expect(result.types).toContainEqual({ name: 'group', source: 'builtin' });
    expect(result.types).toContainEqual({ name: 'service', source: 'template' });
  });

  it('list_edge_types reports builtin edge types', async () => {
    const flow = newFlow();
    bridge.register('main', flow);
    const result = (await bridge.callTool('list_edge_types')) as {
      types: Array<{ name: string; source: string }>;
    };
    expect(result.types).toContainEqual({ name: 'smoothstep', source: 'builtin' });
  });

  it('discovery tools are read-only (no history entry)', async () => {
    const flow = newFlow();
    bridge.register('main', flow);
    await bridge.callTool('list_node_types');
    const status = (await bridge.callTool('history_status')) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });
});
```

Note: the first test also calls `register_node_template`, implemented in Task 6. To keep this task self-contained, assert only the builtin rows now and move the `service` assertion to Task 6's tests — OR implement Tasks 5 and 6 against the same spec additions and run them together. Recommended: drop the `register_node_template` line and `service` assertion from this task; Task 6 re-adds them.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: FAIL — `Unknown method: list_node_types` (error code -32601 surfaces as a thrown error from `callTool`).

- [ ] **Step 3: Add schemas**

Append to the `AGENT_TOOL_SCHEMAS` array in `tool-schemas.ts`:

```ts
  {
    name: 'list_node_types',
    description:
      'List every node type name renderable on a flow, tagged with its source: ' +
      '"builtin" (shipped with the library), "host" (registered by the application — ' +
      'its expected data shape is app-specific), or "template" (a data-driven template ' +
      'created via register_node_template — introspect its spec with list_node_templates).',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_edge_types',
    description:
      'List every edge type name renderable on a flow, tagged "builtin" or "host".',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
```

- [ ] **Step 4: Add handlers**

In `installHandlers()` in `agent-bridge.service.ts`, after the `clear_history` handler:

```ts
    this.handlers.set('list_node_types', (flow) => ({ types: flow.getNodeTypeNames() }));
    this.handlers.set('list_edge_types', (flow) => ({ types: flow.getEdgeTypeNames() }));
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: PASS.

- [ ] **Step 6: Update AGENT_BRIDGE.md and commit**

In `AGENT_BRIDGE.md`, add a new subsection under "Tool catalog", after "Discovery / read":

```markdown
### Discovery — types & templates

| Tool | Params | Returns |
|---|---|---|
| `list_node_types` | — | `{ types: Array<{ name, source: 'builtin' \| 'host' \| 'template' }> }` |
| `list_edge_types` | — | `{ types: Array<{ name, source: 'builtin' \| 'host' }> }` |
```

```bash
git add src/lib/agent/tool-schemas.ts src/lib/agent/agent-bridge.service.ts src/lib/agent/agent-bridge.spec.ts AGENT_BRIDGE.md
git commit -m "feat(angular): list_node_types and list_edge_types bridge tools"
```

---

### Task 6: Bridge template tools — `register_node_template` / `unregister_node_template` / `list_node_templates`

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (validation fn + handlers)
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `agent-bridge.spec.ts`:

```ts
describe('node template tools', () => {
  let flow: NgFlowService;

  beforeEach(() => {
    flow = newFlow();
    bridge.register('main', flow);
  });

  it('register_node_template stores a spec and returns { name }', async () => {
    const result = await bridge.callTool('register_node_template', {
      name: 'service',
      spec: { title: '{{data.name}}', accent: '#4f46e5' },
    });
    expect(result).toEqual({ name: 'service' });
    expect(flow.getNodeTemplates()).toHaveLength(1);
  });

  it('appears in list_node_types as source "template"', async () => {
    await bridge.callTool('register_node_template', { name: 'service', spec: {} });
    const result = (await bridge.callTool('list_node_types')) as {
      types: Array<{ name: string; source: string }>;
    };
    expect(result.types).toContainEqual({ name: 'service', source: 'template' });
  });

  it('re-registering overwrites', async () => {
    await bridge.callTool('register_node_template', { name: 's', spec: { title: 'v1' } });
    await bridge.callTool('register_node_template', { name: 's', spec: { title: 'v2' } });
    expect(flow.getNodeTemplates()).toEqual([{ name: 's', spec: { title: 'v2' } }]);
  });

  it('rejects names claimed by builtin types with -32602', async () => {
    await expect(
      bridge.callTool('register_node_template', { name: 'default', spec: {} }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('rejects names claimed by host types with -32602', async () => {
    // Needs the FlowStore behind the flow, so build this one inline instead
    // of via newFlow() (which returns only the service). Same pattern as the
    // spec file's existing helper:
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    const hostFlow = child.get(NgFlowService);
    const store = child.get(FlowStore);
    bridge.register('host-flow', hostFlow);
    store.hostNodeTypeNames.set(['decision']);
    await expect(
      bridge.callTool('register_node_template', { flowId: 'host-flow', name: 'decision', spec: {} }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('rejects an empty name with -32602', async () => {
    await expect(
      bridge.callTool('register_node_template', { name: '', spec: {} }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it.each([
    [{ variant: 'fancy' }, 'variant'],
    [{ badges: [{ text: 1 }] }, 'badges'],
    [{ badges: [{ text: 'x', color: 'red' }] }, 'color'],
    [{ fields: [{ label: 'x' }] }, 'value'],
    [{ handles: [{ type: 'middle' }] }, 'type'],
    [{ handles: [{ type: 'source', position: 'center' }] }, 'position'],
    [{ title: 42 }, 'title'],
  ] as const)('rejects malformed spec %j with -32602', async (badSpec) => {
    await expect(
      bridge.callTool('register_node_template', { name: 'ok-name', spec: badSpec }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('unregister_node_template removes and reports { removed }', async () => {
    await bridge.callTool('register_node_template', { name: 's', spec: {} });
    expect(await bridge.callTool('unregister_node_template', { name: 's' })).toEqual({ removed: true });
    expect(await bridge.callTool('unregister_node_template', { name: 's' })).toEqual({ removed: false });
  });

  it('list_node_templates returns full specs', async () => {
    const spec = { title: 't', fields: [{ label: 'l', value: 'v' }] };
    await bridge.callTool('register_node_template', { name: 's', spec });
    expect(await bridge.callTool('list_node_templates')).toEqual({
      templates: [{ name: 's', spec }],
    });
  });

  it('template registration creates no history entry', async () => {
    await bridge.callTool('register_node_template', { name: 's', spec: {} });
    const status = (await bridge.callTool('history_status')) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });
});
```

For the host-shadowing test, expand the spec file's `setup`/`newFlow` helper to also return the child injector (or the `FlowStore`) so the test can write `store.hostNodeTypeNames.set(['decision'])` directly, then un-comment the assertions.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: FAIL — `Unknown method: register_node_template`.

- [ ] **Step 3: Add the spec validator to `agent-bridge.service.ts`**

Add near the other `validate*` helpers at the bottom of the file (also add `import type { NodeTemplateSpec } from '../types/node-template';` at the top):

```ts
const BADGE_COLOR_SET = new Set(['slate', 'indigo', 'emerald', 'amber', 'rose']);
const HANDLE_POSITION_SET = new Set(['top', 'right', 'bottom', 'left']);

/** Validate a NodeTemplateSpec payload. Throws InvalidParamsError naming the offending field. */
function validateTemplateSpec(value: unknown, ctx: string): NodeTemplateSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidParamsError(`${ctx}: spec must be an object.`);
  }
  const s = value as Record<string, unknown>;
  for (const key of ['title', 'icon', 'accent', 'body']) {
    if (s[key] !== undefined && typeof s[key] !== 'string') {
      throw new InvalidParamsError(`${ctx}: spec.${key} must be a string.`);
    }
  }
  if (s['variant'] !== undefined && s['variant'] !== 'compact' && s['variant'] !== 'detailed') {
    throw new InvalidParamsError(`${ctx}: spec.variant must be "compact" or "detailed".`);
  }
  if (s['badges'] !== undefined) {
    if (!Array.isArray(s['badges'])) throw new InvalidParamsError(`${ctx}: spec.badges must be an array.`);
    (s['badges'] as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidParamsError(`${ctx}: spec.badges[${i}] must be an object.`);
      }
      const b = raw as Record<string, unknown>;
      if (typeof b['text'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.badges[${i}].text must be a string.`);
      }
      if (b['color'] !== undefined && !BADGE_COLOR_SET.has(b['color'] as string)) {
        throw new InvalidParamsError(
          `${ctx}: spec.badges[${i}].color must be one of: ${Array.from(BADGE_COLOR_SET).join(', ')}.`,
        );
      }
      if (b['showIf'] !== undefined && typeof b['showIf'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.badges[${i}].showIf must be a string.`);
      }
    });
  }
  if (s['fields'] !== undefined) {
    if (!Array.isArray(s['fields'])) throw new InvalidParamsError(`${ctx}: spec.fields must be an array.`);
    (s['fields'] as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}] must be an object.`);
      }
      const f = raw as Record<string, unknown>;
      if (typeof f['label'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}].label must be a string.`);
      }
      if (typeof f['value'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}].value must be a string.`);
      }
      if (f['showIf'] !== undefined && typeof f['showIf'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.fields[${i}].showIf must be a string.`);
      }
    });
  }
  if (s['handles'] !== undefined) {
    if (!Array.isArray(s['handles'])) throw new InvalidParamsError(`${ctx}: spec.handles must be an array.`);
    (s['handles'] as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidParamsError(`${ctx}: spec.handles[${i}] must be an object.`);
      }
      const h = raw as Record<string, unknown>;
      if (h['type'] !== 'source' && h['type'] !== 'target') {
        throw new InvalidParamsError(`${ctx}: spec.handles[${i}].type must be "source" or "target".`);
      }
      if (h['position'] !== undefined && !HANDLE_POSITION_SET.has(h['position'] as string)) {
        throw new InvalidParamsError(
          `${ctx}: spec.handles[${i}].position must be one of: top, right, bottom, left.`,
        );
      }
      if (h['id'] !== undefined && typeof h['id'] !== 'string') {
        throw new InvalidParamsError(`${ctx}: spec.handles[${i}].id must be a string.`);
      }
    });
  }
  return value as NodeTemplateSpec;
}
```

- [ ] **Step 4: Add the handlers**

In `installHandlers()` after the discovery handlers from Task 5:

```ts
    this.handlers.set('register_node_template', (flow, params) => {
      const name = requireString(params, 'name');
      if (name.length === 0) {
        throw new InvalidParamsError('Param "name" must be a non-empty string.');
      }
      const spec = validateTemplateSpec(requireObject(params, 'spec'), 'register_node_template');
      const claimed = flow
        .getNodeTypeNames()
        .find((t) => t.name === name && t.source !== 'template');
      if (claimed) {
        throw new InvalidParamsError(
          `register_node_template: "${name}" is already registered by the ` +
            `${claimed.source === 'builtin' ? 'library' : 'host application'} and cannot be overridden.`,
        );
      }
      flow.registerNodeTemplate(name, spec);
      return { name };
    });

    this.handlers.set('unregister_node_template', (flow, params) => {
      const name = requireString(params, 'name');
      return { removed: flow.unregisterNodeTemplate(name) };
    });

    this.handlers.set('list_node_templates', (flow) => ({
      templates: flow.getNodeTemplates(),
    }));
```

Do **not** add any of these to `MUTATING_TOOLS` — templates are rendering config, not graph state (spec: History semantics).

- [ ] **Step 5: Add schemas**

Append to `AGENT_TOOL_SCHEMAS`:

```ts
  {
    name: 'register_node_template',
    description:
      'Register (or overwrite) a data-driven node template under `name`. Nodes with ' +
      '`type === name` render as a card built from the spec. Strings support {{data.x}} ' +
      'interpolation against each node\'s `data` (dotted paths only — no expressions). ' +
      'Fails with -32602 if `name` is already a builtin or host-registered component type. ' +
      'Not undoable via the undo tool (templates are rendering config, not graph state).',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        name: { type: 'string', description: 'Type name nodes will reference via node.type.' },
        spec: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Card title; supports {{data.x}}.' },
            icon: {
              type: 'string',
              description:
                'Built-in icon name: database, server, queue, cloud, user, document, bolt, settings.',
            },
            accent: { type: 'string', description: 'CSS color for header/border accent.' },
            variant: { type: 'string', enum: ['compact', 'detailed'] },
            badges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  color: { type: 'string', enum: ['slate', 'indigo', 'emerald', 'amber', 'rose'] },
                  showIf: { type: 'string', description: 'Dotted data path, e.g. "data.env".' },
                },
                required: ['text'],
              },
            },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string', description: 'Supports {{data.x}}.' },
                  showIf: { type: 'string' },
                },
                required: ['label', 'value'],
              },
            },
            body: { type: 'string', description: 'Free body text; supports {{data.x}}.' },
            handles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['source', 'target'] },
                  position: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
                  id: { type: 'string' },
                },
                required: ['type'],
              },
            },
          },
        },
      },
      required: ['name', 'spec'],
      additionalProperties: false,
    },
  },
  {
    name: 'unregister_node_template',
    description:
      'Remove a data-driven node template. Existing nodes of that type fall back to the default node renderer.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' }, name: { type: 'string' } },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_node_templates',
    description: 'List every registered data-driven node template with its full spec.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: PASS.

- [ ] **Step 7: Update AGENT_BRIDGE.md and commit**

Extend the "Discovery — types & templates" section added in Task 5:

```markdown
| `register_node_template` | `name: string`, `spec: NodeTemplateSpec` | Overwrites an existing template of the same name; rejects builtin/host names with `-32602`. Returns `{ name }` |
| `unregister_node_template` | `name: string` | `{ removed: boolean }`; nodes of that type fall back to the default renderer |
| `list_node_templates` | — | `{ templates: Array<{ name, spec }> }` |
```

And add a prose section after "Transactional batch" titled "Node templates" covering: the spec shape (copy the `NodeTemplateSpec` interface), interpolation semantics (dotted paths against `node.data`, own-properties only, no expressions, text-bindings only), the badge palette allowlist, the precedence rule (content templates → host components → builtins → agent templates → default), and the history note (registration is never captured by undo/redo: `register_node_template` → `add_node` → `undo` keeps the template, removes the node).

```bash
git add src/lib/agent/tool-schemas.ts src/lib/agent/agent-bridge.service.ts src/lib/agent/agent-bridge.spec.ts AGENT_BRIDGE.md
git commit -m "feat(angular): register/unregister/list node template bridge tools"
```

---

### Task 7: `layout_nodes` tool + pluggable layout configuration

**Files:**
- Modify: `packages/angular/src/lib/agent/provide-agent-bridge.ts` (config key + provider)
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (token, injection, error class, dispatch history special-case, handler)
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `agent-bridge.spec.ts`. This needs a layout-configured bridge, so add a second setup variant (mirroring the existing `setup()` helper):

```ts
import type { AgentLayoutFn } from '../types/node-template';

function setupWithLayout(layout: AgentLayoutFn, transports: AgentTransport[] = []) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideAgentBridge({ transports, layout }),
    ],
  });
  const bridge = TestBed.inject(AngflowAgentBridge);
  const newFlow = (): NgFlowService => {
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    return child.get(NgFlowService);
  };
  return { bridge, newFlow };
}

describe('layout_nodes', () => {
  /** Stacks every node at x = 100·index, y = 0 — deterministic and assertable. */
  const fakeLayout: AgentLayoutFn = (nodes) => {
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => (positions[n.id] = { x: i * 100, y: 0 }));
    return positions;
  };

  it('fails with -32601 and an actionable message when no layout fn is configured', async () => {
    const { bridge, newFlow } = setup([]); // existing helper — no layout
    bridge.register('main', newFlow());
    await expect(bridge.callTool('layout_nodes', {})).rejects.toMatchObject({
      code: -32601,
      message: expect.stringContaining('no layout function configured'),
    });
  });

  it('applies returned positions and returns them', async () => {
    const { bridge, newFlow } = setupWithLayout(fakeLayout);
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a'), makeNode('b')]);
    const result = (await bridge.callTool('layout_nodes', { fitView: false })) as {
      positions: Record<string, { x: number; y: number }>;
    };
    expect(result.positions).toEqual({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
    expect(flow.getNode('a')?.position).toEqual({ x: 0, y: 0 });
    expect(flow.getNode('b')?.position).toEqual({ x: 100, y: 0 });
  });

  it('lays out only the induced subgraph when nodeIds is given', async () => {
    const seen: Array<{ nodes: string[]; edges: Array<{ source: string; target: string }> }> = [];
    const spy: AgentLayoutFn = (nodes, edges) => {
      seen.push({ nodes: nodes.map((n) => n.id), edges });
      return Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    };
    const { bridge, newFlow } = setupWithLayout(spy);
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c', { position: { x: 9, y: 9 } })]);
    flow.setEdges([
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' }, // c outside subset → edge excluded
    ]);
    await bridge.callTool('layout_nodes', { nodeIds: ['a', 'b'], fitView: false });
    expect(seen[0].nodes).toEqual(['a', 'b']);
    expect(seen[0].edges).toEqual([{ source: 'a', target: 'b' }]);
    expect(flow.getNode('c')?.position).toEqual({ x: 9, y: 9 }); // untouched
  });

  it('rejects unknown nodeIds with -32602', async () => {
    const { bridge, newFlow } = setupWithLayout(fakeLayout);
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a')]);
    await expect(
      bridge.callTool('layout_nodes', { nodeIds: ['a', 'ghost'] }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('rejects a bad direction with -32602', async () => {
    const { bridge, newFlow } = setupWithLayout(fakeLayout);
    bridge.register('main', newFlow());
    await expect(
      bridge.callTool('layout_nodes', { direction: 'DIAGONAL' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('drops unknown ids from the layout result with a console.warn', async () => {
    const sloppy: AgentLayoutFn = () => ({ a: { x: 1, y: 1 }, ghost: { x: 9, y: 9 } });
    const { bridge, newFlow } = setupWithLayout(sloppy);
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a')]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = (await bridge.callTool('layout_nodes', { fitView: false })) as {
      positions: Record<string, unknown>;
    };
    expect(result.positions).toEqual({ a: { x: 1, y: 1 } });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('a throwing layout fn yields -32603 and changes nothing', async () => {
    const boom: AgentLayoutFn = () => {
      throw new Error('layout exploded');
    };
    const { bridge, newFlow } = setupWithLayout(boom);
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a', { position: { x: 5, y: 5 } })]);
    await expect(bridge.callTool('layout_nodes', {})).rejects.toMatchObject({ code: -32603 });
    expect(flow.getNode('a')?.position).toEqual({ x: 5, y: 5 });
    const status = (await bridge.callTool('history_status')) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });

  it('a successful layout creates exactly one history entry, undo restores positions', async () => {
    const { bridge, newFlow } = setupWithLayout(fakeLayout);
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a', { position: { x: 5, y: 5 } }), makeNode('b', { position: { x: 6, y: 6 } })]);
    await bridge.callTool('layout_nodes', { fitView: false });
    const status = (await bridge.callTool('history_status')) as { pastDepth: number };
    expect(status.pastDepth).toBe(1);
    await bridge.callTool('undo');
    expect(flow.getNode('a')?.position).toEqual({ x: 5, y: 5 });
    expect(flow.getNode('b')?.position).toEqual({ x: 6, y: 6 });
  });

  it('an empty graph creates no history entry', async () => {
    const { bridge, newFlow } = setupWithLayout(fakeLayout);
    const flow = newFlow();
    bridge.register('main', flow);
    await bridge.callTool('layout_nodes', { fitView: false });
    const status = (await bridge.callTool('history_status')) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });
});
```

Note: `fitView: false` is used in most tests because `fitView` requires panZoom/DOM infrastructure absent in jsdom; the default-true behavior is verified in the example app (Task 10). If `flow.fitView({})` throws in jsdom even when guarded, the handler's `shouldFit && Object.keys(applied).length > 0` guard plus the absent panZoom no-op in `FlowStore.fitView` should make it safe — verify with one targeted test if cheap, otherwise rely on the example.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: FAIL — `provideAgentBridge` rejects the unknown `layout` key (TS error) / `Unknown method: layout_nodes`.

- [ ] **Step 3: Add the token and config**

In `agent-bridge.service.ts`, next to the other tokens:

```ts
import type { AgentLayoutFn } from '../types/node-template';

/** Optional host-provided layout function backing the `layout_nodes` tool. */
export const AGENT_LAYOUT = new InjectionToken<AgentLayoutFn>('AngflowAgentLayout');
```

In the constructor, add the parameter and field:

```ts
  private readonly layoutFn: AgentLayoutFn | null;

  constructor(
    @Optional() @Inject(AGENT_TRANSPORTS) transports: AgentTransport[] | null,
    @Optional() @Inject(AGENT_HISTORY_OPTIONS) historyOptions: AgentHistoryOptions | false | null,
    @Optional() @Inject(AGENT_ON_ERROR) onError: ((err: unknown, ctx: { kind: 'transport-start' | 'transport-send' | 'dispatch'; transport?: AgentTransport; method?: string }) => void) | null,
    @Optional() @Inject(AGENT_LAYOUT) layoutFn: AgentLayoutFn | null,
  ) {
    // keep the four existing assignments (transports, history, onError,
    // installHandlers/start calls) exactly as they are, and add:
    this.layoutFn = layoutFn ?? null;
```

In `provide-agent-bridge.ts`:

```ts
import { AGENT_HISTORY_OPTIONS, AGENT_LAYOUT, AGENT_ON_ERROR, AGENT_TRANSPORTS } from './agent-bridge.service';
import type { AgentLayoutFn } from '../types/node-template';

export interface AgentBridgeConfig {
  transports: AgentTransport[];
  history?: AgentHistoryOptions | false;
  /**
   * Optional layout function backing the `layout_nodes` tool. Import the
   * turnkey dagre adapter from `@angflow/angular/layout`, or supply your own.
   * When omitted, `layout_nodes` fails with a "no layout function configured"
   * error.
   */
  layout?: AgentLayoutFn;
  onError?: (err: unknown, ctx: AgentBridgeErrorContext) => void;
}
```

and in the providers array:

```ts
    ...(config.layout ? [{ provide: AGENT_LAYOUT, useValue: config.layout }] : []),
```

- [ ] **Step 4: Add the error class and dispatch handling**

In `agent-bridge.service.ts` next to the other error classes:

```ts
/** Tool exists in the catalog but the deployment lacks a required capability. Maps to -32601. */
class MethodUnavailableError extends Error {}
```

In `dispatch()`'s catch chain, before the `InvalidParamsError` branch:

```ts
      if (err instanceof MethodUnavailableError) {
        return { id: req.id, error: { code: ERROR_METHOD_NOT_FOUND, message: err.message } };
      }
```

History special-case in `dispatch()` — extend the snapshot condition and commit logic:

```ts
      const isApplyChanges = req.method === 'apply_changes';
      const isLayout = req.method === 'layout_nodes';

      // ...
      if (this.history && (MUTATING_TOOLS.has(req.method) || isApplyChanges || isLayout)) {
        snapshot = { /* unchanged */ };
      }

      const result = await handler(flow, params);

      if (snapshot && flowId && this.history) {
        if (isApplyChanges) {
          // unchanged
        } else if (isLayout) {
          // Capture only when at least one position was applied — an empty
          // layout pass must not pollute the undo stack (spec: History semantics).
          const positions =
            (result as { positions?: Record<string, unknown> } | null)?.positions ?? {};
          if (Object.keys(positions).length > 0) {
            this.history.capture(flowId, snapshot);
            this.emitHistory(flowId);
          }
        } else {
          // unchanged
        }
      }
```

(`layout_nodes` is deliberately NOT added to `MUTATING_TOOLS` — its capture is conditional, handled above.)

- [ ] **Step 5: Add the handler**

In `installHandlers()`:

```ts
    this.handlers.set('layout_nodes', async (flow, params) => {
      if (!this.layoutFn) {
        throw new MethodUnavailableError(
          'layout_nodes unavailable: no layout function configured. ' +
            'Pass `layout` to provideAgentBridge (e.g. dagreLayout from @angflow/angular/layout).',
        );
      }
      const direction = params['direction'] ?? 'TB';
      if (
        typeof direction !== 'string' ||
        !['TB', 'LR', 'BT', 'RL'].includes(direction)
      ) {
        throw new InvalidParamsError('Param "direction" must be one of: TB, LR, BT, RL.');
      }
      const nodeSep = typeof params['nodeSep'] === 'number' ? (params['nodeSep'] as number) : undefined;
      const rankSep = typeof params['rankSep'] === 'number' ? (params['rankSep'] as number) : undefined;
      const nodeIds = optionalStringArray(params, 'nodeIds');
      if (nodeIds) {
        for (const id of nodeIds) {
          if (!flow.getNode(id)) {
            throw new InvalidParamsError(`Param "nodeIds" contains unknown node id "${id}".`);
          }
        }
      }
      const targetNodes = nodeIds
        ? nodeIds.map((id) => flow.getNode(id)!)
        : flow.getNodes();
      const idSet = new Set(targetNodes.map((n) => n.id));

      const layoutNodes = targetNodes.map((n) => {
        const internal = flow.getInternalNode(n.id);
        return {
          id: n.id,
          width: internal?.measured?.width ?? n.width ?? 150,
          height: internal?.measured?.height ?? n.height ?? 40,
          position: { x: n.position.x, y: n.position.y },
        };
      });
      // Induced subgraph: only edges with BOTH endpoints in the target set.
      const layoutEdges = flow
        .getEdges()
        .filter((e) => idSet.has(e.source) && idSet.has(e.target))
        .map((e) => ({ source: e.source, target: e.target }));

      const raw = await this.layoutFn(layoutNodes, layoutEdges, {
        direction: direction as 'TB' | 'LR' | 'BT' | 'RL',
        nodeSep,
        rankSep,
      });
      if (!raw || typeof raw !== 'object') {
        throw new Error('layout function returned a non-object result');
      }

      // Validate the full result BEFORE applying anything so a bad position
      // rolls back cleanly (nothing applied, no history entry).
      const applied: Record<string, { x: number; y: number }> = {};
      const unknownIds: string[] = [];
      for (const [id, pos] of Object.entries(raw as Record<string, { x: number; y: number }>)) {
        if (!idSet.has(id)) {
          unknownIds.push(id);
          continue;
        }
        if (
          !pos ||
          typeof pos.x !== 'number' ||
          typeof pos.y !== 'number' ||
          !Number.isFinite(pos.x) ||
          !Number.isFinite(pos.y)
        ) {
          throw new Error(`layout function returned an invalid position for node "${id}"`);
        }
        applied[id] = { x: pos.x, y: pos.y };
      }
      if (unknownIds.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[angflow] layout_nodes: layout function returned positions for unknown node ids ` +
            `(ignored): ${unknownIds.join(', ')}`,
        );
      }

      flow.batch(() => {
        for (const [id, position] of Object.entries(applied)) {
          flow.updateNode(id, { position });
        }
      });

      const shouldFit = params['fitView'] !== false;
      if (shouldFit && Object.keys(applied).length > 0) {
        await flow.fitView({});
      }
      return { positions: applied };
    });
```

- [ ] **Step 6: Add the schema**

Append to `AGENT_TOOL_SCHEMAS`:

```ts
  {
    name: 'layout_nodes',
    description:
      'Auto-layout nodes using the host-configured layout engine (typically dagre). ' +
      'Computes tidy positions for the whole graph (or the nodeIds subset and the edges ' +
      'among them), applies them in one undoable step, and fits the viewport unless ' +
      'fitView is false. Returns the applied positions. Prefer this over computing ' +
      'coordinates manually whenever you add more than a couple of nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        direction: {
          type: 'string',
          enum: ['TB', 'LR', 'BT', 'RL'],
          description: 'Rank direction: top-bottom (default), left-right, bottom-top, right-left.',
        },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Subset to lay out; omit to lay out all nodes.',
        },
        nodeSep: { type: 'number', description: 'Separation between nodes in the same rank (px).' },
        rankSep: { type: 'number', description: 'Separation between ranks (px).' },
        fitView: { type: 'boolean', description: 'Fit the viewport afterwards. Default true.' },
      },
      additionalProperties: false,
    },
  },
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: PASS.

- [ ] **Step 8: Update AGENT_BRIDGE.md and commit**

Add a "Layout" tool-catalog section (the `layout_nodes` row from the spec's "New tools" table), a configuration snippet under "Wiring":

```ts
import { dagreLayout } from '@angflow/angular/layout';
provideAgentBridge({ transports: [new WindowTransport()], layout: dagreLayout });
```

and add `layout_nodes` to the History "capture" list with the note: *captures one entry per successful call that applied ≥1 position; a failed or empty layout captures nothing*. Document the `-32601` "no layout function configured" error in the error-code section.

```bash
git add src/lib/agent/provide-agent-bridge.ts src/lib/agent/agent-bridge.service.ts src/lib/agent/tool-schemas.ts src/lib/agent/agent-bridge.spec.ts AGENT_BRIDGE.md
git commit -m "feat(angular): layout_nodes bridge tool with pluggable AgentLayoutFn"
```

---

### Task 8: `dagreLayout` adapter + `@angflow/angular/layout` subpath export

**Files:**
- Create: `packages/angular/src/lib/layout/dagre-layout.ts`
- Create: `packages/angular/src/lib/layout/index.ts`
- Modify: `packages/angular/package.json`
- Test: `packages/angular/src/lib/layout/dagre-layout.spec.ts`

- [ ] **Step 1: Install dagre as a dev dependency (workspace uses pnpm)**

Run from the repo root:

```bash
pnpm -F @angflow/angular add -D @dagrejs/dagre
```

Then hand-edit `packages/angular/package.json` to declare the optional peer relationship and the subpath export:

```jsonc
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/esm/index.d.ts",
      "default": "./dist/esm/index.js"
    },
    "./layout": {
      "types": "./dist/esm/lib/layout/index.d.ts",
      "default": "./dist/esm/lib/layout/index.js"
    },
    "./dist/style.css": "./dist/style.css",
    "./dist/base.css": "./dist/base.css"
  },
```

```jsonc
  "peerDependencies": {
    "@angular/common": ">=19.0.0",
    "@angular/core": ">=19.0.0",
    "@dagrejs/dagre": ">=1.0.0",
    "rxjs": ">=7.0.0"
  },
  "peerDependenciesMeta": {
    "@dagrejs/dagre": {
      "optional": true
    }
  },
```

- [ ] **Step 2: Write the failing test**

Create `packages/angular/src/lib/layout/dagre-layout.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dagreLayout } from './dagre-layout';

const N = (id: string) => ({ id, width: 100, height: 40, position: { x: 0, y: 0 } });

describe('dagreLayout', () => {
  it('returns a top-left position for every input node', async () => {
    const positions = await dagreLayout(
      [N('a'), N('b'), N('c')],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
      { direction: 'TB' },
    );
    expect(Object.keys(positions).sort()).toEqual(['a', 'b', 'c']);
    for (const pos of Object.values(positions)) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('TB puts the source above its targets', async () => {
    const positions = await dagreLayout([N('a'), N('b')], [{ source: 'a', target: 'b' }], {
      direction: 'TB',
    });
    expect(positions['a'].y).toBeLessThan(positions['b'].y);
  });

  it('LR puts the source left of its targets', async () => {
    const positions = await dagreLayout([N('a'), N('b')], [{ source: 'a', target: 'b' }], {
      direction: 'LR',
    });
    expect(positions['a'].x).toBeLessThan(positions['b'].x);
  });

  it('siblings in the same rank do not overlap', async () => {
    const positions = await dagreLayout(
      [N('a'), N('b'), N('c')],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
      { direction: 'TB', nodeSep: 50 },
    );
    expect(Math.abs(positions['b'].x - positions['c'].x)).toBeGreaterThanOrEqual(100);
  });

  it('handles a graph with no edges', async () => {
    const positions = await dagreLayout([N('a'), N('b')], [], { direction: 'TB' });
    expect(Object.keys(positions).sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/layout/dagre-layout.spec.ts`
Expected: FAIL — cannot resolve `./dagre-layout`.

- [ ] **Step 4: Implement the adapter**

Create `packages/angular/src/lib/layout/dagre-layout.ts`:

```ts
import * as dagre from '@dagrejs/dagre';
import type { AgentLayoutFn } from '../types/node-template';

/**
 * Turnkey dagre adapter for the agent bridge's `layout_nodes` tool.
 *
 * Lives in the `@angflow/angular/layout` subpath so `@dagrejs/dagre` (an
 * optional peer dependency) is only pulled into bundles that import it.
 *
 * @example
 * ```ts
 * import { dagreLayout } from '@angflow/angular/layout';
 * provideAgentBridge({ transports: [...], layout: dagreLayout });
 * ```
 */
export const dagreLayout: AgentLayoutFn = (nodes, edges, opts) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSep ?? 50,
    ranksep: opts.rankSep ?? 80,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, { width: n.width, height: n.height });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const placed = g.node(n.id);
    // dagre positions nodes by center; angflow positions by top-left corner.
    positions[n.id] = { x: placed.x - n.width / 2, y: placed.y - n.height / 2 };
  }
  return positions;
};
```

Create `packages/angular/src/lib/layout/index.ts`:

```ts
export { dagreLayout } from './dagre-layout';
export type { AgentLayoutFn, AgentLayoutOptions } from '../types/node-template';
```

Do **not** export anything from `src/lib/layout/` in `public-api.ts` — keeping it out of the main entry point is the whole point of the subpath.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/layout/dagre-layout.spec.ts`
Expected: PASS.

- [ ] **Step 6: Verify the build emits the subpath**

Run: `npm run build`
Expected: `dist/esm/lib/layout/index.js` and `dist/esm/lib/layout/index.d.ts` exist. Verify:

```bash
ls dist/esm/lib/layout/
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/layout/ package.json ../../pnpm-lock.yaml
git commit -m "feat(angular): dagreLayout adapter behind @angflow/angular/layout subpath export"
```

---

### Task 9: Public API exports + full AGENT_BRIDGE.md pass

**Files:**
- Modify: `packages/angular/src/lib/public-api.ts`
- Modify: `packages/angular/src/lib/agent/index.ts`
- Modify: `packages/angular/AGENT_BRIDGE.md`

- [ ] **Step 1: Export the new public surface**

In `public-api.ts`, "Node components" section, add:

```ts
export { TemplateNodeComponent } from './components/nodes/template-node.component';
```

(The `NodeTemplateSpec`/`AgentLayoutFn` types already flow through `export * from './types'`.)

In `src/lib/agent/index.ts`, ensure `AGENT_LAYOUT` is NOT exported (internal token; config goes through `provideAgentBridge`). No change needed unless Task 7 added it — verify.

- [ ] **Step 2: Full AGENT_BRIDGE.md consistency pass**

Tasks 5–7 added the new sections incrementally. Now do a whole-document pass:

1. Architecture diagram/intro: mention the template registry and layout fn where the bridge's responsibilities are described.
2. Wiring section: show `layout: dagreLayout` in the `provideAgentBridge` example with the `@angflow/angular/layout` import.
3. "Known gaps" section: REMOVE "Auto-layout" and "Runtime node/edge type registration" (now shipped). Keep: copy/paste, pane/read-only toggles, undo/redo for user-driven changes. ADD: "Edge templates — `register_edge_template` is not implemented; `list_edge_types` ships for discovery only."
4. "Adding a new tool" checklist: add a step 5b: "If the tool's history capture is conditional (like `layout_nodes`), handle it in `dispatch()` instead of `MUTATING_TOOLS`."
5. Verify every new tool appears in the catalog: `list_node_types`, `list_edge_types`, `register_node_template`, `unregister_node_template`, `list_node_templates`, `layout_nodes` (6 total).
6. History section: confirm the capture/no-capture lists include `layout_nodes` (conditional) and the template tools (never).

- [ ] **Step 3: Build, full test run, commit**

Run: `npm run build && npx vitest run && npm run typecheck`
Expected: all green.

```bash
git add src/lib/public-api.ts src/lib/agent/index.ts AGENT_BRIDGE.md
git commit -m "docs(angular): export TemplateNodeComponent and complete AGENT_BRIDGE.md for tool-surface expansion"
```

---

### Task 10: Example app wiring + end-to-end verification

**Files:**
- Modify: `examples/angular/src/app/app.config.ts` (add `layout: dagreLayout`)
- Modify: `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts` (new console snippets)
- Possibly modify: `examples/angular/package.json` (ensure `@dagrejs/dagre` present — the layouting example may already have it; check first)

- [ ] **Step 1: Rebuild workspace packages**

```bash
pnpm -F @angflow/system build   # only if system changed (it should NOT have — verify zero diffs in packages/system)
pnpm -F @angflow/angular build
```

- [ ] **Step 2: Wire the layout fn in the example app config**

In `examples/angular/src/app/app.config.ts`, find the existing `provideAgentBridge({...})` call and add the layout key:

```ts
import { dagreLayout } from '@angflow/angular/layout';

provideAgentBridge({
  transports: [new WindowTransport()],
  layout: dagreLayout,
  // ...existing config unchanged
}),
```

Check `examples/angular/package.json` for `@dagrejs/dagre`; if absent:

```bash
pnpm -F <example package name from its package.json> add @dagrejs/dagre
```

- [ ] **Step 3: Add demo snippets to the agent-bridge example panel**

In `agent-bridge.component.ts`, add two `<pre class="agent-panel__code">` blocks after the existing `undo` snippet (mind the `{{ '{' }}` escaping convention used in that template):

Snippet 1 — register a template and add nodes of that type:

```
await angflow.callTool('register_node_template', {
  name: 'service',
  spec: {
    title: '{{data.name}}', icon: 'server', accent: '#4f46e5',
    badges: [{ text: '{{data.env}}', color: 'amber', showIf: 'data.env' }],
    fields: [{ label: 'Port', value: '{{data.port}}', showIf: 'data.port' }],
    handles: [{ type: 'target', position: 'left' }, { type: 'source', position: 'right' }],
  },
})
await angflow.callTool('add_nodes', { nodes: [
  { id: 's1', type: 'service', position: { x: 0, y: 0 }, data: { name: 'api', port: 8080, env: 'prod' } },
  { id: 's2', type: 'service', position: { x: 0, y: 0 }, data: { name: 'worker', port: 9090 } },
]})
```

Snippet 2 — layout:

```
await angflow.callTool('layout_nodes', { direction: 'LR' })
```

- [ ] **Step 4: Verify the example compiles and runs**

```bash
cd examples/angular
npm run build
```

Expected: build succeeds. If a dev server check is wanted: `npm run dev`, open the agent-bridge example, run the two snippets in the devtools console, confirm: styled `service` cards render with title/badge/field, `layout_nodes` tidies them left-to-right, `await angflow.callTool('undo')` restores pre-layout positions while the template stays registered.

- [ ] **Step 5: Final whole-plan verification**

From `packages/angular/`:

```bash
npx vitest run && npm run typecheck && npm run build
```

From repo root:

```bash
git status --porcelain   # only intentional changes
```

Confirm zero diffs under `packages/system/` (spec non-goal).

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/app.config.ts examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts examples/angular/package.json pnpm-lock.yaml
git commit -m "feat(examples): demo node templates and layout_nodes in the agent-bridge example"
```

---

## Spec coverage checklist (self-review against the design doc)

| Spec requirement | Task |
|---|---|
| `NodeTemplateSpec` + `AgentLayoutFn` types | 1 |
| Dotted-path interpolation, own-props only, no expressions | 1 |
| Signal-backed per-flow registry | 2 |
| `registeredNodeTypeNames` discovery signals + `<ng-flow>` input sync | 2 |
| `TemplateNodeComponent` (card + slots/variants, icons, palette allowlist, default handles) | 3 |
| Renderer resolution step 3 (reactive, host-precedence) | 4 |
| `list_node_types` / `list_edge_types` | 5 |
| `register_node_template` / `unregister_node_template` / `list_node_templates` + validation + shadowing rejection | 6 |
| `layout_nodes` + `AGENT_LAYOUT` config + `-32601` unavailable error + induced subgraph + unknown-id drop + rollback + conditional history | 7 |
| `dagreLayout` + subpath export + optional peer dep | 8 |
| Public exports + full `AGENT_BRIDGE.md` (incl. known-gaps update) | 9 |
| Example app wiring + e2e snippets + zero `packages/system` diffs | 10 |
| Security tests (script-in-title, CSS injection, proto-chain) | 1 (interpolation), 3 (component), 6 (palette validation) |
| Versioning: `@angflow/angular` minor bump | deferred to publish time (CLAUDE.md publish flow), not part of this plan |

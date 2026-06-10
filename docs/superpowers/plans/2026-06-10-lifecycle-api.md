# Lifecycle, Leaks & Public-API Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop agent-bridge transports on destroy, fix the HandleComponent registry leak, make NodeResizer inputs reactive, remove the fit-view race, implement the dead [viewport] input, make <ng-flow-provider> actually share state, and fix the smaller selectable/SSR/toolbar findings.

**Architecture:** Localized lifecycle fixes (DestroyRef cleanup, effect-driven re-configuration) plus two public-API repairs (controlled viewport effect with re-entrancy guard; DI factories that reuse a parent-provided FlowStore/NgFlowService).

**Tech Stack:** Angular 21 signals/DI (zoneless), DestroyRef, vitest + TestBed (provideZonelessChangeDetection).

**Part of:** `2026-06-10-review-remediation-master.md` (Plan D — execute AFTER Plans A and C; overlapping files: ng-flow.component.ts, ng-flow.service.ts, edge-renderer.component.ts, agent-bridge.service.ts).

---
I
I've read all cited files, the existing spec idioms (TestBed + `provideZonelessChangeDetection` + the `ɵSIGNAL` input helper, vitest/jsdom via `@analogjs/vite-plugin-angular`), and verified each finding against the current code. All findings reproduce as described. Two verification notes that shaped the plan:

- `adoptUserNodes` (packages/system/src/utils/store.ts:145) returns `nodesInitialized = nodes.length > 0` — so for an **empty graph** `fitViewQueued` is never consumed. Decision encoded below: leave the flag queued (default viewport stays; the first non-empty measured `setNodes` still fits, matching React Flow's deferred initial fitView), and pin that with a store-level test.
- At node-injector level, Angular only auto-runs `ngOnDestroy` for type/`useClass` providers — so the Task 10 factories wire `FlowStore.ngOnDestroy` through `DestroyRef` explicitly when they construct a fresh store.
- Minimap `xyMinimap` (minimap.component.ts:174) is **never assigned** — only declared and optionally destroyed at line 463. It is truly dead; remove it (plus the now-unused `XYMinimap` and `getInternalNodesBounds` imports).

All commands run from `C:\Users\shisu\CodeWeb\angflow\packages\angular` (PowerShell: chain with `;`, not `&&`).

---

### Task 1: Remove dead XYMinimap field from MiniMapComponent

**Files:**
- Modify: `packages/angular/src/lib/components/minimap/minimap.component.ts` (lines 14-20, 174, 463)
- Test: existing `packages/angular/src/lib/components/minimap/minimap.component.spec.ts` (no new test — dead-code removal; verified by suite + typecheck)

- [ ] **Step 1**: Confirm the field is never assigned: `Grep "this.xyMinimap =" packages/angular/src/lib/components/minimap/minimap.component.ts` returns no matches (only the declaration at 174 and `?.destroy()` at 463). Then edit:

  Line 14-20 — remove the two unused imports:
  ```ts
  import {
    getBoundsOfRects,
    type PanelPosition,
    type Rect,
  } from '@angflow/system';
  ```
  Line 174 — delete:
  ```ts
  private xyMinimap: ReturnType<typeof XYMinimap> | null = null;
  ```
  Line 463 (in `ngOnDestroy`) — delete:
  ```ts
  this.xyMinimap?.destroy();
  ```
  Leave the rest of `ngOnDestroy` (rAF cancel + document listener removal) untouched. The hand-rolled pan stays as-is — the XYMinimap rewiring is explicitly deferred.
- [ ] **Step 2**: Verify: `npm test -- src/lib/components/minimap/minimap.component.spec.ts` (all existing minimap tests pass), then `npm run typecheck` (no unused-symbol or missing-symbol errors).
- [ ] **Step 3**: Commit: `git add packages/angular/src/lib/components/minimap/minimap.component.ts; git commit -m "refactor(angular): remove dead XYMinimap field and unused imports from minimap"`

---

### Task 2: NodeToolbar transform recomputes on measure/resize

**Files:**
- Modify: `packages/angular/src/lib/components/node-toolbar/node-toolbar.component.ts` (line 77-79)
- Test: Create `packages/angular/src/lib/components/node-toolbar/node-toolbar.component.spec.ts`

- [ ] **Step 1**: Write the failing test:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { provideZonelessChangeDetection } from '@angular/core';
  import { NodeToolbarComponent } from './node-toolbar.component';
  import { FlowStore } from '../../services/flow-store.service';
  import { NODE_ID } from '../../services/tokens';

  describe('NodeToolbarComponent toolbarTransform', () => {
    let store: FlowStore;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [NodeToolbarComponent],
        providers: [
          provideZonelessChangeDetection(),
          FlowStore,
          { provide: NODE_ID, useValue: 'n1' },
        ],
      });
      store = TestBed.inject(FlowStore);
      store.setNodes([
        { id: 'n1', position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
      ]);
    });

    it('recomputes when the node is measured (version bump)', () => {
      const fixture = TestBed.createComponent(NodeToolbarComponent);
      const inst = fixture.componentInstance;

      // Default position=Top, align=center, offset=10 → x offset is width/2.
      expect(inst.toolbarTransform()).toBe('translate(50px, -10px) translate(-50%, -100%)');

      // Simulate ResizeObserver measurement: nodeLookup mutated in place,
      // version bumped (this is exactly what updateNodeInternals does).
      const internal = store.nodeLookup.get('n1')!;
      internal.measured = { width: 200, height: 80 };
      store.bumpVersion();

      expect(inst.toolbarTransform()).toBe('translate(100px, -10px) translate(-50%, -100%)');
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/components/node-toolbar/node-toolbar.component.spec.ts` — expect failure on the second assertion: `expected 'translate(50px, -10px) ...' to be 'translate(100px, -10px) ...'` (the computed has no `version()` dependency, so the in-place `nodeLookup` mutation never invalidates it).
- [ ] **Step 3**: Fix `toolbarTransform` (line 77-79) — add the version read, mirroring `shouldShow`:
  ```ts
  readonly toolbarTransform = computed(() => {
    this.store.version(); // react to measure/resize — nodeLookup is mutated in place
    const ids = this.resolvedNodeIds();
    if (ids.length === 0) return '';
  ```
  (rest of the body unchanged).
- [ ] **Step 4**: Run `npm test -- src/lib/components/node-toolbar/node-toolbar.component.spec.ts` — passes. Run `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/components/node-toolbar/node-toolbar.component.ts packages/angular/src/lib/components/node-toolbar/node-toolbar.component.spec.ts; git commit -m "fix(angular): node-toolbar transform recomputes when nodes are measured or resized"`

---

### Task 3: selectKeyPressed — SSR guard and per-instance listener cache

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (lines 838-863)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (append a describe block)

- [ ] **Step 1**: Append failing tests to `ng-flow.service.spec.ts` (uses the existing `service`/`store` fixture from `beforeEach`):
  ```ts
  describe('selectKeyPressed', () => {
    it('caches the signal per key set and registers document listeners once', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const first = service.selectKeyPressed('Shift');
      const second = service.selectKeyPressed('Shift');

      expect(second).toBe(first);
      const keydownRegistrations = addSpy.mock.calls.filter(([type]) => type === 'keydown');
      expect(keydownRegistrations).toHaveLength(1);
      addSpy.mockRestore();
    });

    it('tracks key state through the cached signal', () => {
      const pressed = service.selectKeyPressed('Shift');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      expect(pressed()).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
      expect(pressed()).toBe(false);
    });

    it('returns an inert signal when document is unavailable (SSR)', () => {
      vi.stubGlobal('document', undefined);
      try {
        const pressed = service.selectKeyPressed('Meta');
        expect(pressed()).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/services/ng-flow.service.spec.ts` — expect 2 failures: `expected [signal] to be [signal] // Object.is equality` (no cache) and `TypeError: Cannot read properties of undefined (reading 'addEventListener')` (no SSR guard).
- [ ] **Step 3**: Replace `selectKeyPressed` (lines 843-863) and add the cache field next to it:
  ```ts
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
    const cacheKey = keys.join('\u0000');
    const cached = this.keyPressedSignals.get(cacheKey);
    if (cached) return cached;

    if (typeof document === 'undefined') {
      const inert = signal(false).asReadonly();
      this.keyPressedSignals.set(cacheKey, inert);
      return inert;
    }

    const pressed = signal(false);
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

    const readonlySignal = pressed.asReadonly();
    this.keyPressedSignals.set(cacheKey, readonlySignal);
    return readonlySignal;
  }
  ```
  (`signal` and `type Signal` are already imported at line 1; no import changes needed.)
- [ ] **Step 4**: Run `npm test -- src/lib/services/ng-flow.service.spec.ts` — all pass. Run `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts; git commit -m "fix(angular): guard selectKeyPressed for SSR and cache listeners per key set"`

---

### Task 4: AngflowAgentBridge stops its transports on injector destroy

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (imports line 1-11, constructor line 119-132, internals near line 213)
- Modify: `packages/angular/AGENT_BRIDGE.md` (Architecture bullet, line 22)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts` (append)

- [ ] **Step 1**: Append a failing test inside the top-level `describe('AngflowAgentBridge', ...)` (the `CapturingTransport` fixture already implements `stop()`):
  ```ts
  describe('lifecycle', () => {
    it('stops every transport when the bridge injector is destroyed', () => {
      const stopSpy = vi.spyOn(transport, 'stop');
      // Test env is configured with teardown.destroyAfterEach — resetting the
      // testing module destroys the environment injector the bridge lives in.
      TestBed.resetTestingModule();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps stopping remaining transports when one stop() throws', () => {
      const throwing: AgentTransport = {
        start: () => {},
        send: () => {},
        stop: () => {
          throw new Error('boom');
        },
      };
      const tail = new CapturingTransport();
      setup([throwing, tail]);
      const stopSpy = vi.spyOn(tail, 'stop');
      TestBed.resetTestingModule();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/agent/agent-bridge.spec.ts` — expect: `expected "stop" to be called 1 times, but got 0 times` (nothing ever calls `stop()` — a `WebSocketTransport` would keep redialing forever after `ApplicationRef.destroy()`).
- [ ] **Step 3**: Implement. In `agent-bridge.service.ts` add `DestroyRef` to the `@angular/core` import (line 1-11):
  ```ts
  import {
    DestroyRef,
    Inject,
    Injectable,
    InjectionToken,
    Injector,
    Optional,
    effect,
    inject,
    runInInjectionContext,
    signal,
  } from '@angular/core';
  ```
  Add the field next to `private readonly injector = inject(Injector);` (line 106):
  ```ts
  private readonly destroyRef = inject(DestroyRef);
  ```
  At the end of the constructor (after `this.start();`, line 131):
  ```ts
  this.installHandlers();
  this.start();
  this.destroyRef.onDestroy(() => this.stop());
  ```
  Add `stop()` directly below `start()` (after line 228):
  ```ts
  /** Stop all transports. Invoked automatically when the owning injector is destroyed. */
  private stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const t of this.transports) {
      try {
        t.stop();
      } catch {
        // A transport that throws during teardown must not break the others.
      }
    }
  }
  ```
- [ ] **Step 4**: Update `AGENT_BRIDGE.md` line 22 — append to the **Transport** bullet: `The bridge calls \`stop()\` on every transport when its injector is destroyed (e.g. \`ApplicationRef.destroy()\`), so \`stop()\` must be idempotent and must cancel any reconnect timers.`
- [ ] **Step 5**: Run `npm test -- src/lib/agent/agent-bridge.spec.ts` — all pass (including the existing suite). Run `npm run typecheck`.
- [ ] **Step 6**: Commit: `git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/AGENT_BRIDGE.md; git commit -m "fix(angular): agent bridge stops transports when its injector is destroyed"`

---

### Task 5: HandleComponent unregisters stale registry key on id/type change

**Files:**
- Modify: `packages/angular/src/lib/components/handle/handle.component.ts` (lines 97-117)
- Test: `packages/angular/src/lib/components/handle/handle.component.spec.ts` (append)

- [ ] **Step 1**: Append failing tests to the existing describe (reuses `store` and `setSignalInput`):
  ```ts
  it('unregisters the previous key when handleId changes', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'payload');
    fixture.detectChanges();
    expect(store.getHandleData('node-A', 'h1', 'source')).toBe('payload');

    setSignalInput(inst, 'handleId', 'h2');
    fixture.detectChanges();

    expect(store.getHandleData('node-A', 'h2', 'source')).toBe('payload');
    expect(store.getHandleData('node-A', 'h1', 'source')).toBeUndefined();
  });

  it('unregisters the previous key when type changes', () => {
    const fixture = TestBed.createComponent(HandleComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'type', 'source' as HandleType);
    setSignalInput(inst, 'handleId', 'h1');
    setSignalInput(inst, 'data', 'payload');
    fixture.detectChanges();

    setSignalInput(inst, 'type', 'target' as HandleType);
    fixture.detectChanges();

    expect(store.getHandleData('node-A', 'h1', 'target')).toBe('payload');
    expect(store.getHandleData('node-A', 'h1', 'source')).toBeUndefined();
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/components/handle/handle.component.spec.ts` — expect: `expected 'payload' to be undefined` (the effect re-registers under the new key without removing the old one; entries accumulate in `FlowStore._handleData`).
- [ ] **Step 3**: Fix the constructor effect (lines 97-107) — track the previous key:
  ```ts
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
  ```
  `ngOnDestroy` stays as-is (it reads the current — i.e. final — `handleId()`/`type()`, which now always matches `prevKey`).
- [ ] **Step 4**: Run `npm test -- src/lib/components/handle/handle.component.spec.ts` — all 8 tests pass. Run `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/components/handle/handle.component.ts packages/angular/src/lib/components/handle/handle.component.spec.ts; git commit -m "fix(angular): handle unregisters stale registry entry when id or type changes"`

---

### Task 6: Respect per-edge/per-node `selectable` in edge selection and Ctrl+A

**Files:**
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (lines 465-471, 491-505)
- Modify: `packages/angular/src/lib/directives/key-handler.directive.ts` (lines 154-168)
- Test: Create `packages/angular/src/lib/container/edge-renderer/edge-renderer.selection.spec.ts` and `packages/angular/src/lib/directives/key-handler.directive.spec.ts`

- [ ] **Step 1**: Create `edge-renderer.selection.spec.ts`:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { provideZonelessChangeDetection } from '@angular/core';
  import { EdgeRendererComponent } from './edge-renderer.component';
  import { FlowStore } from '../../services/flow-store.service';
  import type { Edge } from '../../types';

  function makeEdge(id: string, overrides: Partial<Edge> = {}): Edge {
    return { id, source: 'a', target: 'b', ...overrides };
  }

  describe('EdgeRendererComponent selection guards', () => {
    let store: FlowStore;
    let component: EdgeRendererComponent;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [EdgeRendererComponent],
        providers: [provideZonelessChangeDetection(), FlowStore],
      });
      store = TestBed.inject(FlowStore);
      component = TestBed.createComponent(EdgeRendererComponent).componentInstance;
    });

    it('click selects a selectable edge (control)', () => {
      store.setEdges([makeEdge('e1')]);
      component.onEdgeEvent(new MouseEvent('click'), store.edges()[0], 'click');
      expect(store.selectedEdges().map((e) => e.id)).toEqual(['e1']);
    });

    it('click does not select an edge with selectable: false (but still emits edgeClick)', () => {
      store.setEdges([makeEdge('e1', { selectable: false })]);
      let clicked = false;
      component.edgeClick.subscribe(() => (clicked = true));

      component.onEdgeEvent(new MouseEvent('click'), store.edges()[0], 'click');

      expect(store.selectedEdges()).toHaveLength(0);
      expect(clicked).toBe(true);
    });

    it('Enter keydown does not select an edge with selectable: false', () => {
      store.setEdges([makeEdge('e1', { selectable: false })]);
      component.onEdgeKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), store.edges()[0]);
      expect(store.selectedEdges()).toHaveLength(0);
    });

    it('focus does not select an edge with selectable: false', () => {
      store.setEdges([makeEdge('e1', { selectable: false })]);
      component.onEdgeFocus(store.edges()[0]);
      expect(store.selectedEdges()).toHaveLength(0);
    });
  });
  ```
  Create `key-handler.directive.spec.ts`:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { Component, provideZonelessChangeDetection } from '@angular/core';
  import { By } from '@angular/platform-browser';
  import { KeyHandlerDirective } from './key-handler.directive';
  import { FlowStore } from '../services/flow-store.service';
  import type { Node, Edge } from '../types';

  @Component({
    standalone: true,
    imports: [KeyHandlerDirective],
    template: `<div ngFlowKeyHandler></div>`,
  })
  class HostComponent {}

  function makeNode(id: string, overrides: Partial<Node> = {}): Node {
    return { id, position: { x: 0, y: 0 }, data: {}, ...overrides };
  }
  function makeEdge(id: string, overrides: Partial<Edge> = {}): Edge {
    return { id, source: 'n1', target: 'n2', ...overrides };
  }

  describe('KeyHandlerDirective select-all', () => {
    let store: FlowStore;
    let directive: KeyHandlerDirective;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [provideZonelessChangeDetection(), FlowStore],
      });
      store = TestBed.inject(FlowStore);
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      directive = fixture.debugElement
        .query(By.directive(KeyHandlerDirective))
        .injector.get(KeyHandlerDirective);
    });

    it('Ctrl+A skips nodes and edges with selectable: false', () => {
      store.setNodes([makeNode('n1'), makeNode('n2', { selectable: false })]);
      store.setEdges([makeEdge('e1'), makeEdge('e2', { selectable: false })]);

      directive.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

      expect(store.selectedNodes().map((n) => n.id)).toEqual(['n1']);
      expect(store.selectedEdges().map((e) => e.id)).toEqual(['e1']);
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/container/edge-renderer/edge-renderer.selection.spec.ts src/lib/directives/key-handler.directive.spec.ts` — expect failures: `expected [ { id: 'e1', ... } ] to have a length of +0` (click/Enter/focus select non-selectable edges) and `expected ['n1','n2'] to deeply equal ['n1']` (Ctrl+A ignores the flag).
- [ ] **Step 3**: Fix `edge-renderer.component.ts`:
  Line 465-471 (`onEdgeEvent`, click case):
  ```ts
  case 'click':
    if (this.store.elementsSelectable() && edge.selectable !== false) {
      this.store.addSelectedEdges([edge.id]);
    }
    this.edgeClick.emit({ event, edge });
    break;
  ```
  Line 491-499 (`onEdgeKeyDown`, Enter branch):
  ```ts
  } else if (event.key === 'Enter') {
    if (this.store.elementsSelectable() && edge.selectable !== false) {
      this.store.addSelectedEdges([edge.id]);
    }
  }
  ```
  Line 501-505 (`onEdgeFocus`):
  ```ts
  onEdgeFocus(edge: Edge): void {
    if (this.store.elementsSelectable() && edge.selectable !== false && !edge.selected) {
      this.store.addSelectedEdges([edge.id]);
    }
  }
  ```
  Fix `key-handler.directive.ts` lines 154-168:
  ```ts
  private handleSelectAll(): void {
    const nodeChanges = this.store
      .nodes()
      .filter((n) => n.selectable !== false)
      .map((n) => ({ id: n.id, type: 'select' as const, selected: true }));
    const edgeChanges = this.store
      .edges()
      .filter((e) => e.selectable !== false)
      .map((e) => ({ id: e.id, type: 'select' as const, selected: true }));

    this.store.triggerNodeChanges(nodeChanges as NodeChange[]);
    this.store.triggerEdgeChanges(edgeChanges as EdgeChange[]);
  }
  ```
- [ ] **Step 4**: Run `npm test -- src/lib/container/edge-renderer/edge-renderer.selection.spec.ts src/lib/directives/key-handler.directive.spec.ts` — pass. Run `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts packages/angular/src/lib/container/edge-renderer/edge-renderer.selection.spec.ts packages/angular/src/lib/directives/key-handler.directive.ts packages/angular/src/lib/directives/key-handler.directive.spec.ts; git commit -m "fix(angular): respect per-element selectable in edge click/focus and Ctrl+A"`

---

### Task 7: NodeResizer re-applies configuration when inputs change

**Files:**
- Modify: `packages/angular/src/lib/components/node-resizer/node-resizer.component.ts` (imports line 1-13, lines 189-284)
- Test: Create `packages/angular/src/lib/components/node-resizer/node-resizer.component.spec.ts`

- [ ] **Step 1**: Write the failing test (mocks `XYResizer` so config application is observable without drag simulation):
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
  import { XYResizer } from '@angflow/system';
  import { NodeResizerComponent } from './node-resizer.component';
  import { FlowStore } from '../../services/flow-store.service';
  import { NODE_ID } from '../../services/tokens';

  vi.mock('@angflow/system', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@angflow/system')>();
    return {
      ...actual,
      XYResizer: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
    };
  });

  /** Set an input() signal's value directly without going through the template. */
  function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
    const sig = (instance as Record<string, unknown>)[inputName];
    const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
    node.applyValueToInputSignal(node, value);
  }

  describe('NodeResizerComponent reactive configuration', () => {
    beforeEach(() => {
      vi.mocked(XYResizer).mockClear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [NodeResizerComponent],
        providers: [
          provideZonelessChangeDetection(),
          FlowStore,
          { provide: NODE_ID, useValue: 'n1' },
        ],
      });
    });

    function lastUpdateArg(instanceIndex: number): Record<string, unknown> {
      const instance = vi.mocked(XYResizer).mock.results[instanceIndex].value as {
        update: ReturnType<typeof vi.fn>;
      };
      const calls = instance.update.mock.calls;
      return calls[calls.length - 1][0] as Record<string, unknown>;
    }

    it('re-applies boundaries and keepAspectRatio when inputs change after init', async () => {
      const fixture = TestBed.createComponent(NodeResizerComponent);
      const inst = fixture.componentInstance;
      fixture.detectChanges(); // ngAfterViewInit → 8 XYResizer instances (4 corners + 4 lines)

      expect(vi.mocked(XYResizer)).toHaveBeenCalledTimes(8);
      expect((lastUpdateArg(0) as { boundaries: { minWidth: number } }).boundaries.minWidth).toBe(10);

      setSignalInput(inst, 'minWidth', 42);
      setSignalInput(inst, 'keepAspectRatio', true);
      fixture.detectChanges();
      await fixture.whenStable();

      for (let i = 0; i < 8; i++) {
        const cfg = lastUpdateArg(i) as { boundaries: { minWidth: number }; keepAspectRatio: boolean };
        expect(cfg.boundaries.minWidth).toBe(42);
        expect(cfg.keepAspectRatio).toBe(true);
      }
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/components/node-resizer/node-resizer.component.spec.ts` — expect: `expected 10 to be 42` (config is baked into a single `update()` call in `ngAfterViewInit`; later input changes are silently ignored).
- [ ] **Step 3**: Implement. In `node-resizer.component.ts` add `effect` and `Injector` to the `@angular/core` import (line 1-13). Add the injector field next to `el`:
  ```ts
  private el = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);
  ```
  Hoist the positions array to a class constant (it must match template order — 4 corners then 4 lines):
  ```ts
  private static readonly CONTROL_POSITIONS: ControlPosition[] = [
    'top-left', 'top-right', 'bottom-left', 'bottom-right',
    'top', 'right', 'bottom', 'left',
  ];
  ```
  In `ngAfterViewInit`, keep instance creation (the `XYResizer({...})` call with `getStoreItems`/`onChange`/`onEnd` exactly as today, minus the local `positions` array) but **delete the inline `resizer.update({...})` block** (lines 261-280) and end the method with:
  ```ts
      this.resizerInstances.push(resizer);
    });

    // Apply config now, then re-apply reactively whenever any config input
    // changes. XYResizer.update() is idempotent, so the effect's first run
    // re-applying the same config is harmless.
    this.applyResizerConfig();
    effect(() => this.applyResizerConfig(), { injector: this.injector });
  }

  private applyResizerConfig(): void {
    const boundaries = {
      minWidth: this.minWidth(),
      minHeight: this.minHeight(),
      maxWidth: this.maxWidth(),
      maxHeight: this.maxHeight(),
    };
    const keepAspectRatio = this.keepAspectRatio();
    const shouldResize = this.shouldResize();
    const onResizeStart = this.onResizeStartCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeStart.emit({ event, ...params });
    });
    const onResize = this.onResizeCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resize.emit({ event, ...params });
    });
    const onResizeEnd = this.onResizeEndCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeEnd.emit({ event, ...params });
    });

    this.resizerInstances.forEach((resizer, index) => {
      resizer.update({
        controlPosition: NodeResizerComponent.CONTROL_POSITIONS[index],
        boundaries,
        keepAspectRatio,
        onResizeStart,
        onResize,
        onResizeEnd,
        shouldResize,
      });
    });
  }
  ```
  Zoneless note: the effect tracks the eight config input signals; no NgZone, no timers.
- [ ] **Step 4**: Run `npm test -- src/lib/components/node-resizer/node-resizer.component.spec.ts` — passes. Run `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/components/node-resizer/node-resizer.component.ts packages/angular/src/lib/components/node-resizer/node-resizer.component.spec.ts; git commit -m "fix(angular): node-resizer re-applies min/max/aspect/callbacks when inputs change"`

---

### Task 8: Remove the timer-based fitView fallback racing the queued mechanism

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (import line 27, lines 874-878, 893-923)
- Test: Create `packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts`; append to `packages/angular/src/lib/services/flow-store.service.spec.ts`

Verified trigger chain for the proper path: `fitViewQueued` is consumed in `FlowStore.setNodes` (line 353, only when `adoptUserNodes` reports all nodes measured) and in `FlowStore.updateNodeInternals` (line 398, fired by the node renderer's ResizeObserver once nodes measure), both calling `resolveFitView()` → `fitViewport` with real measured bounds and `fitViewOptions`. The `setTimeout(50)` fallback (`doFitView`, hardcoded 150x40, ignores `fitViewOptions` except padding) races it. Empty graph: `adoptUserNodes` returns `nodesInitialized = false` for zero nodes, so the flag stays queued — explicit decision: that is correct (default viewport remains; the first non-empty measured `setNodes` still fits), pinned by a store-level test.

- [ ] **Step 1**: Create `ng-flow.component.spec.ts` with the jsdom mount stubs (reused by Tasks 9 and 10):
  ```ts
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
  import { NgFlowComponent } from './ng-flow.component';

  /** Set an input() signal's value directly without going through the template. */
  function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
    const sig = (instance as Record<string, unknown>)[inputName];
    const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
    node.applyValueToInputSignal(node, value);
  }

  class FakeResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  describe('NgFlowComponent fitView startup', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [NgFlowComponent],
        providers: [provideZonelessChangeDetection()],
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('does not move the viewport from a timer before nodes are measured', () => {
      vi.useFakeTimers();
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      setSignalInput(inst, 'fitView', true);
      setSignalInput(inst, 'nodesModel', [
        { id: 'a', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', position: { x: 400, y: 300 }, data: {} },
      ]);
      fixture.detectChanges();

      const before = inst.store.transform();
      vi.advanceTimersByTime(60);

      // Nodes are unmeasured, so the queued fitView must still be pending and
      // no timer fallback may guess dimensions and jump the viewport.
      expect(inst.store.transform()).toEqual(before);
      expect(inst.store.fitViewQueued()).toBe(true);
    });
  });
  ```
  Append to `flow-store.service.spec.ts` (pins the empty-graph decision and the measured path; uses the existing `store` fixture and a fake panZoom):
  ```ts
  describe('queued fitView', () => {
    it('stays queued for an empty graph (default viewport is kept)', () => {
      const setViewport = vi.fn().mockResolvedValue(undefined);
      store.panZoom.set({ setViewport } as never);
      store.fitViewQueued.set(true);

      store.setNodes([]);

      expect(store.fitViewQueued()).toBe(true);
      expect(setViewport).not.toHaveBeenCalled();
    });

    it('resolves once nodes arrive with dimensions', () => {
      const setViewport = vi.fn().mockResolvedValue(undefined);
      store.panZoom.set({ setViewport } as never);
      store.width.set(800);
      store.height.set(600);
      store.fitViewQueued.set(true);

      store.setNodes([]); // empty mount first — flag must survive
      store.setNodes([
        { id: 'a', position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 50 } },
      ] as never);

      expect(store.fitViewQueued()).toBe(false);
      expect(setViewport).toHaveBeenCalledTimes(1);
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/container/ng-flow/ng-flow.component.spec.ts src/lib/services/flow-store.service.spec.ts` — the component test fails: `expected [ -0.x, ..., 0.5 ] to deeply equal [ 0, 0, 1 ]` (the 50ms `doFitView` fallback fired with guessed 150x40 dimensions and moved the transform). The store tests pass already (they pin existing behavior).
- [ ] **Step 3**: In `ng-flow.component.ts`: delete the timeout block in `ngAfterViewInit` (lines 874-878):
  ```ts
  // DELETE:
  // Perform fitView after a short delay to allow dimensions to settle
  if (this.fitView()) {
    setTimeout(() => {
      this.doFitView();
    }, 50);
  }
  ```
  Delete the entire `doFitView()` method (lines 893-923). Remove `getViewportForBounds` from the `@angflow/system` import (line 27 — it was only used by `doFitView`). The queued path set in `ngOnInit` (lines 836-839) is now the single fitView mechanism; add a comment there:
  ```ts
  // Queue fit view if requested. The store consumes the flag once nodes are
  // measured (setNodes / updateNodeInternals). With zero nodes it stays
  // queued: the default viewport is kept, and the first non-empty measured
  // setNodes still gets the initial fit.
  if (this.fitView()) {
    this.store.fitViewQueued.set(true);
    this.store.fitViewOptions.set(this.fitViewOptions());
  }
  ```
- [ ] **Step 4**: Run `npm test -- src/lib/container/ng-flow/ng-flow.component.spec.ts src/lib/services/flow-store.service.spec.ts` — pass. Run the full suite once (`npm test`) since fit-view timing affects examples-level tests, plus `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts packages/angular/src/lib/services/flow-store.service.spec.ts; git commit -m "fix(angular): remove timer-based fitView fallback that raced the queued fitView"`

---

### Task 9: Implement the controlled `[viewport]` input

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (imports line 1-18, constructor, `initPanZoom` lines 964-1001, module scope)
- Test: `packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts` (append; reuses Task 8's stubs)

- [ ] **Step 1**: Append failing tests:
  ```ts
  describe('NgFlowComponent controlled [viewport]', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [NgFlowComponent],
        providers: [provideZonelessChangeDetection()],
      });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('applies the [viewport] input to the store', () => {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      setSignalInput(inst, 'viewportModel', { x: 100, y: 50, zoom: 2 });
      fixture.detectChanges();

      expect(inst.store.viewport()).toEqual({ x: 100, y: 50, zoom: 2 });
    });

    it('applies later [viewport] changes', () => {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      setSignalInput(inst, 'viewportModel', { x: 0, y: 0, zoom: 1 });
      fixture.detectChanges();

      setSignalInput(inst, 'viewportModel', { x: -25, y: 10, zoom: 1.5 });
      fixture.detectChanges();

      expect(inst.store.viewport()).toEqual({ x: -25, y: 10, zoom: 1.5 });
    });

    it('skips re-applying an equal viewport (no controlled-mode feedback loop)', () => {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      setSignalInput(inst, 'viewportModel', { x: 100, y: 50, zoom: 2 });
      fixture.detectChanges();

      const pz = inst.store.panZoom();
      expect(pz).not.toBeNull();
      const syncSpy = vi.spyOn(pz!, 'syncViewport');

      // Same values, new object — exactly what a (viewportChange) → [viewport]
      // round-trip re-binds.
      setSignalInput(inst, 'viewportModel', { x: 100, y: 50, zoom: 2 });
      fixture.detectChanges();

      expect(syncSpy).not.toHaveBeenCalled();
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/container/ng-flow/ng-flow.component.spec.ts` — expect: `expected { x: 0, y: 0, zoom: 1 } to deeply equal { x: 100, y: 50, zoom: 2 }` (`viewportModel` is declared at line 259 but never read).
- [ ] **Step 3**: Implement. Add `untracked` to the `@angular/core` import list (line 1-18). Add at module scope (below the imports):
  ```ts
  const VIEWPORT_EPSILON = 1e-4;

  function viewportsEqual(a: Viewport, b: Viewport): boolean {
    return (
      Math.abs(a.x - b.x) < VIEWPORT_EPSILON &&
      Math.abs(a.y - b.y) < VIEWPORT_EPSILON &&
      Math.abs(a.zoom - b.zoom) < VIEWPORT_EPSILON
    );
  }
  ```
  Add this effect in the constructor, next to the nodes/edges model effects (after line 676):
  ```ts
  // Controlled viewport: apply [viewport] input changes to the store.
  // `untracked` keys this effect to the input only — tracking the store read
  // would re-run it on every user pan and fight the pointer. syncViewport
  // updates d3's internal transform without dispatching a zoom event, so
  // applying the input never re-emits (viewportChange); together with the
  // epsilon guard this prevents controlled-mode feedback loops.
  effect(() => {
    const vp = this.viewportModel();
    if (!vp) return;
    untracked(() => {
      if (viewportsEqual(vp, this.store.viewport())) return;
      this.store.transform.set([vp.x, vp.y, vp.zoom]);
      this.store.bumpVersion();
      this.store.panZoom()?.syncViewport(vp);
    });
  });
  ```
  In `initPanZoom` (lines 964-1001), honor the input for the initial viewport so it isn't clobbered by `defaultViewport`:
  ```ts
  const initialViewport = this.viewportModel() ?? this.defaultViewport();
  const panZoom = XYPanZoom({
    domNode: paneElement,
    minZoom: this.minZoom(),
    maxZoom: this.maxZoom(),
    viewport: initialViewport,
    translateExtent: this.translateExtent(),
    ...
  ```
  and replace lines 995-997:
  ```ts
  // Set initial transform from the controlled viewport (if bound) or the default
  this.store.transform.set([initialViewport.x, initialViewport.y, initialViewport.zoom]);
  ```
  Update the `viewportModel` doc comment (line 258) to: `/** Controlled viewport ({ x, y, zoom }). Re-bind from (viewportChange) to keep it in sync; equal values are not re-applied. */`
- [ ] **Step 4**: Run `npm test -- src/lib/container/ng-flow/ng-flow.component.spec.ts` — pass. Run `npm test` (full) and `npm run typecheck`.
- [ ] **Step 5**: Commit: `git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts; git commit -m "feat(angular): wire the controlled [viewport] input with re-entrancy guard"`

---

### Task 10: `<ng-flow-provider>` shares FlowStore/NgFlowService with `<ng-flow>` (riskiest — last)

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (imports line 1-18, providers line 134, `ngOnDestroy` lines 884-891)
- Test: Create `packages/angular/src/lib/components/ng-flow-provider/ng-flow-provider.component.spec.ts`
- Reference (unchanged): `packages/angular/src/lib/components/ng-flow-provider/ng-flow-provider.component.ts` (line 22 keeps its type providers — destroy hooks run there automatically)

DI analysis (verified): `FlowStore` is `@Injectable()` with **no constructor** — `new FlowStore()` is legal anywhere. `NgFlowService` has no constructor but uses `inject(FlowStore)` / `inject(DestroyRef)` in field initializers (ng-flow.service.ts:52-53) — `new NgFlowService()` works **inside a `useFactory`** because factories execute in an injection context, and its `inject(FlowStore)` resolves against the current (NgFlowComponent) injector, i.e. the shared-or-fresh store from the sibling factory. Caveat handled below: node-injector `useFactory` providers do **not** get `ngOnDestroy` called automatically (Angular only registers destroy hooks for type/`useClass` component providers), so the fresh-store branch wires `FlowStore.ngOnDestroy` (tween/rAF cleanup, flow-store.service.ts:559-567) through `DestroyRef` — and the parent-reuse branch deliberately registers nothing, so an inner `<ng-flow>` unmount can never destroy the provider's store.

- [ ] **Step 1**: Write the failing spec (`ng-flow-provider.component.spec.ts`):
  ```ts
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { Component, inject, provideZonelessChangeDetection } from '@angular/core';
  import { By } from '@angular/platform-browser';
  import { NgFlowProviderComponent } from './ng-flow-provider.component';
  import { NgFlowComponent } from '../../container/ng-flow/ng-flow.component';
  import { FlowStore } from '../../services/flow-store.service';
  import { NgFlowService } from '../../services/ng-flow.service';
  import type { Node } from '../../types';

  @Component({ selector: 'test-sidebar', standalone: true, template: '' })
  class SidebarComponent {
    readonly flow = inject(NgFlowService);
    readonly store = inject(FlowStore);
  }

  @Component({
    standalone: true,
    imports: [NgFlowProviderComponent, NgFlowComponent, SidebarComponent],
    template: `
      <ng-flow-provider>
        <ng-flow />
        <test-sidebar />
      </ng-flow-provider>
    `,
  })
  class ProviderHostComponent {}

  @Component({
    standalone: true,
    imports: [NgFlowComponent],
    template: `<ng-flow /><ng-flow />`,
  })
  class TwoFlowsHostComponent {}

  class FakeResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  describe('NgFlowProviderComponent state sharing', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ProviderHostComponent, TwoFlowsHostComponent],
        providers: [provideZonelessChangeDetection()],
      });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('shares the provider FlowStore and NgFlowService with <ng-flow> and siblings', () => {
      const fixture = TestBed.createComponent(ProviderHostComponent);
      fixture.detectChanges();

      const providerInjector = fixture.debugElement.query(By.directive(NgFlowProviderComponent)).injector;
      const providerStore = providerInjector.get(FlowStore);
      const providerService = providerInjector.get(NgFlowService);
      const flow = fixture.debugElement.query(By.directive(NgFlowComponent)).componentInstance as NgFlowComponent;
      const sidebar = fixture.debugElement.query(By.directive(SidebarComponent)).componentInstance as SidebarComponent;

      expect(flow.store).toBe(providerStore);
      expect(flow.service).toBe(providerService);
      expect(sidebar.store).toBe(providerStore);
      expect(sidebar.flow).toBe(providerService);
    });

    it('sidebar mutations through NgFlowService are visible to the flow', () => {
      const fixture = TestBed.createComponent(ProviderHostComponent);
      fixture.detectChanges();
      const flow = fixture.debugElement.query(By.directive(NgFlowComponent)).componentInstance as NgFlowComponent;
      const sidebar = fixture.debugElement.query(By.directive(SidebarComponent)).componentInstance as SidebarComponent;

      sidebar.flow.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as Node]);

      expect(flow.store.nodes().map((n) => n.id)).toEqual(['n1']);
    });

    it('standalone <ng-flow> instances still get isolated stores', () => {
      const fixture = TestBed.createComponent(TwoFlowsHostComponent);
      fixture.detectChanges();
      const flows = fixture.debugElement.queryAll(By.directive(NgFlowComponent));
      const a = flows[0].componentInstance as NgFlowComponent;
      const b = flows[1].componentInstance as NgFlowComponent;

      expect(a.store).not.toBe(b.store);
      a.store.setNodes([{ id: 'x', position: { x: 0, y: 0 }, data: {} } as Node]);
      expect(b.store.nodes()).toHaveLength(0);
    });
  });
  ```
- [ ] **Step 2**: Run `npm test -- src/lib/components/ng-flow-provider/ng-flow-provider.component.spec.ts` — expect: `expected FlowStore{…} to be FlowStore{…} // Object.is equality` (NgFlowComponent's `providers: [FlowStore, NgFlowService]` unconditionally shadows the provider's instances).
- [ ] **Step 3**: Implement in `ng-flow.component.ts`. Add `DestroyRef` to the `@angular/core` import (line 1-18). Replace line 134:
  ```ts
  providers: [
    // Reuse a FlowStore/NgFlowService provided by an enclosing
    // <ng-flow-provider>; otherwise create our own. Factories run in an
    // injection context, so `new NgFlowService()` resolves its inject(FlowStore)
    // against THIS injector — i.e. the shared-or-fresh store below.
    {
      provide: FlowStore,
      useFactory: () => {
        const parentStore = inject(FlowStore, { optional: true, skipSelf: true });
        if (parentStore) return parentStore;
        const store = new FlowStore();
        // Node-injector useFactory providers don't get ngOnDestroy called
        // automatically — wire the tween/rAF cleanup explicitly. Deliberately
        // NOT registered for the parent-reuse branch above, so unmounting an
        // inner <ng-flow> can never destroy the provider's shared store.
        inject(DestroyRef).onDestroy(() => store.ngOnDestroy());
        return store;
      },
    },
    {
      provide: NgFlowService,
      useFactory: () =>
        inject(NgFlowService, { optional: true, skipSelf: true }) ?? new NgFlowService(),
    },
  ],
  ```
  In `ngOnDestroy` (lines 884-891), clear the now-dead panZoom reference so a shared store never points at a destroyed instance:
  ```ts
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.panZoomInstance?.destroy();
    this.store.panZoom.set(null);
    if (this.colorSchemeQuery && this.colorSchemeHandler) {
      this.colorSchemeQuery.removeEventListener('change', this.colorSchemeHandler);
    }
    // Note: with <ng-flow-provider> the store instance survives this reset —
    // siblings keep their injected references; the graph state is cleared.
    this.store.reset();
  }
  ```
- [ ] **Step 4**: Run `npm test -- src/lib/components/ng-flow-provider/ng-flow-provider.component.spec.ts` — pass. Then run the **full suite** `npm test` (the DI change touches every component test that provides FlowStore at the TestBed root — `skipSelf` must not accidentally pick those up in unrelated specs; the standalone-isolation test guards the common case) and `npm run typecheck`.
- [ ] **Step 5**: Update the `NgFlowProviderComponent` doc comment (ng-flow-provider.component.ts, lines 5-17) to state the now-true behavior: descendant `<ng-flow>` instances reuse the provider's `FlowStore`/`NgFlowService`, so siblings observe the same state.
- [ ] **Step 6**: Commit: `git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/components/ng-flow-provider/ng-flow-provider.component.ts packages/angular/src/lib/components/ng-flow-provider/ng-flow-provider.component.spec.ts; git commit -m "feat(angular): ng-flow reuses FlowStore/NgFlowService from an enclosing ng-flow-provider"`

---

### Critical Files for Implementation
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\container\ng-flow\ng-flow.component.ts (Tasks 8, 9, 10 — providers, fitView, viewport)
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\services\flow-store.service.ts (handle registry, fitViewQueued, ngOnDestroy semantics all fixes depend on)
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\services\ng-flow.service.ts (Task 3; DI shape drives the Task 10 factories)
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\agent\agent-bridge.service.ts (Task 4)
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\components\handle\handle.component.ts (Task 5)

---

### Task 11: Pan-zoom options effect — track `userSelectionActive` explicitly

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (lines 755-770, the pan/zoom options effect)
- Test: existing suite + typecheck (the dependency is consumed inside `updatePanZoomOptions()`, which short-circuits while `panZoomInstance` is null on first run, so the signal read never registers as a dependency — a latent bug masked today by PaneComponent swallowing mousedown in capture phase)

- [ ] **Step 1: Implement.** Add the explicit read alongside the other dependency reads (after `this.paneClickDistance();` at line 768):

```ts
      this.paneClickDistance();
      // userSelectionActive is consumed inside updatePanZoomOptions(); read it
      // here explicitly — the method body short-circuits while panZoomInstance
      // is null on first run, so the inner read never registers a dependency.
      this.store.userSelectionActive();
      this.updatePanZoomOptions();
```

- [ ] **Step 2: Run the suite and typecheck.**
  Command: `pnpm -F @angflow/angular test` then `pnpm -F @angflow/angular run typecheck`
  Expected: all pass, exit 0.

- [ ] **Step 3: Commit.**
  Command: `git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` then
  `git commit -m "fix(angular): track userSelectionActive in the pan-zoom options effect - inner read is skipped before init"`

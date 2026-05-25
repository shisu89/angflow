# Angflow AI-Agent Monetization Roadmap

> **Status:** Strategy locked, not yet in implementation. This is a living
> document — refine as we go. Unlike the task-by-task plans in this folder,
> this is a phased GTM/architecture roadmap; each phase will get its own
> detailed spec + plan when we pick it up.

**Thesis:** angflow's wedge is making flow diagrams editable and generatable by
AI agents. The existing `AngflowAgentBridge` (JSON-RPC tool catalog over the
flow) is the seed of a product, not just a library feature. We monetize by
turning that surface into (a) a dev library + MCP server, (b) a hosted SaaS,
and (c) an embeddable widget — all on one shared core.

---

## Locked decisions

1. **Scope:** Build all three product shapes and both interaction models. Not
   picking a single shape — they form a dependency chain, not alternatives.
2. **Architecture:** One shared core; two front doors; three shapes as
   packaging layers (see below).
3. **GTM order:** **Lib + MCP first.** Phases 0→2 produce the first sellable
   artifact (dev library + MCP server). Hosted backend follows in Phases 3→4.

---

## Product shapes (the three things we sell)

- **Shape A — Dev library + MCP server.** A developer drops angflow into their
  Angular app and an AI agent (via MCP) can read/edit the flow. Self-hosted,
  client-side. *First to ship.*
- **Shape B — Hosted SaaS.** We run the backend: flow storage, session
  routing, and a server-side agent loop that builds/edits flows. Multi-tenant,
  auth-gated.
- **Shape C — Embeddable widget.** A thin embed client over Shape B's backend
  that any site can drop in. Mostly packaging + a public embed API.

Dependency chain: **A and B build on the shared core; C builds on B's
backend.**

## Interaction models (both supported)

- **Live co-edit:** agent mutates a flow a human is looking at, in real time.
- **Headless generation:** agent builds a flow from nothing (or edits a stored
  doc) with no live canvas attached, then it can be opened later.

## Shared core (built once, used everywhere)

- **Flow-doc contract:** a canonical, **versioned** flow JSON — the
  interchange format for export/import, storage, and headless generation.
- **Transport-agnostic tool catalog:** the existing bridge tools refactored
  onto a `FlowState` interface with two backends:
  - *live backend* — the signal store (today's behavior),
  - *headless backend* — operates on a server-side flow doc with no view.
- **Two front doors** wrap the same catalog: **MCP** (Shape A) and a
  **server-side agent loop** (Shapes B/C).

---

## Phases

### Near-term — first revenue artifact (Model A)

**Phase 0 — Kernel + flow-doc contract**
- Define the canonical versioned flow-doc JSON.
- Refactor bridge tools onto a `FlowState` interface with live + headless
  backends.
- Add `export_flow` / `import_flow` tools. (Persistence falls out of this.)

**Phase 1 — Dual-mode wedge demo**
- Demonstrate live canvas edit *and* headless build-then-open from the same
  core — proves both interaction models in roughly one build.
- **Open input:** pick the demo vertical here (ETL pipeline, agent-chain
  builder, generic diagram, …). This choice decides whether runtime
  node-type registration becomes urgent (see Risks).

**Phase 2 — MCP front door**
- Wrap the tool catalog as an MCP server.
- **→ Dev library + MCP server ships. First sellable artifact.**

### Then — hosted platform (Models B, C)

**Phase 3 — Hosted backend**
- Relay / session routing (the load-bearing piece), flow storage, server-side
  agent loop (front door #2).
- **Spike first:** routing/conflict model — WebSocket rooms vs. CRDT sync —
  before committing the design.

**Phase 4 — Auth + multi-tenancy**
- Accounts, tenancy isolation. Server-side Pro-gating lands here (leak-proof,
  unlike a client-side license key).

**Phase 5 — HITL / staged ghost-node changes**
- Human-in-the-loop: agent proposes staged ("ghost") changes a human accepts
  or rejects. Deliberately later — invasive, not needed to prove the thesis,
  and a strong Pro differentiator.

**Phase 6 — Embeddable widget**
- Thin embed client over Phase 3's backend; mostly packaging + a public embed
  API.

**Phase 7 — Monetize**
- Shape A: license key (accept client-side leakiness; dev tier).
- Shapes B/C: server-side gating (the real revenue).

---

## Tracked risks (not blockers)

- **Runtime node-type registration in Angular** (dynamic components). Only
  urgent if the Phase 1 demo vertical needs custom node types.
- **Relay routing / conflict model.** The one spot warranting a design spike
  before Phase 3.

## Open inputs

- **Demo vertical for Phase 1** — needed before Phase 1 starts; also resolves
  the node-type risk.

---

## Next move

When we resume building, start with **Phase 0** (kernel + flow-doc contract).
Before **Phase 1**, lock the demo vertical.

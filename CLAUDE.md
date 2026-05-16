# angflow — Angular Port of xyflow/ReactFlow

Published as `@angflow/system` and `@angflow/angular` on npm.

## Project Structure

```
angflow/
  packages/
    system/                # Framework-agnostic core (D3-based)
    angular/               # Angular wrapper library
    react/                 # Original React wrapper (reference)
    svelte/                # Original Svelte wrapper (reference)
  examples/
    angular/               # Angular dev example (uses workspace packages)
    react/                 # React example (reference)
    svelte/                # Svelte example (reference)
    astro-xyflow/          # Astro example (reference)
  openspec/                # Change tracking artifacts
```

## Build & Local Dev Flow

### 1. Build the system package (if changed)

```bash
cd packages/system
npm run build        # rollup → dist/esm/ + dist/umd/
npm pack             # → angflow-system-x.x.x.tgz
```

### 2. Build the Angular package

```bash
cd packages/angular
npm run build        # ngc + CSS bundle → dist/esm/ + dist/style.css
npm pack             # → angflow-angular-x.x.x.tgz
```

## Publish to npm

### First-time setup
- npm org: `angflow` (owner: `sjs89`)
- 2FA is enabled — each publish prompts for browser approval

### Publish flow

System must be published before angular (angular depends on it).

```bash
# System (if changed)
cd packages/system
npm version patch          # bump 0.0.76 → 0.0.77
npm run build
npm publish --access public

# Angular
cd packages/angular
# Update @angflow/system version in package.json if system was bumped
npm version patch          # bump 0.0.1 → 0.0.2
npm run build
npm publish --access public
```

### Version bumps
- `npm version patch` — bug fixes (0.0.1 → 0.0.2)
- `npm version minor` — new features (0.0.1 → 0.1.0)
- `npm version major` — breaking changes (0.0.1 → 1.0.0)

## Consumer Apps

### examples/angular
- Angular dev example at `examples/angular/`
- Consumes `@angflow/angular` and `@angflow/system` via pnpm `workspace:*` dependencies
- **Initial setup requires building both packages** — `dist/` is gitignored, and the packages' `exports` point at `dist/`, so `ng serve` will fail with `TS2307: Cannot find module '@angflow/angular'` on a fresh clone until you run `pnpm -F @angflow/system build && pnpm -F @angflow/angular build`
- After the initial build, ongoing changes still require a rebuild of the affected package — `packages/system` has a `npm run dev` watch script; `packages/angular` does not, so run `npm run build` in `packages/angular` after each change, then restart `ng serve` if it doesn't hot-reload

## Key Commands

| Task | Command | Directory |
|------|---------|-----------|
| Type-check angular | `npx tsc --noEmit` | `packages/angular` |
| Build angular | `npm run build` | `packages/angular` |
| Pack angular | `npm pack` | `packages/angular` |
| Build system | `npm run build` | `packages/system` |
| Pack system | `npm pack` | `packages/system` |
| Publish system | `npm publish --access public` | `packages/system` |
| Publish angular | `npm publish --access public` | `packages/angular` |
| Run angular example | `npm run dev` | `examples/angular` |
| Build angular example | `npm run build` | `examples/angular` |

## Architecture

- **@angflow/system**: Framework-agnostic core. XYDrag, XYHandle, XYPanZoom, XYResizer, XYMinimap classes. Graph utils, path generators, types.
- **@angflow/angular**: Angular signals-based wrapper. FlowStore (state), NgFlowService (API), NgFlowComponent (main), node/edge renderers, plugin components (Background, Controls, MiniMap, etc.).
- System package should rarely need changes — most work happens in the Angular package.

## Zoneless-first contributor rules

The Angular package assumes no Zone.js. These rules preserve that invariant:

1. **Never inject `NgZone`.** If you think you need it, you're mixing Zone.js assumptions into zoneless-native code. Drive view updates via signal writes instead.
2. **Event handlers from outside Angular (D3 bindings, native listeners, `requestAnimationFrame` callbacks) must drive view updates via signal writes.** Never rely on Zone to tick change detection. Writing to a signal the template reads is sufficient.
3. **Timers are fine.** `setTimeout` / `setInterval` / `requestAnimationFrame` used to schedule logic are framework-agnostic and work in both zoneless and zonal modes. Only the *purpose* matters — using them to force CD is forbidden (rule 2); using them to delay work is allowed.

Library builds and examples must keep the zonal example suite passing (`examples/angular/`) and meet the zoneless example validation bar documented in `docs/superpowers/specs/2026-04-18-angular-19-zoneless-upgrade-design.md`.

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
- No build/pack step needed — changes in `packages/angular` and `packages/system` reflect immediately
- Good for development iteration

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

# Sub-project D2 — upstream 1.0 theming alignment (design)

Date: 2026-11-26. Roadmap: [`docs/reviews/2026-11-24-upstream-sync.md`](../../reviews/2026-11-24-upstream-sync.md) §3 (colour-mode and `@layer` rows) and §5 row D2.
Predecessors: B, C, D1 ([spec](2026-11-25-api-alignment-d1-design.md)), all on `main` and pushed (D1 at `12f701b37`, CI green), all unpublished.

## Goal

Adopt upstream's 1.0 theming model the way upstream did it:

- **colour mode:** `colorMode` is removed. `forceColorMode?: 'light' | 'dark'` replaces it. By default the flow follows the system or page colour scheme (`prefers-color-scheme`, or `data-theme` / `.dark` / `.light` on an ancestor) through CSS `color-scheme` plus `light-dark()` tokens, with no JavaScript (#5843, #6118);
- **cascade:** every stylesheet angflow ships lives in `@layer xyflow`, so unlayered app CSS always wins (#5844);
- **theme file:** the optional full theme `xy-theme.css` ships as `@angflow/angular/xy-theme.css` (#901b0e4cc and follow-ups).

After D2 the two remaining known failures (`props.spec` colorMode, owner D) are fixed, and `known-failures.ng.ts` is empty.

## Decisions (2026-11-26, by the user)

| Question | Decision |
|---|---|
| Breaking-change policy | Match upstream fully (standing). `colorMode` and `'system'` go, with no alias |
| `xy-theme.css` | Port it in D2, with an Angular wrapper, exported as `@angflow/angular/xy-theme.css` |
| `ng-flow.css` | Move it into `@layer xyflow` and replace its dark block with `light-dark()`. Delete rules that duplicate system's, so system tokens are authoritative |
| CSS build | "What's technically best and future-proof", which resolves to **postcss**. See below |
| Release | Still the single final 0.4.0 / 0.2.0 / 0.1.0 (already bumped in D1). D2 adds changelog entries under 0.4.0 |

**Why postcss.** `bundle-css.js` is a regex pipeline. It strips comments, inlines `@import` and flattens `&` nesting by string replacement. It doesn't understand `@import … layer(x)`, and every new CSS construct in an upstream port would need a regex patch. Upstream builds the same system files with `postcss-import` (which implements `layer()` per spec) and `postcss-nested`. Using the same parser and plugins means each future upstream CSS port (monthly G triage) builds the same way it does upstream, and failures show up as parse errors rather than silently wrong output. The cost is a few devDependencies (`postcss`, `postcss-import`, `postcss-nested`, `autoprefixer`), which upstream also uses. There's no rename plugin, because angflow keeps upstream's `xy-flow` class names. There's no cssnano either: angflow ships readable CSS, and consumers' bundlers minify it.

## Starting point (verified 2026-11-26, `main` @ `12f701b37`)

- **Angular API.** `ng-flow.component.ts` has `colorMode = input<ColorMode>('light')` (line 518). It also has a `systemPrefersDark` signal fed by a `matchMedia` listener, set up in `ngOnInit` (around line 1012), and `resolvedColorMode` driving host `[class.dark]` / `[class.light]` (lines 173–174). `public-api.ts` re-exports `ColorMode` and `ColorModeClass`.
- **System types.** `types/general.ts` has `ColorModeClass = 'light' | 'dark'` and `ColorMode = ColorModeClass | 'system'`. Upstream (ef4423b0b) has only `ColorMode = 'light' | 'dark'`.
- **System CSS.** `git diff HEAD upstream/main -- packages/system/src/styles` touches 4 files: `init.css`, `style.css`, `base.css`, and the new `xy-theme.css` (208 lines). The upstream style commits not yet in angflow come from this list, oldest first: afa495f7a (touch-action on pane), ef4423b0b (light-dark + forceColorMode), 906c8785f (base.css node colour), 901b0e4cc, 6f660d343, 75bc84ef3, 4f5f64498, 8bc429813 (xy-theme), a6ba7ca10 (light/dark class up the tree), 9675e26ec / f7abbac70 / 030938847 (pane cursor), 626f32697 (#6118 force colour), a211bed9b, 6a2963572 (xy-theme). Some, such as the pane-cursor change c68594a71, are already hand-ported. The plan checks each one with `git apply --check`.
- **Angular CSS.** `bundle-css.js` builds:
  - `dist/style.css` from `style.css` (system init, style and node-resizer, edge-text fills, cursor SVGs) plus `ng-flow.css`;
  - `dist/base.css` from `base.css` (system init, base and node-resizer) plus the same `ng-flow.css`.

  `ng-flow.css` (473 lines) opens with a full `.xy-flow` token block whose values **differ** from system's: edge stroke `#999` and width `1.5` against `#b1b1b7` and `1`, and connection line `#555` / `2` against `#b1b1b7` / `1`. It also has its own `.xy-flow.dark` block. Because `base.css` bundles all of `ng-flow.css`, the "minimal" `base.css` carries theme colours, which is a bug. The cursor SVG overrides appear twice, once in `style.css` and once in `ng-flow.css`.
- **Component styles.** `template-node.component.ts` hard-codes light colours (`#ffffff`, `#1e293b`, …) and has no dark variant. The handle-group/row component styles are layout-only, apart from a `--text-secondary` label colour. Agent chat has its own `--ngf-chat-*` palette and isn't part of the flow theme.
- **Agent bridge.** No tool reads or sets the colour mode (verified with grep), so there are no tool changes and no mcp snapshot change.
- **Example.** `examples/angular/.../color-mode.component.ts` has one `colorMode` select (light/dark/system) and none of the upstream testids. Upstream's `/examples/color-mode` has:
  - a **page theme** select (`data-testid="colormode-select"`: system / light / dark), which sets or removes `data-theme` on `<html>`;
  - a **force** select (`data-testid="force-colormode-select"`: none / light / dark), bound to `forceColorMode`.

  `kitchen-sink.component.ts` also binds `colorMode`.

## Design

### 1. System: CSS and `ColorMode` (one upstream change at a time)

Port the style commits above in order, each with `git diff <sha>^1 <sha> -- packages/system | git apply`, or a hand-port with "Ported from …" when the apply fails. Each port is its own commit.

The **end state** is that `git diff HEAD upstream/main -- packages/system/src/styles` is empty. Any remaining hunk is listed and justified in the report.

In the same commit as ef4423b0b's CSS, `types/general.ts` changes to `ColorMode = 'light' | 'dark'`, and `ColorModeClass` is removed (system's public API, breaking).

### 2. Angular: `forceColorMode`

- Remove `colorMode`, `systemPrefersDark`, `resolvedColorMode`, the `matchMedia` listener and its teardown.
- Add `readonly forceColorMode = input<ColorMode | undefined>(undefined)`.
- Host bindings become `[class.dark]="forceColorMode() === 'dark'"` and `[class.light]="forceColorMode() === 'light'"`. By default neither class is set, and `.xy-flow` has `color-scheme: light dark` from system `init.css`.
- `public-api.ts` drops `ColorModeClass`.
- Grep gate: no `colorMode` / `ColorModeClass` / `prefers-color-scheme` left in `packages/angular/src`, except negative tests.

This also removes a `window` access from component init, which helps SSR.

### 3. CSS build: postcss

- Replace the regex internals of `packages/angular/scripts/bundle-css.js` with a postcss run of `postcss-import → postcss-nested → autoprefixer`, keeping the script and the `npm run build` entry point.
- Each entry file states its layering the way upstream's do: `@import '…/init.css' layer(xyflow);` and an `@layer xyflow { … }` block for angflow's own rules.
- Outputs:
  - `dist/base.css`: system init, base and node-resizer, plus Angular structural rules. No theme colours.
  - `dist/style.css`: system init, style and node-resizer, plus Angular structural and theme rules.
  - `dist/xy-theme.css`: `base.css` plus system `xy-theme.css`, plus the Angular edge-text fills.
- `package.json` `exports` add `./base.css`, `./style.css` and `./xy-theme.css`, and keep `./dist/*.css` so existing imports work. `files` already ships `*.css`.
- **Build test (vitest, node).** Run the bundler into a temp dir, then parse every output with postcss and assert:
  - every rule sits inside `@layer xyflow`;
  - no `&` or `@import` is left;
  - `light-dark(` is present;
  - `base.css` has no `--xy-theme-` tokens and no `.xy-flow.dark` colour block;
  - `style.css` and `base.css` each contain the Angular-specific selectors the audit keeps.

### 4. `ng-flow.css` audit

Each rule in `ng-flow.css` gets one of four outcomes:

1. **Deleted as a duplicate.** The rule is identical to, or superseded by, a system rule.
2. **Deleted as a divergent token.** This covers the token block and `.xy-flow.dark`. System's `light-dark()` tokens become authoritative, and angflow's default look adopts upstream's values. This is visible: edges become `#b1b1b7` at width 1, and the connection line becomes `#b1b1b7` at width 1. It's a changelog note, with the variables to set to keep the old look.
3. **Kept as Angular structural.** Covers rules for angflow-only DOM such as host elements, `ng-flow__*` classes, the node entry animation and the resize touch-action. These go in both bundles, wrapped in `@layer xyflow`.
4. **Kept as Angular theme.** Angular-only colour rules become `light-dark()` and go in `style.css` only.

The cursor SVG overrides end up in exactly one place, inside the layer. The audit result, one line per section, goes in the commit body.

Visual check (time-boxed to 20 minutes, no pixel tooling): computed-style assertions in e2e or a component test. In each colour scheme, `color-scheme` and one resolved token (`--xy-edge-stroke-default` → stroke colour on an edge path) are checked, plus one screenshot each of light and dark for the user.

### 5. `xy-theme.css`

Add `packages/angular/src/lib/styles/xy-theme.css`, mirroring `packages/react/src/styles/xy-theme.css`:

- `@import './base.css';`
- `@import '…/system/src/styles/xy-theme.css' layer(xyflow);`
- an `@layer xyflow` block with the Angular edge-text fills.

Brand colours keep the system defaults: angflow has no brand palette, and choosing one is out of scope.

Add an example route `/examples/xy-theme` that imports the theme for a scoped demo (a route-level `styleUrl` or a stylesheet link), so the theme is exercised by a build and looked at once.

### 6. Component styles

`template-node` colours move to `light-dark()`, behind `--xy-*` / `--ngf-template-*` custom properties, so the node follows the flow's colour scheme. `handle-row`'s label colour uses `light-dark()`. Component styles stay unlayered and encapsulated, because they only target their own classes and theme through custom properties. Agent chat is unchanged (out of scope, noted in the report).

### 7. Examples and e2e

- `color-mode.component.ts` matches upstream: a page-theme select (`colormode-select`) that sets or removes `<html data-theme>`, and a force select (`force-colormode-select`, with none mapped to `undefined`) bound to `[forceColorMode]`. `ngOnDestroy` removes `data-theme` so other routes aren't affected.
- `kitchen-sink` moves to `forceColorMode`.
- Both `props.spec` colorMode entries leave `known-failures.ng.ts` (2 → 0). `check-known-failures` must report 0 STALE, 0 NOT MATCHED.
- Generic test pages: no change. Only `props.spec` (via `/examples/color-mode`) uses colour mode (verified with grep).

### 8. Docs

- **CHANGELOG 0.4.0 entries.** Angular: `forceColorMode`, the `colorMode` removal, the default now following the system, the `@layer`, the new export paths, `xy-theme.css`, and the default token values. System: `ColorMode` narrowed, `ColorModeClass` removed, the CSS.
- **Migration guide snippets:**
  - `[colorMode]="'dark'"` becomes `[forceColorMode]="'dark'"`;
  - `'system'` means omitting the input;
  - an app that relied on the old `'light'` default sets `forceColorMode="light"` or `<html data-theme="light">`;
  - CSS overrides that only beat angflow by specificity or order still win, and now win more reliably, because unlayered CSS beats `@layer xyflow`;
  - an app that put angflow CSS in its own layer must order the layers;
  - to keep the old edge look, set `--xy-edge-stroke: #999; --xy-edge-stroke-width: 1.5;` and the connection-line equivalents;
  - browser floor: `light-dark()` needs Chrome/Edge 123, Firefox 120, Safari 17.5.
- **README theming section.**
- **Report:** §3 colour-mode and `@layer` rows marked D2 ✓ with SHAs, and a D2 results section.
- The docs comment at the top of `ng-flow.css` (which mentions a non-existent `styles/ng-flow.css` export) is fixed or removed.

## Testing bar

- Failing test first per item: host-class unit tests for `forceColorMode`, the CSS build test, and the e2e entries removed.
- Final checkpoint:
  - typecheck, lint and vitest in all packages;
  - both example builds;
  - e2e verdict with 0 known failures, 0 STALE;
  - drift check;
  - verbatim paths untouched;
  - codespell;
  - `git diff HEAD upstream/main -- packages/system/src/styles` empty or justified.

## Out of scope

- NodeChangeset (D3).
- Feature parity and the deferred bugs (E).
- The `@angflow/ui` components (F).
- An angflow brand palette.
- Agent chat dark mode.

## Risks

- **Cascade shift.** Moving into a layer lowers angflow's precedence everywhere. A rule angflow used to win with by order, against an app's unlayered rule of lower specificity, now loses. That's the intended upstream behaviour, and the migration guide covers it.
- **Example app chrome.** The examples shell may style itself for light only. Setting `data-theme` on `<html>` from the color-mode page only affects `.xy-flow` descendants through the system selectors, and the page cleans up on destroy.
- **Hand-port drift.** If a style commit doesn't apply, the end-state diff check catches anything missed.

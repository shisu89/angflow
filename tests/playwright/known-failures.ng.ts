/**
 * Upstream e2e tests that are known to fail against `examples/angular` (FRAMEWORK=ng).
 *
 * `playwright.angular.config.ts` excludes these from the blocking `chromium` project
 * (`grepInvert`) and runs them in the non-blocking `ng-known-failures` project (`grep`).
 * `check-known-failures.mjs` then flags entries that no longer match a test, match the
 * wrong file, or have started passing.
 *
 * Owners map to the roadmap in docs/reviews/2026-11-24-upstream-sync.md §5:
 * B = bug fix, C = deletion semantics, D = upstream 1.0 / React 13 API, E = missing feature.
 * Never edit a spec to make it pass; fix the library (or the examples-app page) and
 * delete the entry.
 */

export type KnownFailureOwner = 'B' | 'C' | 'D' | 'E' | 'flaky-upstream' | 'wontfix';

export interface KnownFailure {
  /** Spec file relative to `e2e/`, e.g. 'pane.spec.ts'. */
  file: string;
  /** Describe titles..., test title — exactly as Playwright reports them. */
  titlePath: string[];
  /** One sentence: observed failure + suspected cause. */
  reason: string;
  owner: KnownFailureOwner;
  /** Required when owner === 'wontfix'. */
  justification?: string;
}

const EDGE_LABEL =
  'HTML edge labels render as `.xy-flow__edge-label[data-id]` siblings outside the edge `<g>` ' +
  '(edge-renderer.component.ts:296), so';

export const KNOWN_FAILURES: KnownFailure[] = [
  // ── background.spec.ts ────────────────────────────────────────────────────
  {
    file: 'background.spec.ts',
    titlePath: ['Background', 'centers the dot pattern with default gap and no offset (zoom 1, pan 0,0)'],
    reason:
      '`#pattern-flow-a0` is missing: angflow uses the Background `id` verbatim (upstream `pattern-<flowId><id>`), ' +
      'so four flows on one page share pattern id "0", and it sets x/y instead of a half-gap `patternTransform`.',
    owner: 'B',
  },
  {
    file: 'background.spec.ts',
    titlePath: ['Background', 'applies both the offset and the half-cell centering for a non-zero offset'],
    reason:
      '`#pattern-flow-d1` is missing: same Background pattern-id scheme divergence, and no ' +
      '`patternTransform` (offset + half gap) is rendered.',
    owner: 'B',
  },

  // ── click-connect.spec.ts ─────────────────────────────────────────────────
  {
    file: 'click-connect.spec.ts',
    titlePath: ['Click connections', 'pane click cancels a pending connection (click-connect)'],
    reason:
      'A pane click cancels the pending click connection without emitting `clickConnectEnd` (report §2); ' +
      'the end-state payload is also missing (D).',
    owner: 'B',
  },
  {
    file: 'click-connect.spec.ts',
    titlePath: ['Click connections', 'pane click cancels a pending connection (click-connect-selection)'],
    reason:
      'A pane click cancels the pending click connection without emitting `clickConnectEnd` (report §2); ' +
      'the end-state payload is also missing (D).',
    owner: 'B',
  },
  {
    file: 'click-connect.spec.ts',
    titlePath: ['Click connections', 'dragging a selection does not cancel a pending click connection'],
    reason:
      'The click synthesised after a marquee drag reaches `onPaneClick`, which clears ' +
      '`connectionClickStartHandle` before its `selectionInProgress` guard, so the target click starts a new ' +
      'connection instead of completing it (new bug).',
    owner: 'B',
  },
  {
    file: 'click-connect.spec.ts',
    titlePath: ['Click connections', 'dropping a dragged connection on the pane does not fire pane click'],
    reason:
      'The connection line `<g>` has no `ng-flow__connection` (or valid/invalid status) class, unlike upstream ' +
      '(new bug); behind it, `(paneClick)` fires when a connection drag ends on the pane (report §2).',
    owner: 'B',
  },

  // ── edges.spec.ts ─────────────────────────────────────────────────────────
  {
    file: 'edges.spec.ts',
    titlePath: ['Edges', 'properties', 'animated=true add "animated" class'],
    reason: `${EDGE_LABEL} \`[data-id="animated-edge"]\` resolves to 2 elements (strict-mode violation; new bug).`,
    owner: 'B',
  },
  {
    file: 'edges.spec.ts',
    titlePath: ['Edges', 'properties', 'selectable=false prevents selecting of edges'],
    reason: `${EDGE_LABEL} \`[data-id="not-selectable-edge"]\` resolves to 2 elements (strict-mode violation; new bug).`,
    owner: 'B',
  },
  {
    file: 'edges.spec.ts',
    titlePath: ['Edges', 'properties', 'deletable=false prevents deleting of edges'],
    reason:
      `${EDGE_LABEL} the locator is ambiguous, and the label (pointer-events: all) covers the edge centre ` +
      'without selecting the edge; with both neutralised the test passes (former in-spec skip; not hit-test fragility).',
    owner: 'B',
  },
  {
    file: 'edges.spec.ts',
    titlePath: ['Edges', 'properties', 'aria-lable is working'],
    reason: `${EDGE_LABEL} \`[data-id="aria-label"]\` resolves to 2 elements (strict-mode violation; new bug).`,
    owner: 'B',
  },
  {
    file: 'edges.spec.ts',
    titlePath: ['Edges', 'properties', 'interactionWidth is working'],
    reason:
      `${EDGE_LABEL} the locator is ambiguous, and the click at centre+21px lands on the label div, which upstream ` +
      'renders inside the edge (former in-spec skip; not hit-test fragility).',
    owner: 'B',
  },
  {
    file: 'edges.spec.ts',
    titlePath: [
      'elevate edges on select for overlapping reconnect anchors',
      'selected edge gets elevated z-index above non-selected overlapping edge',
    ],
    reason:
      'The selected edge svg keeps z-index 0 instead of 1000: `elevateEdgesOnSelect` is a no-op and defaults ' +
      'to false (report §2).',
    owner: 'B',
  },

  // ── nodes.spec.ts ─────────────────────────────────────────────────────────
  {
    file: 'nodes.spec.ts',
    titlePath: ['Nodes', 'keyboard', 'moving a selected node with arrow keys announces its new position'],
    reason:
      'No `[id^="ng-flow__aria-live"]` element: the aria-live region has no such id and `ariaLiveMessage` ' +
      'is never written on arrow-key moves (report §2).',
    owner: 'B',
  },

  // ── pane.spec.ts ──────────────────────────────────────────────────────────
  {
    file: 'pane.spec.ts',
    titlePath: [
      'Pane non-default',
      'pan & zoom',
      'touch input',
      'touch drag pans when primary mouse drag is reserved for selection',
    ],
    reason:
      'Touch drag starts a marquee instead of panning with panOnDrag=[1,2] + selectionOnDrag ' +
      '(deliberate divergence in pane.component.ts; upstream 12.11.3 fix, react appendix row #48).',
    owner: 'B',
  },
  {
    file: 'pane.spec.ts',
    titlePath: ['Pane non-default', 'pan & zoom', 'touch input', 'selection key keeps touch drag in selection mode'],
    reason:
      'The pane gets the `selection` class only while a marquee is active (`userSelectionActive`), not when ' +
      'selecting is enabled (selection key held or selectionOnDrag) as upstream `isSelecting` does (new bug).',
    owner: 'B',
  },

  // ── props.spec.ts ─────────────────────────────────────────────────────────
  {
    file: 'props.spec.ts',
    titlePath: ['Props', 'colorMode', 'render dark page theme via html data-theme'],
    reason:
      'Times out on `colormode-select`: the flow does not follow the page theme and the Angular color-mode page ' +
      'lacks the upstream page-theme / force-colour-mode selects, which need `forceColorMode` (report §3).',
    owner: 'D',
  },
  {
    file: 'props.spec.ts',
    titlePath: ['Props', 'colorMode', 'forceColorMode overrides the page theme'],
    reason:
      'Times out on `colormode-select`: angflow has `colorMode` but no `forceColorMode`, and the color-mode ' +
      'page lacks the upstream testids (report §3).',
    owner: 'D',
  },

  // ── reconnect-edge.spec.ts ────────────────────────────────────────────────
  {
    file: 'reconnect-edge.spec.ts',
    titlePath: ['reconnectEdge', 'replaces the id with getEdgeId when shouldReplaceId is omitted'],
    reason: 'System `reconnectEdge` ignores `options.getEdgeId` and keeps "old-edge" (report §1, #6055).',
    owner: 'B',
  },
  {
    file: 'reconnect-edge.spec.ts',
    titlePath: ['reconnectEdge', 'replaces the id when only onError is passed'],
    reason: 'System `reconnectEdge` keeps the old id when an options object without `shouldReplaceId` is passed (report §1, #6055).',
    owner: 'B',
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Anchored, regex-escaped pattern over Playwright's grep title.
 *
 * Verified empirically on Playwright 1.65.1 (`TestCase._grepTitle`): the string is
 * `<project name> <file relative to testDir> <describe titles...> <test title> <@tags...>`,
 * space-joined, for both config-level `grep`/`grepInvert` and CLI `--grep`. The project
 * name differs per project (chromium, ng-known-failures, …), so it is matched as `\S+`.
 */
export function toGrep(f: KnownFailure): RegExp {
  return new RegExp(`^\\S+ ${escapeRegExp(f.file)} ${escapeRegExp(f.titlePath.join(' '))}(?: @\\S+)*$`);
}

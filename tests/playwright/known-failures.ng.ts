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

export const KNOWN_FAILURES: KnownFailure[] = [
  // ── edges.spec.ts ─────────────────────────────────────────────────────────

  // ── nodes.spec.ts ─────────────────────────────────────────────────────────

  // ── props.spec.ts ─────────────────────────────────────────────────────────
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

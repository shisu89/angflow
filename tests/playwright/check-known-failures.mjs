#!/usr/bin/env node
// Verdict for the Angular e2e run, from Playwright's JSON report.
//
//   node check-known-failures.mjs [path/to/report.json]   (default: test-results/report.json)
//
// The known-failure entries are read from the report itself: playwright.angular.config.ts
// puts them in the `ng-known-failures` project's metadata. Locally, produce a report with
//   PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/report.json FRAMEWORK=ng pnpm exec playwright test \
//     -c playwright.angular.config.ts --project=chromium --project=ng-known-failures --reporter=list,json
//
// Sections (exit 1 if NOT MATCHED or WRONG FILE is non-empty, or any chromium test failed):
//   NOT MATCHED          an entry with zero matching tests in project ng-known-failures
//   WRONG FILE           an entry whose title path only exists in a different file
//   STALE (now passing)  a known failure that passed — informational, remove the entry
// plus the blocking chromium project's unexpected results (flaky ones are listed, not fatal).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.resolve(process.argv[2] ?? path.join(here, 'test-results/report.json'));
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const KNOWN_PROJECT = 'ng-known-failures';
const BLOCKING_PROJECT = 'chromium';

/** Flatten suites → specs → tests into { project, file, titlePath, status }. */
const tests = [];
function walk(suite, titlePath, isFileSuite) {
  const next = isFileSuite ? titlePath : [...titlePath, suite.title];
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      tests.push({ project: test.projectName, file: spec.file, titlePath: [...next, spec.title], status: test.status });
    }
  }
  for (const child of suite.suites ?? []) walk(child, next, false);
}
for (const fileSuite of report.suites ?? []) walk(fileSuite, [], true);

const knownProject = (report.config?.projects ?? []).find((p) => p.name === KNOWN_PROJECT);
const entries = knownProject?.metadata?.knownFailures ?? [];
const ranKnownProject = tests.some((t) => t.project === KNOWN_PROJECT);

const sameTitle = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
const label = (e) => `${e.file} › ${e.titlePath.join(' › ')}`;

const notMatched = [];
const wrongFile = [];
const stale = [];

if (entries.length && !ranKnownProject) {
  notMatched.push(`project ${KNOWN_PROJECT} did not run: pass --project=${KNOWN_PROJECT}`);
} else {
  for (const entry of entries) {
    const matches = tests.filter(
      (t) => t.project === KNOWN_PROJECT && t.file === entry.file && sameTitle(t.titlePath, entry.titlePath),
    );
    if (matches.length) {
      if (matches.every((t) => t.status === 'expected')) stale.push(`${label(entry)}  [owner ${entry.owner}]`);
      continue;
    }
    const elsewhere = [...new Set(tests.filter((t) => sameTitle(t.titlePath, entry.titlePath)).map((t) => t.file))];
    if (elsewhere.length) wrongFile.push(`${label(entry)}  → reported in ${elsewhere.join(', ')}`);
    else notMatched.push(label(entry));
  }
}

const describeTest = (t) => `${t.file} › ${t.titlePath.join(' › ')}`;
const blockingFailures = tests.filter((t) => t.project === BLOCKING_PROJECT && t.status === 'unexpected').map(describeTest);
const blockingFlaky = tests.filter((t) => t.project === BLOCKING_PROJECT && t.status === 'flaky').map(describeTest);

function section(title, lines) {
  console.log(`${title}: ${lines.length}`);
  for (const line of lines) console.log(`  - ${line}`);
}

const shownPath = path.relative(process.cwd(), reportPath);
console.log(`known failures: ${entries.length} entries, report ${shownPath.startsWith('..') ? reportPath : shownPath}`);
section('NOT MATCHED', notMatched);
section('WRONG FILE', wrongFile);
section('STALE (now passing)', stale);
section(`${BLOCKING_PROJECT} failures`, blockingFailures);
if (blockingFlaky.length) section(`${BLOCKING_PROJECT} flaky (passed on retry, informational)`, blockingFlaky);

const failed = notMatched.length > 0 || wrongFile.length > 0 || blockingFailures.length > 0;
console.log(failed ? 'verdict: FAIL' : 'verdict: OK');
process.exit(failed ? 1 : 0);

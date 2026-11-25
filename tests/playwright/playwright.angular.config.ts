import { defineConfig, devices, type Project } from '@playwright/test';
import { sharedConfigWithPort } from './playwright.shared.config';
import { KNOWN_FAILURES, toGrep } from './known-failures.ng';
import path from 'path';

const config = sharedConfigWithPort({ port: 4201, framework: 'ng' });

// Override webServer cwd — pnpm --filter needs to run from the monorepo root
config.webServer = {
  ...config.webServer,
  command: 'pnpm --filter=angular-examples run dev --port 4201',
  cwd: path.resolve(__dirname, '../..'),
};

// An empty grepInvert is omitted so the chromium project runs everything.
const knownFailurePatterns = KNOWN_FAILURES.map(toGrep);
const excludeKnown = knownFailurePatterns.length ? { grepInvert: knownFailurePatterns } : {};
const sharedProject = (name: string): Project | undefined => config.projects?.find((p) => p.name === name);

config.projects = [
  // Blocking run: every upstream test except the known failures.
  { name: 'chromium', use: { ...devices['Desktop Chrome'] }, ...excludeKnown },
  // Non-blocking: only the known failures. The entries travel in `metadata` so
  // check-known-failures.mjs can verify them from the JSON report alone.
  {
    name: 'ng-known-failures',
    use: { ...devices['Desktop Chrome'] },
    // Always defined so the project list is stable; with no entries the never-matching
    // grep selects zero tests.
    grep: knownFailurePatterns.length ? knownFailurePatterns : /$^/,
    retries: 0,
    metadata: { knownFailures: KNOWN_FAILURES },
  },
  // Local use only; CI runs chromium + ng-known-failures.
  { ...sharedProject('firefox'), name: 'firefox', ...excludeKnown },
  { ...sharedProject('webkit'), name: 'webkit', ...excludeKnown },
];

if (process.env.CI) {
  config.reporter = [['dot'], ['json', { outputFile: 'test-results/report.json' }], ['html', { open: 'never' }]];
}

export default defineConfig(config);

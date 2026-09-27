/**
 * Build-time schema snapshot.
 *
 * Imports AGENT_TOOL_SCHEMAS from the workspace's angular SOURCE (the file is
 * dependency-free — no Angular imports) and emits a committed TypeScript
 * module so @angflow/mcp has zero runtime dependency on @angflow/angular.
 * Run via `npm run generate:schemas` (tsx). With `--check` (used by
 * `npm run build`) it writes nothing and exits 1 when the committed snapshot's
 * schemas differ from the workspace source — so a stale snapshot fails the
 * build and CI instead of being silently regenerated before the drift test.
 * The version stamp is ignored by the check (an angular version bump alone
 * doesn't change the catalog).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_TOOL_SCHEMAS } from '../../angular/src/lib/agent/tool-schemas';

const here = dirname(fileURLToPath(import.meta.url));
const angularPkg = JSON.parse(
  readFileSync(join(here, '../../angular/package.json'), 'utf8'),
) as { version: string };

const outDir = join(here, '../src/generated');
const outFile = join(outDir, 'tool-schemas.ts');

const banner = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Snapshot of AGENT_TOOL_SCHEMAS from @angflow/angular@${angularPkg.version}.
 * Regenerate with \`npm run generate:schemas\`. \`npm run build\` and the
 * drift test in test/schema-snapshot.spec.ts fail while this file is stale.
 */
`;

const body = `export interface AgentToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export const GENERATED_FROM_ANGULAR_VERSION = ${JSON.stringify(angularPkg.version)};

export const AGENT_TOOL_SCHEMAS: AgentToolSchema[] = ${JSON.stringify(AGENT_TOOL_SCHEMAS, null, 2)};
`;

/** Drop the version-stamp lines so a pure version bump isn't reported as drift. */
const withoutStamp = (text: string): string =>
  text
    .split('\n')
    .filter((l) => !l.includes('Snapshot of AGENT_TOOL_SCHEMAS from') && !l.startsWith('export const GENERATED_FROM_ANGULAR_VERSION'))
    .join('\n');

if (process.argv.includes('--check')) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  if (withoutStamp(current) !== withoutStamp(banner + body)) {
    // eslint-disable-next-line no-console
    console.error(
      '[generate-schemas] src/generated/tool-schemas.ts is stale: AGENT_TOOL_SCHEMAS changed in @angflow/angular.\n' +
        '[generate-schemas] run `pnpm -F @angflow/mcp run generate:schemas` and commit the result.',
    );
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error(`[generate-schemas] snapshot up to date (${AGENT_TOOL_SCHEMAS.length} tools)`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, banner + body, 'utf8');
// eslint-disable-next-line no-console
console.error(
  `[generate-schemas] wrote ${AGENT_TOOL_SCHEMAS.length} tool schemas (from @angflow/angular@${angularPkg.version})`,
);

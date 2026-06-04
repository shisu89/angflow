/**
 * Build-time schema snapshot.
 *
 * Imports AGENT_TOOL_SCHEMAS from the workspace's angular SOURCE (the file is
 * dependency-free — no Angular imports) and emits a committed TypeScript
 * module so @angflow/mcp has zero runtime dependency on @angflow/angular.
 * Run via `npm run generate:schemas` (tsx). The drift test in
 * test/schema-snapshot.spec.ts fails whenever the catalog changes without
 * regenerating.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
 * Regenerate with \`npm run generate:schemas\` (runs automatically in
 * \`npm run build\`). The drift test in test/schema-snapshot.spec.ts compares
 * this file against the workspace source.
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

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, banner + body, 'utf8');
// eslint-disable-next-line no-console
console.error(
  `[generate-schemas] wrote ${AGENT_TOOL_SCHEMAS.length} tool schemas (from @angflow/angular@${angularPkg.version})`,
);

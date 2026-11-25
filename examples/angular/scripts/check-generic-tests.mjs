#!/usr/bin/env node
// Drift check between upstream's generic-test configs (the committed React
// reference copy) and the Angular registry/overrides.
//   node scripts/check-generic-tests.mjs
// Testing hook: GENERIC_TESTS_UPSTREAM_DIR=<abs or repo-relative dir> scans that
// directory (plain filesystem walk) instead of examples/react/src/generic-tests.
// Registry import paths are still validated against the canonical directory.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let cwd = dirname(fileURLToPath(import.meta.url)); // script dir: independent of caller cwd
const git = (...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const ROOT = git('rev-parse', '--show-toplevel');
cwd = ROOT;
const CANON_DIR = 'examples/react/src/generic-tests';
const envDir = process.env.GENERIC_TESTS_UPSTREAM_DIR;
const UPSTREAM_DIR = envDir ? relative(ROOT, resolve(ROOT, envDir)).split(sep).join('/') : CANON_DIR;
const GT = join(ROOT, 'examples/angular/src/app/generic-tests');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const errors = [];
const fail = (m) => errors.push(m);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// 1. Upstream keys.
const files = envDir
  ? walk(join(ROOT, UPSTREAM_DIR)).map((p) => relative(ROOT, p).split(sep).join('/'))
  : git('ls-files', UPSTREAM_DIR).split('\n').filter(Boolean);
const upstream = new Map(); // key -> repo-relative path
for (const f of files) {
  const rel = f.slice(UPSTREAM_DIR.length + 1);
  if (!rel.endsWith('.ts') || rel.split('/').includes('components')) continue;
  upstream.set(rel.slice(0, -3), f);
}

// 2. Registry.
const registry = read(join(GT, 'registry.ts'));
function block(name) {
  const m = registry.match(new RegExp(`export const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!m) { fail(`registry.ts: could not find ${name} object literal`); return ''; }
  return m[1];
}
const keysOf = (b) => [...b.matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]);
const dataKeys = keysOf(block('DATA_ONLY'));
const overrideKeys = keysOf(block('OVERRIDES'));
const registered = new Set([...dataKeys, ...overrideKeys]);

for (const k of upstream.keys())
  if (!registered.has(k)) fail(`new upstream test page ${k}: add it to DATA_ONLY, or create an override`);
for (const k of registered)
  if (!upstream.has(k)) fail(`upstream removed ${k}: delete it from the registry`);

// DATA_ONLY import paths must resolve to the file for their key.
const importByIdent = new Map(
  [...registry.matchAll(/^import\s+(\w+)\s+from\s+'([^']+)';/gm)].map((m) => [m[1], m[2]]),
);
for (const m of block('DATA_ONLY').matchAll(/^\s*'([^']+)'\s*:\s*(\w+)/gm)) {
  const [, key, ident] = m;
  const spec = importByIdent.get(ident);
  if (!spec) { fail(`DATA_ONLY ${key}: no import found for ${ident}`); continue; }
  const target = relative(ROOT, resolve(GT, spec)).split(sep).join('/');
  if (target !== `${CANON_DIR}/${key}`)
    fail(`DATA_ONLY ${key}: import '${spec}' resolves to ${target}, expected ${CANON_DIR}/${key}`);
}

// 3. Override pins.
for (const f of walk(join(GT, 'overrides')).filter((p) => p.endsWith('.ts'))) {
  const rel = relative(GT, f).split(sep).join('/');
  if (rel.split('/').includes('components')) continue;
  const first = read(f).split('\n')[0];
  const m = first.match(/^\/\/ upstream:\s*(\S+)\s+@\s+([0-9a-f]{40})\s*$/);
  if (!m) { fail(`${rel}: missing or malformed line-1 header (// upstream: <path> @ <blob>)`); continue; }
  const [, path, blob] = m;
  let current;
  try { current = git('rev-parse', `HEAD:${path}`); }
  catch { fail(`${rel}: upstream file ${path} not found at HEAD`); continue; }
  if (current !== blob)
    fail(`upstream changed ${path}: re-sync the override data and update the pin to ${current}`);
}

// 4. Upstream config scans.
const adapterSrc = read(join(GT, 'flow-props.ts'));
const adapterBlock = adapterSrc.match(/OUTPUT_ADAPTERS[^=]*=\s*\{([\s\S]*?)\n\};/);
const adapters = new Set(adapterBlock ? [...adapterBlock[1].matchAll(/^\s{2}(on[A-Z]\w*)\s*:/gm)].map((m) => m[1]) : []);
if (!adapterBlock) fail('flow-props.ts: could not find OUTPUT_ADAPTERS');
const shimSrc = read(join(GT, 'xyflow-react-shim.ts'));
const shimExports = new Set();
for (const m of shimSrc.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g))
  for (const n of m[1].split(',')) {
    const name = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
    if (name) shimExports.add(name);
  }

for (const [key, path] of upstream) {
  const src = read(join(ROOT, path));
  for (const m of src.matchAll(/^  (controlsProps|panelProps|minimapProps|backgroundProps)\s*:/gm))
    fail(`${key} uses ${m[1]}: the generic host doesn't render plugin children yet (see spec §2a)`);
  for (const m of src.matchAll(/^\s{4}(on[A-Z]\w*):/gm))
    if (!adapters.has(m[1]))
      fail(`${key} uses ${m[1]}: no entry in OUTPUT_ADAPTERS (flow-props.ts)`);
  if (dataKeys.includes(key))
    for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@xyflow\/react'/g))
      for (const n of m[1].split(',')) {
        const name = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
        if (name && !shimExports.has(name))
          fail(`${key} imports ${name} from @xyflow/react: not exported by xyflow-react-shim.ts`);
      }
}

if (errors.length) {
  console.error(errors.map((e) => `generic-tests: ${e}`).join('\n'));
  process.exit(1);
}
console.log(`generic-tests: ${upstream.size} configs in sync`);

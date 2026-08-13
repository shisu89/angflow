/**
 * Guards against publishing an unsubstituted `workspace:` protocol.
 *
 * `@angflow/system` is declared as a `workspace:^` dependency so the monorepo
 * links it locally. Only pnpm rewrites that specifier to a real semver range
 * when packing; npm ships the literal string, producing a tarball that fails
 * every clean install with ERR_PNPM_WORKSPACE_PKG_NOT_FOUND. That is exactly
 * how 0.3.18 shipped broken.
 *
 * Runs as `prepack`, so it fires for both `pack` and `publish` — before the
 * tarball is uploaded, not after.
 */
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// devDependencies are excluded: consumers never install them, so a literal
// `workspace:*` there is inert.
const consumerFacing = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const offenders = consumerFacing.flatMap((field) =>
  Object.entries(pkg[field] ?? {})
    .filter(([, spec]) => typeof spec === 'string' && spec.startsWith('workspace:'))
    .map(([name, spec]) => `  ${field}.${name} = "${spec}"`),
);

if (offenders.length === 0) {
  process.exit(0);
}

const userAgent = process.env.npm_config_user_agent ?? '';

if (userAgent.startsWith('pnpm/')) {
  process.exit(0);
}

console.error(
  [
    '',
    `Refusing to pack ${pkg.name}: workspace protocol would ship verbatim.`,
    '',
    ...offenders,
    '',
    `Packed by: ${userAgent || '<unknown>'} — only pnpm substitutes these specifiers.`,
    '',
    'Use pnpm instead:',
    '  pnpm publish --access public',
    '  pnpm pack',
    '',
  ].join('\n'),
);

process.exit(1);

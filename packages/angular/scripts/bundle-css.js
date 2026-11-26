/**
 * Bundles CSS files for @angflow/angular dist output.
 *
 * Runs each entry in src/lib/styles through the same postcss plugins upstream
 * xyflow uses: postcss-import (inlines @import, honouring `layer()`),
 * postcss-nested (flattens `&` nesting) and autoprefixer.
 *
 * Output: dist/base.css (structural), dist/style.css (structural + theme) and
 * dist/xy-theme.css (structural + upstream's full optional theme),
 * every rule inside `@layer xyflow`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssNested from 'postcss-nested';
import autoprefixer from 'autoprefixer';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES = ['base', 'style', 'xy-theme'];

export async function bundleCss(outDir = resolve(pkgRoot, 'dist')) {
  await mkdir(outDir, { recursive: true });
  const processor = postcss([postcssImport(), postcssNested(), autoprefixer()]);
  for (const entry of ENTRIES) {
    const from = resolve(pkgRoot, 'src/lib/styles', `${entry}.css`);
    const to = resolve(outDir, `${entry}.css`);
    const result = await processor.process(await readFile(from, 'utf-8'), { from, to });
    await writeFile(to, result.css, 'utf-8');
  }
  console.log('CSS bundled: dist/style.css, dist/base.css, dist/xy-theme.css');
}

// Run when invoked directly (realpath, so a symlinked path to this script still runs it), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await bundleCss();

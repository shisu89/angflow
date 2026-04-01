/**
 * Bundles CSS files for @xyflow/angular dist output.
 *
 * Resolves @import statements relative to each file's directory,
 * inlines imported content, and deduplicates files already included.
 *
 * Output: dist/style.css (base styles + theme + Angular overrides)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

const included = new Set();

function resolveImports(filePath) {
  if (included.has(filePath)) return '';
  included.add(filePath);

  const content = readFileSync(filePath, 'utf-8');
  const dir = dirname(filePath);

  // Strip block comments before resolving imports to avoid matching @import in comments
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');

  // Collect actual @import paths from comment-free content
  const importPaths = [];
  stripped.replace(/^@import\s+['"]([^'"]+)['"]\s*;/gm, (match, importPath) => {
    importPaths.push(importPath);
    return match;
  });

  // Replace imports in original content (preserving comments for readability)
  let result = content;
  for (const importPath of importPaths) {
    const resolved = resolve(dir, importPath);
    const importRegex = new RegExp(`@import\\s+['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*;`);
    result = result.replace(importRegex, resolveImports(resolved));
  }
  return result;
}

// Bundle style.css (theme version — includes init + style + node-resizer + Angular overrides)
// This matches React Flow's dist/style.css convention
const styleCss = resolve(pkgRoot, 'src/lib/styles/style.css');
const ngFlowCss = resolve(pkgRoot, 'src/lib/styles/ng-flow.css');

let output = '';
output += resolveImports(styleCss);
output += '\n';
output += resolveImports(ngFlowCss);

mkdirSync(resolve(pkgRoot, 'dist'), { recursive: true });
writeFileSync(resolve(pkgRoot, 'dist/style.css'), output, 'utf-8');

// Also bundle base.css (minimal version without theme)
included.clear();
const baseCss = resolve(pkgRoot, 'src/lib/styles/base.css');

let baseOutput = '';
baseOutput += resolveImports(baseCss);
baseOutput += '\n';
// Reset included set to allow ng-flow.css imports that weren't in base
included.clear();
// Re-add what base already pulled in
resolveImports(baseCss);
baseOutput += resolveImports(ngFlowCss);

writeFileSync(resolve(pkgRoot, 'dist/base.css'), baseOutput, 'utf-8');

console.log('CSS bundled: dist/style.css, dist/base.css');

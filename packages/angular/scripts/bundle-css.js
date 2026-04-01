/**
 * Bundles CSS files for @xyflow/angular dist output.
 *
 * Resolves @import statements relative to each file's directory,
 * inlines imported content, deduplicates files already included,
 * and flattens SASS-style &-suffix nesting into valid native CSS.
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

/**
 * Flatten SASS-style &-suffix nesting into valid native CSS.
 *
 * Converts patterns like:
 *   .xy-flow__handle {
 *     &-bottom { ... }
 *   }
 * Into:
 *   .xy-flow__handle { }
 *   .xy-flow__handle-bottom { ... }
 *
 * Also handles:
 *   .xy-flow__controls {
 *     &.horizontal &-button { ... }
 *   }
 */
function flattenNesting(css) {
  const output = [];
  let i = 0;

  while (i < css.length) {
    // Find a rule block: selector { ... }
    const ruleStart = css.indexOf('{', i);
    if (ruleStart === -1) {
      output.push(css.slice(i));
      break;
    }

    // Extract the parent selector
    const selectorText = css.slice(i, ruleStart).trim();
    // Find matching closing brace
    let depth = 1;
    let j = ruleStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }

    const blockContent = css.slice(ruleStart + 1, j - 1);

    // Check if this block contains &-suffix nested rules
    if (blockContent.includes('&-') || blockContent.includes('& ')) {
      // Parse nested rules out of this block
      const { properties, nestedRules } = parseNestedBlock(blockContent, selectorText);

      // Write parent rule with its own properties
      if (properties.trim()) {
        output.push(`${selectorText} {\n${properties}}\n`);
      }

      // Write flattened nested rules
      for (const { selector, body } of nestedRules) {
        output.push(`${selector} {\n${body}}\n`);
      }
    } else {
      // No nesting, pass through
      output.push(css.slice(i, j));
    }

    i = j;
  }

  return output.join('\n');
}

function parseNestedBlock(block, parentSelector) {
  let properties = '';
  const nestedRules = [];
  let i = 0;

  while (i < block.length) {
    // Look for &-suffix or &. patterns indicating nested rules
    const ampIdx = block.indexOf('&', i);

    if (ampIdx === -1) {
      properties += block.slice(i);
      break;
    }

    // Check if this & starts a nested selector (preceded by whitespace/newline or start)
    const before = block.slice(i, ampIdx);
    const lineStart = before.lastIndexOf('\n');
    const linePrefix = lineStart === -1 ? before : before.slice(lineStart + 1);

    // If the prefix is only whitespace, this is a nested rule
    if (linePrefix.trim() === '') {
      properties += before.slice(0, lineStart === -1 ? 0 : lineStart + 1);

      // Find the opening brace
      const braceStart = block.indexOf('{', ampIdx);
      if (braceStart === -1) {
        properties += block.slice(ampIdx);
        break;
      }

      const nestedSelector = block.slice(ampIdx, braceStart).trim();

      // Find matching close
      let depth = 1;
      let j = braceStart + 1;
      while (j < block.length && depth > 0) {
        if (block[j] === '{') depth++;
        else if (block[j] === '}') depth--;
        j++;
      }

      const body = block.slice(braceStart + 1, j - 1);

      // Resolve the selector: replace & with parent
      let resolved = nestedSelector.replace(/&/g, parentSelector);
      // Handle cases like ".parent &-suffix" where & is inside a compound selector
      // e.g., "&.horizontal &-button" -> ".parent.horizontal .parent-button"
      // This is already handled by the global replace above

      nestedRules.push({ selector: resolved, body });
      i = ampIdx + (j - ampIdx);
    } else {
      // This & is inside a property value, not a selector
      properties += block.slice(i, ampIdx + 1);
      i = ampIdx + 1;
    }
  }

  return { properties, nestedRules };
}

// Bundle style.css (theme version — includes init + style + node-resizer + Angular overrides)
const styleCss = resolve(pkgRoot, 'src/lib/styles/style.css');
const ngFlowCss = resolve(pkgRoot, 'src/lib/styles/ng-flow.css');

let output = '';
output += resolveImports(styleCss);
output += '\n';
output += resolveImports(ngFlowCss);

output = flattenNesting(output);

mkdirSync(resolve(pkgRoot, 'dist'), { recursive: true });
writeFileSync(resolve(pkgRoot, 'dist/style.css'), output, 'utf-8');

// Also bundle base.css (minimal version without theme)
included.clear();
const baseCss = resolve(pkgRoot, 'src/lib/styles/base.css');

let baseOutput = '';
baseOutput += resolveImports(baseCss);
baseOutput += '\n';
included.clear();
resolveImports(baseCss);
baseOutput += resolveImports(ngFlowCss);

baseOutput = flattenNesting(baseOutput);

writeFileSync(resolve(pkgRoot, 'dist/base.css'), baseOutput, 'utf-8');

console.log('CSS bundled: dist/style.css, dist/base.css');

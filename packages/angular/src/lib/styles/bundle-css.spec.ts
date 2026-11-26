// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss, { type Root, type Rule } from 'postcss';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleCss } from '../../../scripts/bundle-css.js';

const ENTRIES = ['style', 'base', 'xy-theme'] as const;
const SYSTEM_STYLES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../system/src/styles');

const CURSOR_SELECTORS = [
  ['.xy-flow__pane.draggable::before', 'grab'],
  ['.xy-flow__node.draggable', 'grab'],
  ['.xy-flow__pane.dragging::before', 'grabbing'],
  ['.xy-flow__node.draggable.dragging', 'grabbing'],
  ['.xy-flow__handle.connectionindicator', 'crosshair'],
] as const;
type Entry = (typeof ENTRIES)[number];

let outDir: string;
const roots = {} as Record<Entry, Root>;
const sources = {} as Record<Entry, string>;

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'angflow-bundle-css-'));
  await bundleCss(outDir);
  for (const entry of ENTRIES) {
    sources[entry] = await readFile(join(outDir, `${entry}.css`), 'utf-8');
    roots[entry] = postcss.parse(sources[entry], { from: `${entry}.css` });
  }
  // Returned teardown runs once the file's tests finish.
  return () => rm(outDir, { recursive: true, force: true });
});

function svgCursors(root: Root, selector: string): string[] {
  return declValues(root, selector, 'cursor').filter((value) => value.startsWith('url("data:image/svg+xml'));
}

/** Every custom-property declaration in `root`, as `prop: value`. */
function customProps(root: Root): string[] {
  const found: string[] = [];
  root.walkDecls(/^--/, (decl) => {
    found.push(`${decl.prop}: ${decl.value}`);
  });
  return found;
}

function rulesFor(root: Root, selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) found.push(rule);
  });
  return found;
}

function declValues(root: Root, selector: string, prop: string): string[] {
  return rulesFor(root, selector).flatMap((rule) =>
    rule.nodes.filter((n) => n.type === 'decl' && n.prop === prop).map((n) => (n.type === 'decl' ? n.value : '')),
  );
}

const COMMON_ENTRIES = ['style', 'base'] as const;

describe.each(COMMON_ENTRIES)('bundled %s.css', (entry) => {
  it('puts every top-level node in @layer xyflow', () => {
    const stray = roots[entry].nodes.filter(
      (node) => node.type !== 'comment' && !(node.type === 'atrule' && node.name === 'layer' && node.params === 'xyflow'),
    );
    expect(stray.map((node) => node.toString().slice(0, 80))).toEqual([]);
  });

  it('leaves no @import and no & in any selector', () => {
    const imports: string[] = [];
    roots[entry].walkAtRules('import', (rule) => {
      imports.push(rule.params);
    });
    const nested: string[] = [];
    roots[entry].walkRules((rule) => {
      if (rule.selector.includes('&')) nested.push(rule.selector);
    });
    expect(imports).toEqual([]);
    expect(nested).toEqual([]);
  });

  it('carries the light-dark() tokens', () => {
    expect(sources[entry]).toContain('light-dark(');
  });

  it('contains .xy-flow__pane::before', () => {
    expect(rulesFor(roots[entry], '.xy-flow__pane::before').length).toBeGreaterThan(0);
  });

  it.each(CURSOR_SELECTORS)('has exactly one SVG cursor rule for %s', (selector, fallback) => {
    const cursors = svgCursors(roots[entry], selector);
    expect(cursors).toHaveLength(1);
    expect(cursors[0].endsWith(`, ${fallback}`)).toBe(true);
  });

  it.each([
    '.xy-flow__node-enter',
    '.xy-flow__node.collapsed',
    '.xy-flow__viewport-portal > *',
    '.xy-flow__resize-control',
  ])('keeps the Angular structural rule %s', (selector) => {
    expect(rulesFor(roots[entry], selector).length).toBeGreaterThan(0);
  });

  it('uses system edge-stroke token values (no angflow overrides)', () => {
    expect(declValues(roots[entry], '.xy-flow', '--xy-edge-stroke-default')).toEqual(['light-dark(#b1b1b7, #3e3e3e)']);
  });
});

describe('bundled style.css (Angular rules)', () => {
  it('has the edge-text fill rules on the rendered xy-flow__ classes', () => {
    expect(declValues(roots.style, '.xy-flow__edge-textbg', 'fill')).toEqual([
      'var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default))',
    ]);
    expect(declValues(roots.style, '.xy-flow__edge-text', 'fill')).toEqual([
      'var(--xy-edge-label-color, var(--xy-edge-label-color-default))',
    ]);
    expect(rulesFor(roots.style, '.ng-flow__edge-textbg')).toEqual([]);
    expect(rulesFor(roots.style, '.ng-flow__edge-text')).toEqual([]);
  });

  it('carries the Angular theme rules (ng-flow-theme.css)', () => {
    expect(rulesFor(roots.style, '.xy-flow__node.connection-target').length).toBeGreaterThan(0);
    expect(declValues(roots.style, '.xy-flow__node.selectable:hover', 'box-shadow')).toEqual([
      'var(--xy-node-boxshadow-hover, var(--xy-node-boxshadow-hover-default))',
    ]);
  });
});

describe('bundled base.css (no theme colours)', () => {
  let systemProps: Set<string>;

  beforeAll(async () => {
    systemProps = new Set<string>();
    for (const file of ['init.css', 'base.css', 'node-resizer.css']) {
      const source = await readFile(join(SYSTEM_STYLES, file), 'utf-8');
      for (const prop of customProps(postcss.parse(source, { from: file }))) systemProps.add(prop);
    }
  });

  it('defines only the custom properties the system files define, with their values', () => {
    expect(customProps(roots.base).filter((prop) => !systemProps.has(prop))).toEqual([]);
  });

  it('has light-dark() only on system custom properties', () => {
    const lightDark: string[] = [];
    roots.base.walkDecls((decl) => {
      if (decl.value.includes('light-dark(')) lightDark.push(`${decl.prop}: ${decl.value}`);
    });
    expect(lightDark.length).toBeGreaterThan(0);
    expect(lightDark.filter((decl) => !decl.startsWith('--') || !systemProps.has(decl))).toEqual([]);
  });

  it('has no --xy-theme- token and no .xy-flow.dark colour block', () => {
    expect(sources.base).not.toContain('--xy-theme-');
    const darkDecls = rulesFor(roots.base, '.xy-flow.dark').flatMap((rule) =>
      rule.nodes.flatMap((n) => (n.type === 'decl' ? [n.prop] : [])),
    );
    expect(darkDecls.filter((prop) => prop !== 'color-scheme')).toEqual([]);
  });

  it('leaves out the Angular theme rules', () => {
    expect(rulesFor(roots.base, '.xy-flow__node.connection-target')).toEqual([]);
    expect(rulesFor(roots.base, '.xy-flow__edge-textbg')).toEqual([]);
  });
});

describe('bundled xy-theme.css (full theme on top of base.css)', () => {
  it('puts every top-level node in @layer xyflow', () => {
    const stray = roots['xy-theme'].nodes.filter(
      (node) => node.type !== 'comment' && !(node.type === 'atrule' && node.name === 'layer' && node.params === 'xyflow'),
    );
    expect(stray.map((node) => node.toString().slice(0, 80))).toEqual([]);
  });

  it('leaves no @import and no & in any selector', () => {
    const imports: string[] = [];
    roots['xy-theme'].walkAtRules('import', (rule) => {
      imports.push(rule.params);
    });
    const nested: string[] = [];
    roots['xy-theme'].walkRules((rule) => {
      if (rule.selector.includes('&')) nested.push(rule.selector);
    });
    expect(imports).toEqual([]);
    expect(nested).toEqual([]);
  });

  it('carries the xy-theme tokens and node rules', () => {
    expect(sources['xy-theme']).toContain('--xy-theme-primary');
    expect(rulesFor(roots['xy-theme'], '.xy-flow__node').length).toBeGreaterThan(0);
  });

  it('keeps the brand colour from the system theme (no override)', () => {
    expect(declValues(roots['xy-theme'], ':root', '--xy-theme-primary')).toEqual(['#ff0073']);
  });

  it('builds on base.css, not style.css', () => {
    expect(rulesFor(roots['xy-theme'], '.xy-flow__pane::before').length).toBeGreaterThan(0);
    expect(rulesFor(roots['xy-theme'], '.xy-flow__node.connection-target')).toEqual([]);
    expect(declValues(roots['xy-theme'], '.xy-flow', '--xy-edge-stroke-default')).toEqual(['light-dark(#b1b1b7, #3e3e3e)']);
  });

  it('has the edge-text fill rules on the rendered xy-flow__ classes', () => {
    expect(declValues(roots['xy-theme'], '.xy-flow__edge-textbg', 'fill')).toContain(
      'var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default))',
    );
  });
});

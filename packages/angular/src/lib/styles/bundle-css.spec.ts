// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postcss, { type Root, type Rule } from 'postcss';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleCss } from '../../../scripts/bundle-css.js';

const ENTRIES = ['style', 'base'] as const;
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

describe.each(ENTRIES)('bundled %s.css', (entry) => {
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
});

describe('bundled style.css (Angular rules)', () => {
  it('keeps the edge-text fill rules', () => {
    expect(declValues(roots.style, '.ng-flow__edge-textbg', 'fill')).toContain(
      'var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default))',
    );
    expect(declValues(roots.style, '.ng-flow__edge-text', 'fill')).toContain(
      'var(--xy-edge-label-color, var(--xy-edge-label-color-default))',
    );
  });

  it.each([
    ['.xy-flow__pane.draggable::before', 'grab'],
    ['.xy-flow__node.draggable', 'grab'],
    ['.xy-flow__pane.dragging::before', 'grabbing'],
    ['.xy-flow__node.draggable.dragging', 'grabbing'],
    ['.xy-flow__handle.connectionindicator', 'crosshair'],
  ])('keeps the SVG cursor on %s', (selector, fallback) => {
    const cursors = declValues(roots.style, selector, 'cursor').filter((value) =>
      value.startsWith('url("data:image/svg+xml'),
    );
    expect(cursors.length).toBeGreaterThan(0);
    expect(cursors.every((value) => value.endsWith(`, ${fallback}`))).toBe(true);
  });
});

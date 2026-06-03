/**
 * Dotted-path interpolation for node template specs.
 *
 * Security stance: the only "language" is `data(.identifier)*`. No brackets,
 * no calls, no expressions. Resolution walks own-properties only, so
 * `data.constructor` / prototype-chain access resolves to undefined. Callers
 * must render results via text bindings — never innerHTML.
 */

const PATH_RE = /^data(\.[A-Za-z_$][\w$]*)*$/;

/** Resolve a dotted `data.x.y` path against a node's `data`. Unknown → undefined. */
export function resolveTemplatePath(expr: string, data: unknown): unknown {
  if (!PATH_RE.test(expr)) return undefined;
  const segments = expr.split('.').slice(1); // drop the leading 'data'
  let current: unknown = data;
  if (current === null || current === undefined) return undefined;
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, seg)) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** Replace every `{{data.x}}` in `template` with its resolved value (or ''). */
export function interpolateTemplateString(template: string, data: unknown): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const value = resolveTemplatePath(expr, data);
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return String(value);
  });
}

/** Evaluate a `showIf` condition: undefined → true; otherwise truthiness of the path. */
export function isTemplateConditionTrue(expr: string | undefined, data: unknown): boolean {
  if (expr === undefined) return true;
  return !!resolveTemplatePath(expr, data);
}

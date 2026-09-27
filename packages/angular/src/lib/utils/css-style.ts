/**
 * Helpers that turn a React-style CSS object (`{ strokeWidth: 3 }`) into a
 * valid inline CSS declaration string (`stroke-width: 3px`).
 *
 * Edge paths are rendered through a raw `[attr.style]` binding, so keys must
 * be real (kebab-case) CSS property names and unitless numbers must get a
 * `px` suffix where the property requires a length — otherwise the browser
 * silently drops the declaration.
 */

/**
 * CSS properties that accept a plain number (no unit). Mirrors React DOM's
 * `isUnitlessNumber` list, plus the SVG presentation properties that are
 * unitless. Keys are kebab-case.
 */
const UNITLESS_PROPERTIES = new Set<string>([
  'animation-iteration-count',
  'aspect-ratio',
  'border-image-outset',
  'border-image-slice',
  'border-image-width',
  'box-flex',
  'box-flex-group',
  'box-ordinal-group',
  'column-count',
  'columns',
  'flex',
  'flex-grow',
  'flex-positive',
  'flex-shrink',
  'flex-negative',
  'flex-order',
  'font-weight',
  'grid-area',
  'grid-row',
  'grid-row-end',
  'grid-row-span',
  'grid-row-start',
  'grid-column',
  'grid-column-end',
  'grid-column-span',
  'grid-column-start',
  'line-clamp',
  'line-height',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tab-size',
  'widows',
  'z-index',
  'zoom',
  // SVG
  'fill-opacity',
  'flood-opacity',
  'stop-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
]);

/** `strokeWidth` → `stroke-width`; `WebkitTransform` → `-webkit-transform`; `--var` / kebab keys unchanged. */
export function toKebabCase(prop: string): string {
  if (prop.startsWith('--') || prop.includes('-')) return prop;
  let out = prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  // Vendor prefixes written as `msTransform` get a leading dash in CSS.
  if (out.startsWith('ms-')) out = '-' + out;
  return out;
}

/**
 * Serializes one value. Numbers get `px` unless the property is unitless, the
 * number is 0, or the key is a custom property (`--foo`), which is passed
 * through verbatim as in React.
 */
export function formatCssValue(kebabProp: string, value: string | number): string {
  if (typeof value !== 'number') return String(value).trim();
  if (value === 0 || kebabProp.startsWith('--') || UNITLESS_PROPERTIES.has(kebabProp)) {
    return String(value);
  }
  return `${value}px`;
}

/**
 * Converts a CSS object to an inline declaration string. `null`, `undefined`,
 * booleans, empty strings, and non-primitive values are skipped. Returns
 * `null` when nothing remains so an `[attr.style]` binding removes the
 * attribute entirely.
 *
 * `rename` optionally remaps (kebab-case) keys before serialization — used by
 * the HTML edge-label renderer to translate SVG-oriented keys such as `fill`.
 */
export function toCssText(
  style: Record<string, unknown> | null | undefined,
  rename?: Record<string, string>,
): string | null {
  if (!style) return null;
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(style)) {
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    if (typeof raw === 'number' && !Number.isFinite(raw)) continue;
    let prop = toKebabCase(key);
    prop = rename?.[prop] ?? prop;
    const value = formatCssValue(prop, raw);
    if (value === '') continue;
    parts.push(`${prop}: ${value}`);
  }
  return parts.length ? parts.join('; ') : null;
}

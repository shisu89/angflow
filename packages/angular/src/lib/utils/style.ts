import type { CSSProperties } from '../types/general';

/**
 * Properties React renders as plain numbers (no `px`), from React DOM's
 * `isUnitlessNumber` list. Every other numeric value gets `px`, as in React.
 */
const UNITLESS = new Set([
  'animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice', 'borderImageWidth',
  'boxFlex', 'boxFlexGroup', 'boxOrdinalGroup', 'columnCount', 'columns',
  'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'flexOrder',
  'gridArea', 'gridRow', 'gridRowEnd', 'gridRowSpan', 'gridRowStart',
  'gridColumn', 'gridColumnEnd', 'gridColumnSpan', 'gridColumnStart',
  'fontWeight', 'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'scale',
  'tabSize', 'widows', 'zIndex', 'zoom',
  // SVG
  'fillOpacity', 'floodOpacity', 'stopOpacity', 'strokeDasharray', 'strokeDashoffset',
  'strokeMiterlimit', 'strokeOpacity', 'strokeWidth',
]);

/**
 * Serialises a React-style style record for an `[attr.style]` binding:
 * `{ fill: 'red', fontSize: 12, opacity: 0.5 }` → `fill: red; font-size: 12px; opacity: 0.5`.
 * camelCase keys become kebab-case (custom properties pass through), unset
 * values are skipped, and numbers get `px` unless the property is unitless.
 */
export function toStyleString(style: CSSProperties | undefined): string | null {
  if (!style) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || value === '') continue;
    const isCustom = key.startsWith('--');
    const prop = isCustom ? key : key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    const needsPx = typeof value === 'number' && value !== 0 && !isCustom && !UNITLESS.has(key);
    parts.push(`${prop}: ${value}${needsPx ? 'px' : ''}`);
  }
  return parts.length ? parts.join('; ') : null;
}

import { describe, it, expect } from 'vitest';
import { toCssText, toKebabCase, formatCssValue } from './css-style';

describe('css-style', () => {
  it('kebab-cases camelCase keys and leaves kebab / custom properties alone', () => {
    expect(toKebabCase('strokeWidth')).toBe('stroke-width');
    expect(toKebabCase('stroke-width')).toBe('stroke-width');
    expect(toKebabCase('--xy-edge-stroke')).toBe('--xy-edge-stroke');
    expect(toKebabCase('WebkitTransform')).toBe('-webkit-transform');
    expect(toKebabCase('msTransform')).toBe('-ms-transform');
  });

  it('appends px to unitless numbers only for length properties', () => {
    expect(formatCssValue('stroke-width', 3)).toBe('3px');
    expect(formatCssValue('font-size', 12)).toBe('12px');
    expect(formatCssValue('width', 0)).toBe('0');
    for (const p of ['opacity', 'z-index', 'stroke-opacity', 'fill-opacity', 'flex', 'font-weight', 'line-height']) {
      expect(formatCssValue(p, 2)).toBe('2');
    }
    expect(formatCssValue('--my-var', 4)).toBe('4');
    expect(formatCssValue('stroke-width', '3')).toBe('3');
  });

  it('serializes a style object to valid declarations, skipping empty values', () => {
    expect(
      toCssText({ stroke: '#f00', strokeWidth: 3, opacity: 0.5, strokeDasharray: '5 5', zIndex: 2, foo: null, bar: undefined, baz: '' }),
    ).toBe('stroke: #f00; stroke-width: 3px; opacity: 0.5; stroke-dasharray: 5 5; z-index: 2');
    expect(toCssText({})).toBeNull();
    expect(toCssText(undefined)).toBeNull();
    expect(toCssText({ a: NaN, b: { nested: 1 } as unknown })).toBeNull();
  });

  it('applies an optional key rename after kebab-casing', () => {
    expect(toCssText({ fill: 'red', fontSize: 10 }, { fill: 'color' })).toBe('color: red; font-size: 10px');
  });
});

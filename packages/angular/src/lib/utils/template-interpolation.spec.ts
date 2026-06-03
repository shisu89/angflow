import { describe, it, expect } from 'vitest';
import {
  resolveTemplatePath,
  interpolateTemplateString,
  isTemplateConditionTrue,
} from './template-interpolation';

describe('resolveTemplatePath', () => {
  it('resolves a simple data path', () => {
    expect(resolveTemplatePath('data.name', { name: 'api' })).toBe('api');
  });

  it('resolves a nested path', () => {
    expect(resolveTemplatePath('data.config.port', { config: { port: 8080 } })).toBe(8080);
  });

  it('returns undefined for a missing path', () => {
    expect(resolveTemplatePath('data.missing', { name: 'api' })).toBeUndefined();
  });

  it('returns undefined when the leading segment is not "data"', () => {
    expect(resolveTemplatePath('name', { name: 'api' })).toBeUndefined();
    expect(resolveTemplatePath('window.location', {})).toBeUndefined();
  });

  it('returns the whole data object for the bare "data" path', () => {
    const data = { a: 1 };
    expect(resolveTemplatePath('data', data)).toBe(data);
  });

  it('does not walk the prototype chain', () => {
    expect(resolveTemplatePath('data.constructor', {})).toBeUndefined();
    expect(resolveTemplatePath('data.toString', {})).toBeUndefined();
    expect(resolveTemplatePath('data.constructor.constructor', {})).toBeUndefined();
  });

  it('rejects expressions with brackets, parens, or spaces', () => {
    expect(resolveTemplatePath('data["a"]', { a: 1 })).toBeUndefined();
    expect(resolveTemplatePath('data.a()', { a: () => 1 })).toBeUndefined();
    expect(resolveTemplatePath('data .a', { a: 1 })).toBeUndefined();
  });

  it('returns undefined when data is null or a primitive mid-walk', () => {
    expect(resolveTemplatePath('data.a.b', { a: null })).toBeUndefined();
    expect(resolveTemplatePath('data.a.b', { a: 5 })).toBeUndefined();
    expect(resolveTemplatePath('data.a', null)).toBeUndefined();
  });
});

describe('interpolateTemplateString', () => {
  it('replaces {{data.x}} with the value', () => {
    expect(interpolateTemplateString('Port: {{data.port}}', { port: 8080 })).toBe('Port: 8080');
  });

  it('replaces multiple placeholders', () => {
    expect(
      interpolateTemplateString('{{data.name}}:{{data.port}}', { name: 'api', port: 80 }),
    ).toBe('api:80');
  });

  it('renders empty string for unresolvable placeholders', () => {
    expect(interpolateTemplateString('x{{data.missing}}y', {})).toBe('xy');
  });

  it('renders empty string for null and undefined values', () => {
    expect(interpolateTemplateString('[{{data.a}}]', { a: null })).toBe('[]');
  });

  it('tolerates whitespace inside braces', () => {
    expect(interpolateTemplateString('{{ data.name }}', { name: 'api' })).toBe('api');
  });

  it('stringifies object values as JSON', () => {
    expect(interpolateTemplateString('{{data.cfg}}', { cfg: { a: 1 } })).toBe('{"a":1}');
  });

  it('leaves text without placeholders untouched', () => {
    expect(interpolateTemplateString('plain', {})).toBe('plain');
  });

  it('renders dangerous-looking expressions as empty, not as code', () => {
    expect(interpolateTemplateString('{{constructor.constructor}}', {})).toBe('');
    expect(interpolateTemplateString('{{data.__proto__.polluted}}', {})).toBe('');
  });

  it('passes <script> through as inert text (caller binds as text, never HTML)', () => {
    expect(interpolateTemplateString('<script>alert(1)</script>', {})).toBe(
      '<script>alert(1)</script>',
    );
  });
});

describe('isTemplateConditionTrue', () => {
  it('returns true when expr is undefined (no condition)', () => {
    expect(isTemplateConditionTrue(undefined, {})).toBe(true);
  });

  it('uses truthiness of the resolved value', () => {
    expect(isTemplateConditionTrue('data.env', { env: 'prod' })).toBe(true);
    expect(isTemplateConditionTrue('data.env', { env: '' })).toBe(false);
    expect(isTemplateConditionTrue('data.env', {})).toBe(false);
    expect(isTemplateConditionTrue('data.n', { n: 0 })).toBe(false);
  });

  it('returns false for prototype-chain expressions', () => {
    expect(isTemplateConditionTrue('data.constructor', {})).toBe(false);
  });
});

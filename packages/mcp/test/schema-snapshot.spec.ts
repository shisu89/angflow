import { describe, it, expect } from 'vitest';
import { AGENT_TOOL_SCHEMAS, GENERATED_FROM_ANGULAR_VERSION } from '../src/generated/tool-schemas';
// Workspace source of truth — dependency-free file inside the angular package.
import { AGENT_TOOL_SCHEMAS as SOURCE_SCHEMAS } from '../../angular/src/lib/agent/tool-schemas';

describe('generated schema snapshot', () => {
  it('matches the workspace source exactly (run `npm run generate:schemas` if this fails)', () => {
    expect(AGENT_TOOL_SCHEMAS).toEqual(SOURCE_SCHEMAS);
  });

  it('is stamped with the angular package version it was generated from', () => {
    expect(GENERATED_FROM_ANGULAR_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('every entry is a structurally valid tool definition', () => {
    expect(AGENT_TOOL_SCHEMAS.length).toBeGreaterThanOrEqual(51);
    const names = new Set<string>();
    for (const s of AGENT_TOOL_SCHEMAS) {
      expect(typeof s.name).toBe('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(names.has(s.name)).toBe(false);
      names.add(s.name);
      expect(typeof s.description).toBe('string');
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.inputSchema.type).toBe('object');
      expect(typeof s.inputSchema.properties).toBe('object');
    }
  });

  it('does not contain the server-local canvas_status name (reserved)', () => {
    expect(AGENT_TOOL_SCHEMAS.some((s) => s.name === 'canvas_status')).toBe(false);
  });
});

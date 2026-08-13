import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ngDevWarn, resetDevWarnDedupe } from './dev-warn';

describe('ngDevWarn', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDevWarnDedupe();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('warns with the angflow prefix and the help link', () => {
    ngDevWarn('011', 'Edge type "bogus" not found. Using fallback type "default".');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      '[angflow]: Edge type "bogus" not found. Using fallback type "default". Help: https://reactflow.dev/error#011'
    );
  });

  it('warns only once for a repeated id+message pair', () => {
    ngDevWarn('011', 'same message');
    ngDevWarn('011', 'same message');
    ngDevWarn('011', 'same message');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not collapse distinct messages sharing one code', () => {
    // The whole reason the dedupe key is `id::message` and not `id`: two
    // different bad node types are both error003, and the second must warn.
    ngDevWarn('003', 'Node type "typoA" not found. Using fallback type "default".');
    ngDevWarn('003', 'Node type "typoB" not found. Using fallback type "default".');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('resetDevWarnDedupe clears the cache', () => {
    ngDevWarn('011', 'same message');
    resetDevWarnDedupe();
    ngDevWarn('011', 'same message');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('ngDevWarn outside dev mode', () => {
  afterEach(() => {
    vi.doUnmock('@angular/core');
    vi.resetModules();
  });

  it('stays silent when isDevMode() is false', async () => {
    vi.resetModules();
    vi.doMock('@angular/core', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@angular/core')>()),
      isDevMode: () => false,
    }));
    const mod = await import('./dev-warn');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mod.ngDevWarn('011', 'should not appear');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

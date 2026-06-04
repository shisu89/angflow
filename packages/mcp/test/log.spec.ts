import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from '../src/log';

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes to stderr, never stdout', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger('info');
    log.info('hello');
    log.warn('careful');
    expect(err).toHaveBeenCalledTimes(2);
    expect(out).not.toHaveBeenCalled();
  });

  it('filters below the configured level', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('info');
    log.debug('noise');
    expect(err).not.toHaveBeenCalled();
  });

  it('silent level suppresses everything', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('silent');
    log.info('x');
    log.warn('x');
    log.debug('x');
    expect(err).not.toHaveBeenCalled();
  });

  it('prefixes messages with [angflow-mcp] and the level', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('debug');
    log.debug('details');
    expect(err).toHaveBeenCalledWith('[angflow-mcp]', 'debug:', 'details');
  });
});

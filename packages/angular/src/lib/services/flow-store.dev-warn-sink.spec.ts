import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { devWarn, setDevWarnSink, addEdge } from '@angflow/system';
import type { Connection, EdgeBase } from '@angflow/system';
import { FlowStore } from './flow-store.service';
import { resetDevWarnDedupe } from '../utils/dev-warn';

describe('FlowStore installs the @angflow/system dev-warn sink', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Both the sink and ngDevWarn's dedupe cache are module state that
    // outlives a TestBed.
    setDevWarnSink(null);
    resetDevWarnDedupe();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
  });

  afterEach(() => {
    warn.mockRestore();
    setDevWarnSink(null);
  });

  it('leaves system devWarn silent before any FlowStore is constructed', () => {
    // Guards the test below against passing for the wrong reason: the default
    // sink is genuinely silent here, so a later warning proves the install.
    devWarn('006', 'Before any store.');
    expect(warn).not.toHaveBeenCalled();
  });

  it('routes system devWarn through ngDevWarn once a FlowStore exists', () => {
    TestBed.inject(FlowStore);

    devWarn('006', 'After the store.');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[angflow]:');
    expect(warn.mock.calls[0][0]).toContain('After the store.');
  });

  it('makes addEdge report a missing source', () => {
    TestBed.inject(FlowStore);
    const conn: Connection = { source: '', target: 'b', sourceHandle: null, targetHandle: null };

    const result = addEdge(conn, [] as EdgeBase[]);

    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[angflow]:');
    expect(warn.mock.calls[0][0]).toContain('source and a target');
  });
});

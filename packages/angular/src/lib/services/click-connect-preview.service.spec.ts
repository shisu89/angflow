/**
 * ClickConnectPreview wiring tests.
 *
 * The endpoint computation lives in @angflow/system
 * (XYHandle.getClickConnectionState, tested there). Here we mock it and verify
 * the service's wiring: arming attaches a document pointermove listener that
 * pushes the computed state into the store; every disarm path detaches the
 * listener and clears the preview line.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import * as system from '@angflow/system';
import type { ConnectionInProgress, HandleType } from '@angflow/system';
import { ClickConnectPreview } from './click-connect-preview.service';
import { FlowStore } from './flow-store.service';

vi.mock('@angflow/system', { spy: true });

const PREVIEW = {
  inProgress: true,
  isValid: null,
  from: { x: 0, y: 0 },
  fromHandle: { nodeId: 'A', id: null, type: 'source', position: 'right', x: 0, y: 0 },
  fromPosition: 'right',
  fromNode: {} as unknown,
  to: { x: 120, y: 90 },
  toHandle: null,
  toPosition: 'left',
  toNode: null,
  pointer: { x: 120, y: 90 },
} as unknown as ConnectionInProgress;

function tick(): void {
  TestBed.tick();
}

describe('ClickConnectPreview', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, ClickConnectPreview],
    });
    store = TestBed.inject(FlowStore);
    vi.spyOn(system.XYHandle, 'getClickConnectionState').mockReturnValue(PREVIEW);
    // Instantiate the service so its effect registers.
    TestBed.inject(ClickConnectPreview);
    tick();
  });

  function arm(): void {
    store.connectionClickStartHandle.set({ nodeId: 'A', handleId: null, type: 'source' as HandleType });
    tick();
  }

  it('draws a preview on cursor move while a handle is armed', () => {
    arm();
    expect(store.connection().inProgress).toBe(false); // nothing until the cursor moves

    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 90, bubbles: true }));

    expect(system.XYHandle.getClickConnectionState).toHaveBeenCalled();
    expect(store.connection().inProgress).toBe(true);
    expect(store.connection().fromHandle?.nodeId).toBe('A');
  });

  it('clears the preview and stops tracking when the handle disarms', () => {
    arm();
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 90, bubbles: true }));
    expect(store.connection().inProgress).toBe(true);

    // Disarm (any cancel path nulls the signal).
    store.connectionClickStartHandle.set(null);
    tick();
    expect(store.connection().inProgress).toBe(false);

    // A later move must not resurrect the preview (listener detached).
    vi.mocked(system.XYHandle.getClickConnectionState).mockClear();
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }));
    expect(system.XYHandle.getClickConnectionState).not.toHaveBeenCalled();
    expect(store.connection().inProgress).toBe(false);
  });

  it('does not track when connectOnClick is disabled', () => {
    store.connectOnClick.set(false);
    arm();
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 90, bubbles: true }));
    expect(system.XYHandle.getClickConnectionState).not.toHaveBeenCalled();
    expect(store.connection().inProgress).toBe(false);
  });
});

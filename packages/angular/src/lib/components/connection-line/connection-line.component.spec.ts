/**
 * ConnectionLineComponent data enrichment tests.
 *
 * Angular's JIT compiler (used in Vitest) does not populate ɵcmp.inputs from
 * signal-based input() declarations — that requires the AOT transform. We
 * therefore create ConnectionLineComponent directly and assert on the public
 * connectionProps() computed signal, which exposes fromHandle after enrichment.
 * All reactive enrichment logic in connectionCoords() is fully exercised.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ConnectionLineComponent } from './connection-line.component';
import { FlowStore } from '../../services/flow-store.service';
import { Position, type ConnectionInProgress, type Handle } from '@angflow/system';

function makeInProgressConnection(): ConnectionInProgress {
  const handle: Handle = {
    id: 'h1',
    nodeId: 'n1',
    x: 0,
    y: 0,
    position: Position.Right,
    type: 'source',
    width: 10,
    height: 10,
  };
  return {
    inProgress: true,
    isValid: null,
    from: { x: 0, y: 0 },
    fromHandle: handle,
    fromPosition: Position.Right,
    fromNode: null as never,
    to: { x: 100, y: 100 },
    toHandle: null,
    toPosition: Position.Left,
    toNode: null,
    pointer: { x: 100, y: 100 },
  };
}

describe('ConnectionLineComponent data enrichment', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConnectionLineComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  it('enriches fromHandle with registry data before passing to custom line', () => {
    store.registerHandleData('n1', 'h1', 'source', 'string');
    store.connection.set(makeInProgressConnection());

    const fixture = TestBed.createComponent(ConnectionLineComponent);
    fixture.detectChanges();

    const props = fixture.componentInstance.connectionProps();
    expect((props.fromHandle as Handle | null)?.data).toBe('string');
  });

  it('leaves fromHandle.data undefined when nothing is registered', () => {
    store.connection.set(makeInProgressConnection());

    const fixture = TestBed.createComponent(ConnectionLineComponent);
    fixture.detectChanges();

    const props = fixture.componentInstance.connectionProps();
    expect((props.fromHandle as Handle | null)?.data).toBeUndefined();
  });
});

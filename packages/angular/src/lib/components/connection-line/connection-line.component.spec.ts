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
import { Component, provideZonelessChangeDetection } from '@angular/core';
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

describe('ConnectionLineComponent default line classes', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConnectionLineComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  function renderGroup(isValid: boolean | null): SVGGElement {
    store.connection.set({ ...makeInProgressConnection(), isValid });
    const fixture = TestBed.createComponent(ConnectionLineComponent);
    fixture.detectChanges();
    const g = (fixture.nativeElement as HTMLElement).querySelector('svg.xy-flow__connectionline > g');
    expect(g).not.toBeNull();
    return g as SVGGElement;
  }

  it('marks a valid connection like upstream', () => {
    const g = renderGroup(true);
    expect(g.classList.contains('ng-flow__connection')).toBe(true);
    expect(g.classList.contains('xy-flow__connection')).toBe(true);
    expect(g.classList.contains('valid')).toBe(true);
    expect(g.classList.contains('invalid')).toBe(false);
  });

  it('marks an invalid connection', () => {
    const g = renderGroup(false);
    expect(g.classList.contains('xy-flow__connection')).toBe(true);
    expect(g.classList.contains('invalid')).toBe(true);
    expect(g.classList.contains('valid')).toBe(false);
  });

  it('adds no status class while validity is unknown', () => {
    const g = renderGroup(null);
    expect(g.classList.contains('ng-flow__connection')).toBe(true);
    expect(g.classList.contains('xy-flow__connection')).toBe(true);
    expect(g.classList.contains('valid')).toBe(false);
    expect(g.classList.contains('invalid')).toBe(false);
  });
});

@Component({
  selector: 'test-custom-line',
  standalone: true,
  template: '<svg><path class="custom-line" /></svg>',
})
class TestCustomLineComponent {}

describe('ConnectionLineComponent custom line wrapper', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConnectionLineComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  it('wraps a custom line in the connection + status classes, like upstream', () => {
    store.connection.set({ ...makeInProgressConnection(), isValid: false });
    const fixture = TestBed.createComponent(ConnectionLineComponent);
    fixture.componentRef.setInput('customComponent', TestCustomLineComponent);
    fixture.detectChanges();

    const custom = (fixture.nativeElement as HTMLElement).querySelector('test-custom-line');
    expect(custom).not.toBeNull();
    const wrapper = custom!.parentElement!;
    expect(wrapper.classList.contains('ng-flow__connection')).toBe(true);
    expect(wrapper.classList.contains('xy-flow__connection')).toBe(true);
    expect(wrapper.classList.contains('invalid')).toBe(true);
  });
});

/**
 * KeyHandlerDirective select-all tests.
 *
 * Asserts that Ctrl+A (handleSelectAll) respects per-element `selectable`
 * flags and does not add nodes or edges where `selectable === false`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { By } from '@angular/platform-browser';
import { KeyHandlerDirective } from './key-handler.directive';
import { FlowStore } from '../services/flow-store.service';
import type { Node, Edge } from '../types';

@Component({
  standalone: true,
  imports: [KeyHandlerDirective],
  template: `<div ngFlowKeyHandler></div>`,
})
class HostComponent {}

function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, ...overrides };
}
function makeEdge(id: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source: 'n1', target: 'n2', ...overrides };
}

describe('KeyHandlerDirective select-all', () => {
  let store: FlowStore;
  let directive: KeyHandlerDirective;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    directive = fixture.debugElement
      .query(By.directive(KeyHandlerDirective))
      .injector.get(KeyHandlerDirective);
  });

  it('Ctrl+A selects all nodes and edges when none have selectable: false (control)', () => {
    store.setNodes([makeNode('n1'), makeNode('n2')]);
    store.setEdges([makeEdge('e1'), makeEdge('e2')]);

    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

    expect(store.selectedNodes().map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(store.selectedEdges().map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('Ctrl+A skips nodes and edges with selectable: false', () => {
    store.setNodes([makeNode('n1'), makeNode('n2', { selectable: false })]);
    store.setEdges([makeEdge('e1'), makeEdge('e2', { selectable: false })]);

    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

    expect(store.selectedNodes().map((n) => n.id)).toEqual(['n1']);
    expect(store.selectedEdges().map((e) => e.id)).toEqual(['e1']);
  });

  it('resets stuck modifier keys on window blur', () => {
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Shift' }));
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta' }));
    expect(store.selectionKeyActive()).toBe(true);
    expect(store.multiSelectionActive()).toBe(true);

    // Window blur (e.g. Cmd+Tab) never delivers keyup — the reset must clear both.
    directive.onWindowBlur();

    expect(store.selectionKeyActive()).toBe(false);
    expect(store.multiSelectionActive()).toBe(false);
  });

  it('tracks the default literal-space pan key and prevents page scrolling', () => {
    const down = new KeyboardEvent('keydown', {
      key: ' ', code: 'Space', cancelable: true,
    });
    directive.onKeyDown(down);
    expect(store.panActivationKeyActive()).toBe(true);
    expect(down.defaultPrevented).toBe(true);

    directive.onKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));
    expect(store.panActivationKeyActive()).toBe(false);
  });

  it('matches a configured Space value through KeyboardEvent.code', () => {
    setSignalInput(directive, 'panActivationKeyCode', 'Space');
    directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    expect(store.panActivationKeyActive()).toBe(true);
  });

  it('treats activation-key arrays as alternatives', () => {
    setSignalInput(directive, 'panActivationKeyCode', ['Space', 'KeyP']);
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP' }));
    expect(store.panActivationKeyActive()).toBe(true);
  });

  it('keeps pan activation active until every held alternative key is released', () => {
    setSignalInput(directive, 'panActivationKeyCode', ['Space', 'KeyP']);

    directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP' }));
    directive.onKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));

    expect(store.panActivationKeyActive()).toBe(true);

    directive.onKeyUp(new KeyboardEvent('keyup', { key: 'p', code: 'KeyP' }));
    expect(store.panActivationKeyActive()).toBe(false);
  });

  it('treats repeated pan keydown events as one held physical key', () => {
    const down = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
    directive.onKeyDown(down);
    directive.onKeyDown(down);
    directive.onKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));

    expect(store.panActivationKeyActive()).toBe(false);
  });

  it('clears pan activation when its pressed key is released after configuration changes', () => {
    directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    setSignalInput(directive, 'panActivationKeyCode', 'KeyP');
    directive.onKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));

    expect(store.panActivationKeyActive()).toBe(false);
  });

  it('tracks and releases the zoom activation key', () => {
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft' }));
    expect(store.zoomActivationKeyActive()).toBe(true);
    directive.onKeyUp(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }));
    expect(store.zoomActivationKeyActive()).toBe(false);
  });

  it('clears zoom activation when its pressed key is released after configuration changes', () => {
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft' }));
    setSignalInput(directive, 'zoomActivationKeyCode', 'Control');
    directive.onKeyUp(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }));

    expect(store.zoomActivationKeyActive()).toBe(false);
  });

  it('ignores activation keys from editable targets', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
    Object.defineProperty(event, 'target', { value: input });
    directive.onKeyDown(event);
    expect(store.panActivationKeyActive()).toBe(false);
  });

  it('does not swallow Space on a focused button or link, but still tracks the key', () => {
    for (const tag of ['button', 'a']) {
      const el = document.createElement(tag);
      const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', cancelable: true });
      Object.defineProperty(event, 'target', { value: el });

      directive.onKeyDown(event);

      // The button/link must still activate on Space...
      expect(event.defaultPrevented).toBe(false);
      // ...while pan activation tracks the held key exactly as it would elsewhere.
      expect(store.panActivationKeyActive()).toBe(true);

      directive.onKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));
    }
  });

  it('still prevents the default for a modifier-qualified activation key on a button', () => {
    const button = document.createElement('button');
    const event = new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: button });

    directive.onKeyDown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(store.zoomActivationKeyActive()).toBe(true);
  });

  it('honors null activation inputs', () => {
    setSignalInput(directive, 'panActivationKeyCode', null);
    setSignalInput(directive, 'zoomActivationKeyCode', null);
    directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft' }));
    expect(store.panActivationKeyActive()).toBe(false);
    expect(store.zoomActivationKeyActive()).toBe(false);
  });

  it('clears every held modifier on blur and context menu', () => {
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Shift' }));
    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta' }));
    directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    directive.onWindowBlur();
    expect(store.selectionKeyActive()).toBe(false);
    expect(store.multiSelectionActive()).toBe(false);
    expect(store.panActivationKeyActive()).toBe(false);
    expect(store.zoomActivationKeyActive()).toBe(false);

    directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta' }));
    directive.onContextMenu();
    expect(store.multiSelectionActive()).toBe(false);
    expect(store.zoomActivationKeyActive()).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DragDirective } from './drag.directive';
import { FlowStore } from '../services/flow-store.service';

@Component({
  standalone: true,
  imports: [DragDirective],
  template: `<div class="pane" (click)="paneClicks = paneClicks + 1">
    <div class="node" [ngFlowDrag]="'a'" [ngFlowDragDisabled]="disabled" (click)="nodeClicks = nodeClicks + 1"></div>
  </div>`,
})
class HostComponent {
  nodeClicks = 0;
  paneClicks = 0;
  disabled = false;
}

// jsdom rejects `view: window` under vitest's global proxy, so the real Window is attached afterwards.
const view = document.defaultView as Window;
const mouse = (type: string, target: EventTarget, x: number, y = 10) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'view', { value: view });
  return target.dispatchEvent(event);
};
/** Crossing move + one further move: XYDrag moves nothing on the move that crosses the threshold. */
function drag(target: EventTarget, x0: number, x1: number, upTarget: EventTarget = target) {
  mouse('mousedown', target, x0);
  mouse('mousemove', target, x1);
  mouse('mousemove', target, x1 + 10);
  mouse('mouseup', upTarget, x1 + 10);
}

describe('DragDirective clicks (#5556)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let store: FlowStore;
  let pane: HTMLElement;
  let node: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideZonelessChangeDetection(), FlowStore] });
    store = TestBed.inject(FlowStore);
    store.setNodes([{ id: 'a', position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 40 } }]);
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    pane = fixture.nativeElement.querySelector('.pane');
    node = fixture.nativeElement.querySelector('.node');
    store.domNode.set(pane as HTMLDivElement);
  });
  afterEach(() => {
    fixture.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('(click) fires after a 1px jitter below nodeDragThreshold', () => {
    mouse('mousedown', node, 10);
    mouse('mousemove', node, 11);
    mouse('mouseup', node, 11);
    mouse('click', node, 11);
    expect(fixture.componentInstance.nodeClicks).toBe(1);
  });

  it('a node drag released over the pane emits no pane click', () => {
    drag(node, 10, 80, pane);
    mouse('click', pane, 90);
    expect(fixture.componentInstance.paneClicks).toBe(0);
  });
});

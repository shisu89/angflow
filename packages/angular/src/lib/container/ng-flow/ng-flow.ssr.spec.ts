/**
 * SSR smoke test. @angular/platform-server is not a workspace dependency, so
 * this approximates a server render: PLATFORM_ID is 'server' and the
 * browser-only globals that Node lacks (ResizeObserver, MutationObserver,
 * requestAnimationFrame, matchMedia) are removed. Lifecycle hooks — including
 * ngAfterViewInit — run on the server, so any unguarded use of those globals
 * would throw a ReferenceError here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { BackgroundComponent } from '../../components/background/background.component';
import { ControlsComponent } from '../../components/controls/controls.component';
import { MiniMapComponent } from '../../components/minimap/minimap.component';
import { NodeResizerComponent } from '../../components/node-resizer/node-resizer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node, Edge } from '../../types';

@Component({
  selector: 'ssr-resizable-node',
  imports: [NodeResizerComponent],
  template: `<ng-flow-node-resizer /><div>resizable</div>`,
})
class ResizableNodeComponent {}

@Component({
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, MiniMapComponent],
  template: `
    <ng-flow [nodes]="nodes()" [edges]="edges()" [fitView]="true" [nodeTypes]="nodeTypes">
      <ng-flow-background />
      <ng-flow-controls />
      <ng-flow-minimap />
    </ng-flow>
  `,
})
class SsrHostComponent {
  readonly nodeTypes = { resizable: ResizableNodeComponent };
  readonly nodes = signal<Node[]>([
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 150, height: 40 },
    { id: 'b', position: { x: 200, y: 100 }, data: { label: 'B' }, type: 'resizable' },
    { id: 'g', position: { x: 400, y: 0 }, data: { label: 'G' }, type: 'group', width: 200, height: 200 },
    { id: 'c', parentId: 'g', position: { x: 10, y: 10 }, data: { label: 'C' } },
  ]);
  readonly edges = signal<Edge[]>([
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c' },
  ]);
}

describe('<ng-flow> under a server platform', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('MutationObserver', undefined);
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    vi.stubGlobal('matchMedia', undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SsrHostComponent],
      providers: [provideZonelessChangeDetection(), { provide: PLATFORM_ID, useValue: 'server' }],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nodes, edges, background, controls and minimap without touching browser-only APIs', async () => {
    const fixture = TestBed.createComponent(SsrHostComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.xy-flow__node').length).toBe(4);
    expect(el.querySelector('.xy-flow__node[data-id="a"]')?.textContent).toContain('A');
    expect(el.querySelector('.xy-flow__background')).not.toBeNull();
    expect(el.querySelector('.xy-flow__controls')).not.toBeNull();
    expect(el.querySelector('.xy-flow__minimap')).not.toBeNull();

    // No d3-zoom instance is created on the server.
    const flow = fixture.debugElement.query((d) => d.componentInstance instanceof NgFlowComponent);
    const store = (flow.componentInstance as NgFlowComponent).store as FlowStore;
    expect(store.panZoom()).toBeNull();

    // Tweens have no frame clock on the server — they jump to the target.
    await store.tweenNodePositions({ a: { x: 50, y: 60 } }, 300);
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 50, y: 60 });

    expect(() => fixture.destroy()).not.toThrow();
  });
});

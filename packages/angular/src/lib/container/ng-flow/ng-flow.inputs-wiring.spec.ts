/**
 * `<ng-flow>` inputs that used to be declared but never consumed. Each test
 * binds the input through a real host template and asserts it reaches the
 * store or the renderer that implements it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  Component,
  ChangeDetectionStrategy,
  provideZonelessChangeDetection,
  signal,
  viewChild,
} from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  defaultAriaLabelConfig,
  MarkerType,
  type AriaLabelConfig,
  type Connection,
  type PanelPosition,
} from '@angflow/system';
import { NgFlowComponent } from './ng-flow.component';
import { EdgeRendererComponent } from '../edge-renderer/edge-renderer.component';
import { ConnectionLineComponent } from '../../components/connection-line/connection-line.component';
import { AttributionComponent } from '../../components/attribution/attribution.component';
import { PanelComponent } from '../../components/panel/panel.component';
import { DragDirective } from '../../directives/drag.directive';
import type { DefaultEdgeOptions, Edge, Node } from '../../types';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const NODES: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: {} },
  { id: 'b', position: { x: 300, y: 200 }, data: {} },
];

@Component({
  standalone: true,
  imports: [NgFlowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow
      [nodes]="nodes()"
      [edges]="edges()"
      [defaultEdgeOptions]="defaultEdgeOptions()"
      [ariaLabelConfig]="ariaLabelConfig()"
      [reconnectRadius]="reconnectRadius()"
      [elevateEdgesOnSelect]="elevateEdgesOnSelect()"
      [nodeClickDistance]="nodeClickDistance()"
      [defaultMarkerColor]="defaultMarkerColor()"
      [connectionLineStyle]="connectionLineStyle()"
      [connectionLineContainerStyle]="connectionLineContainerStyle()"
      [attributionPosition]="attributionPosition()"
      (connect)="connections.push($event)"
    />
  `,
})
class HostComponent {
  readonly flow = viewChild.required(NgFlowComponent);
  readonly nodes = signal<Node[]>(NODES);
  readonly edges = signal<Edge[]>([{ id: 'e1', source: 'a', target: 'b' }]);
  readonly defaultEdgeOptions = signal<DefaultEdgeOptions | undefined>(undefined);
  readonly ariaLabelConfig = signal<Partial<AriaLabelConfig> | undefined>(undefined);
  readonly reconnectRadius = signal(10);
  readonly elevateEdgesOnSelect = signal(false);
  readonly nodeClickDistance = signal(0);
  readonly defaultMarkerColor = signal<string | null>('#b1b1b7');
  readonly connectionLineStyle = signal<Partial<CSSStyleDeclaration> | undefined>(undefined);
  readonly connectionLineContainerStyle = signal<Partial<CSSStyleDeclaration> | undefined>(undefined);
  readonly attributionPosition = signal<PanelPosition>('bottom-right');
  readonly connections: Connection[] = [];
}

@Component({
  standalone: true,
  imports: [NgFlowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow
      [nodes]="nodes"
      [defaultEdges]="defaultEdges"
      [defaultEdgeOptions]="defaultEdgeOptions"
      (connect)="connections.push($event)"
    />
  `,
})
class UncontrolledHostComponent {
  readonly flow = viewChild.required(NgFlowComponent);
  readonly nodes = NODES;
  readonly defaultEdges: Edge[] = [];
  readonly defaultEdgeOptions: DefaultEdgeOptions = { type: 'smoothstep', animated: true };
  readonly connections: Connection[] = [];
}

describe('NgFlowComponent input wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent, UncontrolledHostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const store = host.flow().store;
    const edgeRenderer = fixture.debugElement.query(By.directive(EdgeRendererComponent))
      .componentInstance as EdgeRendererComponent;
    return { fixture, host, store, edgeRenderer };
  }

  it('defaultEdgeOptions reaches the store, is merged into rendered edges, and clears when unbound', async () => {
    const { fixture, host, store, edgeRenderer } = await setup();
    host.defaultEdgeOptions.set({ animated: true, type: 'step' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.defaultEdgeOptions()).toEqual({ animated: true, type: 'step' });
    const rendered = edgeRenderer.renderedEdges()[0];
    expect(rendered.animated).toBe(true);
    expect(rendered.type).toBe('step');
    const svg = fixture.nativeElement.querySelector('svg.xy-flow__edge') as SVGElement;
    expect(svg.classList.contains('animated')).toBe(true);
    expect(svg.classList.contains('xy-flow__edge-step')).toBe(true);

    host.defaultEdgeOptions.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(store.defaultEdgeOptions()).toBeUndefined();
    expect(edgeRenderer.renderedEdges()[0].animated).toBeUndefined();
  });

  it('ariaLabelConfig is merged over the defaults into store.ariaLabelConfig', async () => {
    const { fixture, host, store } = await setup();
    expect(store.ariaLabelConfig()).toEqual(defaultAriaLabelConfig);

    host.ariaLabelConfig.set({ 'controls.zoomIn.ariaLabel': 'Vergrößern' });
    fixture.detectChanges();
    await fixture.whenStable();

    const cfg = store.ariaLabelConfig();
    expect(cfg['controls.zoomIn.ariaLabel']).toBe('Vergrößern');
    expect(cfg['controls.zoomOut.ariaLabel']).toBe(defaultAriaLabelConfig['controls.zoomOut.ariaLabel']);
  });

  it('reconnectRadius reaches the edge renderer and sizes the reconnect anchors', async () => {
    const { fixture, host, edgeRenderer } = await setup();
    host.reconnectRadius.set(25);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(edgeRenderer.reconnectRadius()).toBe(25);
    const anchor = fixture.nativeElement.querySelector('circle.xy-flow__edgeupdater') as SVGCircleElement;
    expect(anchor.getAttribute('r')).toBe('25');
  });

  it('elevateEdgesOnSelect lifts a selected edge by 1000 (and only when enabled)', async () => {
    const { fixture, host, store, edgeRenderer } = await setup();
    const selected: Edge = { id: 'e1', source: 'a', target: 'b', selected: true };

    expect(store.elevateEdgesOnSelect()).toBe(false);
    const base = edgeRenderer.getEdgeZIndex(selected);

    host.elevateEdgesOnSelect.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.elevateEdgesOnSelect()).toBe(true);
    expect(edgeRenderer.getEdgeZIndex(selected)).toBe(base + 1000);
    expect(edgeRenderer.getEdgeZIndex({ ...selected, selected: false })).toBe(base);
  });

  it('nodeClickDistance reaches the store and every node drag directive', async () => {
    const { fixture, host, store } = await setup();
    host.nodeClickDistance.set(7);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.nodeClickDistance()).toBe(7);
    const drags = fixture.debugElement.queryAll(By.directive(DragDirective));
    expect(drags.length).toBe(NODES.length);
    for (const d of drags) {
      expect(d.injector.get(DragDirective).nodeClickDistance()).toBe(7);
    }
  });

  it('defaultMarkerColor colors markers that have no color of their own', async () => {
    const { fixture, host, edgeRenderer } = await setup();
    host.edges.set([
      { id: 'e1', source: 'a', target: 'b', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2', source: 'b', target: 'a', markerEnd: { type: MarkerType.Arrow, color: '#f00' } },
    ]);
    host.defaultMarkerColor.set('#123456');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(edgeRenderer.defaultMarkerColor()).toBe('#123456');
    const colors = edgeRenderer.markers().map((m) => m['color']).sort();
    expect(colors).toEqual(['#123456', '#f00']);
  });

  it('connectionLineStyle / connectionLineContainerStyle reach the connection line', async () => {
    const { fixture, host } = await setup();
    host.connectionLineStyle.set({ stroke: 'red', strokeWidth: 3 } as unknown as Partial<CSSStyleDeclaration>);
    host.connectionLineContainerStyle.set({ zIndex: '5' } as Partial<CSSStyleDeclaration>);
    fixture.detectChanges();
    await fixture.whenStable();

    const line = fixture.debugElement.query(By.directive(ConnectionLineComponent))
      .componentInstance as ConnectionLineComponent;
    expect(line.connectionLineStyleText()).toBe('stroke: red; stroke-width: 3px');
    expect(line.containerStyleText()).toBe('z-index: 5');
  });

  it('attributionPosition places the attribution panel', async () => {
    const { fixture, host } = await setup();
    host.attributionPosition.set('top-left');
    fixture.detectChanges();
    await fixture.whenStable();

    const attribution = fixture.debugElement.query(By.directive(AttributionComponent));
    expect((attribution.componentInstance as AttributionComponent).position()).toBe('top-left');
    const panel = attribution.query(By.directive(PanelComponent)).componentInstance as PanelComponent;
    expect(panel.position()).toBe('top-left');
  });

  describe('connect + defaultEdgeOptions', () => {
    it('controlled mode: (connect) carries the defaults but no edge is added internally', async () => {
      const { fixture, host, store } = await setup();
      host.defaultEdgeOptions.set({ animated: true });
      fixture.detectChanges();
      await fixture.whenStable();

      const params = store.completeConnection({ source: 'b', target: 'a', sourceHandle: null, targetHandle: null });
      store.onConnect?.(params);

      expect(params).toMatchObject({ source: 'b', target: 'a', animated: true });
      expect(host.connections[0]).toMatchObject({ animated: true });
      expect(store.edges().map((e) => e.id)).toEqual(['e1']);
    });

    it('uncontrolled mode (defaultEdges): the new edge is added once, with defaults applied', async () => {
      const fixture = TestBed.createComponent(UncontrolledHostComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const store = fixture.componentInstance.flow().store;
      expect(store.hasDefaultEdges()).toBe(true);

      const conn: Connection = { source: 'a', target: 'b', sourceHandle: null, targetHandle: null };
      store.onConnect?.(store.completeConnection(conn));
      // A duplicate connection must not add a second edge.
      store.completeConnection(conn);

      expect(store.edges().length).toBe(1);
      expect(store.edges()[0]).toMatchObject({ source: 'a', target: 'b', type: 'smoothstep', animated: true });
      expect(fixture.componentInstance.connections[0]).toMatchObject({ type: 'smoothstep' });
    });
  });
});

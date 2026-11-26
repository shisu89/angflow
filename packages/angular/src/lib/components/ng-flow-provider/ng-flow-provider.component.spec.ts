import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, inject, provideZonelessChangeDetection, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NgFlowProviderComponent } from './ng-flow-provider.component';
import { NgFlowComponent } from '../../container/ng-flow/ng-flow.component';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import type { Node } from '../../types';
import { initialConnection, NodeChangeset } from '@angflow/system';

@Component({ selector: 'test-sidebar', standalone: true, template: '' })
class SidebarComponent {
  readonly flow = inject(NgFlowService);
  readonly store = inject(FlowStore);
}

@Component({
  standalone: true,
  imports: [NgFlowProviderComponent, NgFlowComponent, SidebarComponent],
  template: `
    <ng-flow-provider>
      <ng-flow />
      <test-sidebar />
    </ng-flow-provider>
  `,
})
class ProviderHostComponent {}

@Component({
  standalone: true,
  imports: [NgFlowComponent],
  template: `<ng-flow /><ng-flow />`,
})
class TwoFlowsHostComponent {}

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('NgFlowProviderComponent state sharing', () => {
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
      imports: [ProviderHostComponent, TwoFlowsHostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shares the provider FlowStore and NgFlowService with <ng-flow> and siblings', () => {
    const fixture = TestBed.createComponent(ProviderHostComponent);
    fixture.detectChanges();

    const providerInjector = fixture.debugElement.query(By.directive(NgFlowProviderComponent)).injector;
    const providerStore = providerInjector.get(FlowStore);
    const providerService = providerInjector.get(NgFlowService);
    const flow = fixture.debugElement.query(By.directive(NgFlowComponent)).componentInstance as NgFlowComponent;
    const sidebar = fixture.debugElement.query(By.directive(SidebarComponent)).componentInstance as SidebarComponent;

    expect(flow.store).toBe(providerStore);
    expect(flow.service).toBe(providerService);
    expect(sidebar.store).toBe(providerStore);
    expect(sidebar.flow).toBe(providerService);
  });

  it('sidebar mutations through NgFlowService are visible to the flow', () => {
    const fixture = TestBed.createComponent(ProviderHostComponent);
    fixture.detectChanges();
    const flow = fixture.debugElement.query(By.directive(NgFlowComponent)).componentInstance as NgFlowComponent;
    const sidebar = fixture.debugElement.query(By.directive(SidebarComponent)).componentInstance as SidebarComponent;

    sidebar.flow.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as Node]);

    expect(flow.store.nodes().map((n) => n.id)).toEqual(['n1']);
  });

  it('standalone <ng-flow> instances still get isolated stores', () => {
    const fixture = TestBed.createComponent(TwoFlowsHostComponent);
    fixture.detectChanges();
    const flows = fixture.debugElement.queryAll(By.directive(NgFlowComponent));
    const a = flows[0].componentInstance as NgFlowComponent;
    const b = flows[1].componentInstance as NgFlowComponent;

    expect(a.store).not.toBe(b.store);
    a.store.setNodes([{ id: 'x', position: { x: 0, y: 0 }, data: {} } as Node]);
    expect(b.store.nodes()).toHaveLength(0);
  });

  it('unmounting the inner <ng-flow> keeps the shared store state', () => {
    @Component({
      standalone: true,
      imports: [NgFlowProviderComponent, NgFlowComponent],
      template: `
        <ng-flow-provider>
          @if (showFlow()) {
            <ng-flow />
          }
        </ng-flow-provider>
      `,
    })
    class ToggleHostComponent {
      readonly showFlow = signal(true);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ToggleHostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(ToggleHostComponent);
    fixture.detectChanges();

    const providerInjector = fixture.debugElement.query(By.directive(NgFlowProviderComponent)).injector;
    const store = providerInjector.get(FlowStore);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as Node]);
    fixture.detectChanges();

    fixture.componentInstance.showFlow.set(false);
    fixture.detectChanges();

    expect(store.nodes().map((n) => n.id)).toEqual(['n1']); // state survives inner unmount
    expect(store.panZoom()).toBeNull(); // but the dead panZoom was cleared
  });

  it('unmounting the inner <ng-flow> clears that flow\'s wiring from the shared store', () => {
    @Component({
      standalone: true,
      imports: [NgFlowProviderComponent, NgFlowComponent],
      template: `
        <ng-flow-provider>
          @if (showFlow()) {
            <ng-flow />
          }
        </ng-flow-provider>
      `,
    })
    class ToggleHostComponent {
      readonly showFlow = signal(true);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ToggleHostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(ToggleHostComponent);
    fixture.detectChanges();

    const providerInjector = fixture.debugElement.query(By.directive(NgFlowProviderComponent)).injector;
    const store = providerInjector.get(FlowStore);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as Node]);
    fixture.detectChanges();
    expect(store.onNodesChange).toBeTruthy(); // wired while mounted

    fixture.componentInstance.showFlow.set(false);
    fixture.detectChanges();

    for (const key of [
      'onNodesChange', 'onEdgesChange', 'onConnect', 'onConnectStart', 'onConnectEnd',
      'onClickConnectStart', 'onClickConnectEnd', 'onNodeDragStart', 'onNodeDrag', 'onNodeDragStop',
      'onSelectionDragStart', 'onSelectionDrag', 'onSelectionDragStop',
      'onNodesDelete', 'onEdgesDelete', 'onDelete', 'onBeforeDelete',
    ] as const) {
      expect(store[key], key).toBeNull();
    }
    expect(store.domNode()).toBeNull();
    expect(store.width()).toBe(0);
    expect(store.height()).toBe(0);
    expect(store.connection()).toEqual(initialConnection);
    expect(store.nodes().map((n) => n.id)).toEqual(['n1']); // graph kept
  });

  it('a remounted <ng-flow> re-wires the shared store and its outputs fire', () => {
    const seen: unknown[] = [];
    @Component({
      standalone: true,
      imports: [NgFlowProviderComponent, NgFlowComponent],
      template: `
        <ng-flow-provider>
          @if (showFlow()) {
            <ng-flow (nodesChange)="seen.push($event)" />
          }
        </ng-flow-provider>
      `,
    })
    class RemountHostComponent {
      readonly showFlow = signal(true);
      readonly seen = seen;
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RemountHostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(RemountHostComponent);
    fixture.detectChanges();
    const store = fixture.debugElement.query(By.directive(NgFlowProviderComponent)).injector.get(FlowStore);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as Node]);

    fixture.componentInstance.showFlow.set(false);
    fixture.detectChanges();
    fixture.componentInstance.showFlow.set(true);
    fixture.detectChanges();

    seen.length = 0;
    store.triggerNodeChanges([{ id: 'n1', type: 'select', selected: true }]);
    expect(seen.length).toBe(1);
    expect(seen[0]).toBeInstanceOf(NodeChangeset);
  });

  it('destroying one <ng-flow> keeps a sibling flow\'s wiring in the shared store', () => {
    @Component({
      standalone: true,
      imports: [NgFlowProviderComponent, NgFlowComponent],
      template: `
        <ng-flow-provider>
          @if (showA()) {
            <ng-flow />
          }
          @if (showB()) {
            <ng-flow />
          }
        </ng-flow-provider>
      `,
    })
    class SiblingHostComponent {
      readonly showB = signal(true);
      readonly showA = signal(true);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SiblingHostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(SiblingHostComponent);
    fixture.detectChanges();
    const store = fixture.debugElement.query(By.directive(NgFlowProviderComponent)).injector.get(FlowStore);
    const flows = fixture.debugElement.queryAll(By.directive(NgFlowComponent));
    const b = flows[1].componentInstance as NgFlowComponent;
    const bDom = store.domNode();
    expect(bDom).not.toBeNull();
    const bOnNodesChange = store.onNodesChange;
    expect(bOnNodesChange).toBeTruthy();
    expect(b).toBeTruthy();

    fixture.componentInstance.showA.set(false);
    fixture.detectChanges();

    expect(store.onNodesChange).toBe(bOnNodesChange);
    expect(store.domNode()).toBe(bDom);
    expect(store.width()).toBeGreaterThan(0);
  });
});

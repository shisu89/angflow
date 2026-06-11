import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, inject, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NgFlowProviderComponent } from './ng-flow-provider.component';
import { NgFlowComponent } from '../../container/ng-flow/ng-flow.component';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import type { Node } from '../../types';

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
});

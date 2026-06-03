import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { NODE_ID } from '../../services/tokens';
import { TemplateNodeComponent } from './template-node.component';
import type { NodeTemplateSpec } from '../../types/node-template';

function mount(
  spec: NodeTemplateSpec,
  data: Record<string, unknown>,
): { fixture: ComponentFixture<TemplateNodeComponent>; el: HTMLElement; store: FlowStore } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      FlowStore,
      NgFlowService,
      { provide: NODE_ID, useValue: 'n1' },
    ],
  });
  const store = TestBed.inject(FlowStore);
  store.nodeTemplates.set(new Map([['service', spec]]));
  const fixture = TestBed.createComponent(TemplateNodeComponent);
  fixture.componentRef.setInput('id', 'n1');
  fixture.componentRef.setInput('type', 'service');
  fixture.componentRef.setInput('data', data);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, store };
}

describe('TemplateNodeComponent', () => {
  it('renders an interpolated title as text', () => {
    const { el } = mount({ title: '{{data.name}}' }, { name: 'api' });
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toBe('api');
  });

  it('renders <script> in interpolated values as inert text', () => {
    const { el } = mount({ title: '{{data.name}}' }, { name: '<script>alert(1)</script>' });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toContain('<script>');
  });

  it('renders fields with labels and interpolated values', () => {
    const { el } = mount(
      { fields: [{ label: 'Port', value: '{{data.port}}' }] },
      { port: 8080 },
    );
    expect(el.querySelector('.ng-flow__template-node__field dt')?.textContent).toBe('Port');
    expect(el.querySelector('.ng-flow__template-node__field dd')?.textContent).toBe('8080');
  });

  it('hides fields whose showIf is falsy', () => {
    const { el } = mount(
      {
        fields: [
          { label: 'Port', value: '{{data.port}}', showIf: 'data.port' },
          { label: 'Env', value: '{{data.env}}', showIf: 'data.env' },
        ],
      },
      { port: 8080 },
    );
    const fields = el.querySelectorAll('.ng-flow__template-node__field');
    expect(fields).toHaveLength(1);
    expect(fields[0].querySelector('dt')?.textContent).toBe('Port');
  });

  it('renders badges with allowlisted palette classes, defaulting unknown colors to slate', () => {
    const { el } = mount(
      {
        badges: [
          { text: 'prod', color: 'amber' },
          { text: 'x', color: 'red; background:url(x)' as never },
        ],
      },
      {},
    );
    const badges = el.querySelectorAll('.ng-flow__template-node__badge');
    expect(badges).toHaveLength(2);
    expect(badges[0].classList.contains('ng-flow__template-node__badge--amber')).toBe(true);
    expect(badges[1].classList.contains('ng-flow__template-node__badge--slate')).toBe(true);
    // The malicious string must not appear in any class or style attribute.
    expect(el.innerHTML).not.toContain('url(x)');
  });

  it('renders default handles (target left, source right) when handles omitted', () => {
    const { el } = mount({}, {});
    const handles = el.querySelectorAll('.ng-flow__handle');
    expect(handles).toHaveLength(2);
  });

  it('renders declared handles', () => {
    const { el } = mount(
      { handles: [{ type: 'target', position: 'top' }, { type: 'source', position: 'bottom' }, { type: 'source', position: 'right', id: 'aux' }] },
      {},
    );
    expect(el.querySelectorAll('.ng-flow__handle')).toHaveLength(3);
  });

  it('applies the compact variant class', () => {
    const { el } = mount({ variant: 'compact' }, {});
    expect(
      el.querySelector('.ng-flow__template-node--compact'),
    ).not.toBeNull();
  });

  it('renders a known icon and skips unknown icon names', () => {
    const withIcon = mount({ icon: 'database' }, {});
    expect(withIcon.el.querySelector('svg.ng-flow__template-node__icon')).not.toBeNull();
    const withoutIcon = mount({ icon: 'no-such-icon' }, {});
    expect(withoutIcon.el.querySelector('svg.ng-flow__template-node__icon')).toBeNull();
  });

  it('re-renders when the registry spec is overwritten', () => {
    const { fixture, el, store } = mount({ title: 'v1' }, {});
    store.nodeTemplates.set(new Map([['service', { title: 'v2' }]]));
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toBe('v2');
  });

  it('renders nothing when no spec matches its type', () => {
    const { fixture, el, store } = mount({ title: 'x' }, {});
    store.nodeTemplates.set(new Map());
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__template-node')).toBeNull();
  });

  it('accent with injected CSS does not escape the style binding', () => {
    const { el } = mount({ title: 't', accent: 'red; background:url(http://evil)' }, {});
    expect(el.innerHTML).not.toContain('evil');
  });

  it('applies a valid accent color via style bindings', () => {
    const { el } = mount({ title: 't', accent: 'rgb(79, 70, 229)' }, {});
    const card = el.querySelector('.ng-flow__template-node') as HTMLElement;
    expect(card.style.borderLeftColor).toBe('rgb(79, 70, 229)');
  });

  it('renders interpolated body text', () => {
    const { el } = mount({ body: 'runs {{data.name}}' }, { name: 'api' });
    expect(el.querySelector('.ng-flow__template-node__body')?.textContent).toBe('runs api');
  });

  it('toggles the selected class from the selected input', () => {
    const { fixture, el } = mount({ title: 't' }, {});
    expect(el.querySelector('.ng-flow__template-node--selected')).toBeNull();
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__template-node--selected')).not.toBeNull();
  });

  it('re-interpolates when node data changes', () => {
    const { fixture, el } = mount({ title: '{{data.name}}' }, { name: 'v1' });
    fixture.componentRef.setInput('data', { name: 'v2' });
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__template-node__title')?.textContent).toBe('v2');
  });
});

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewContainerRef,
  afterNextRender,
  effect,
  inject,
  reflectComponentType,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  NgFlowComponent,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
} from '@angflow/angular';
import { partitionFlowProps } from './flow-props';
import { REGISTRY } from './registry';

const PREFIX = '/tests/generic/';

@Component({
  selector: 'generic-test-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; width: 100vw; height: 100vh; }'],
  template: `
    @if (config) {
      <div style="height: 100%"><ng-container #outlet /></div>
    } @else {
      404: This route doesn't exists.
    }
  `,
})
export class GenericTestHostComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly outlet = viewChild('outlet', { read: ViewContainerRef });

  private readonly key = this.router.url
    .split(/[?#]/)[0]
    .replace(PREFIX, '')
    .replace(/\/+$/, '');
  protected readonly config: FlowConfig | undefined = REGISTRY[this.key];

  private readonly nodes = signal<any[]>([]);
  private readonly edges = signal<any[]>([]);

  constructor() {
    afterNextRender(() => {
      const config = this.config;
      const outlet = this.outlet();
      if (!config || !outlet) return;
      const flowProps = (config.flowProps ?? {}) as Record<string, unknown>;

      this.nodes.set(structuredClone((flowProps['nodes'] as any[]) ?? []));
      this.edges.set(structuredClone((flowProps['edges'] as any[]) ?? []));

      const ref = outlet.createComponent(NgFlowComponent);
      this.destroyRef.onDestroy(() => ref.destroy());
      const mirror = reflectComponentType(NgFlowComponent)!;
      const inputNames = new Set(mirror.inputs.map((i) => i.templateName));
      const outputProps = new Map(mirror.outputs.map((o) => [o.templateName, o.propName]));
      const parts = partitionFlowProps(flowProps, inputNames);

      for (const [name, value] of Object.entries(parts.inputs)) ref.setInput(name, value);

      const subscribe = (output: string, handler: (p: any) => void) => {
        const prop = outputProps.get(output) ?? output;
        const sub = (ref.instance as any)[prop].subscribe(handler);
        this.destroyRef.onDestroy(() => sub.unsubscribe());
      };
      for (const o of parts.outputs) subscribe(o.output, o.handler);
      subscribe('nodesChange', (c) => this.nodes.update((n) => applyNodeChanges(c, n)));
      subscribe('edgesChange', (c) => this.edges.update((e) => applyEdgeChanges(c, e)));
      subscribe('connect', (c) => this.edges.update((e) => addEdge(c, e)));
      subscribe('reconnect', ({ edge, connection }) =>
        this.edges.update((e) => reconnectEdge(edge, connection, e)),
      );

      const el: HTMLElement = ref.location.nativeElement;
      if (parts.className) el.classList.add(...parts.className.split(/\s+/).filter(Boolean));
      if (parts.unsupported.length) {
        for (const k of parts.unsupported) console.warn('[generic-tests] unsupported prop: ' + k);
        el.setAttribute('data-unsupported-props', parts.unsupported.join(','));
      }

      effect(
        () => {
          ref.setInput('nodes', this.nodes());
          ref.setInput('edges', this.edges());
        },
        { injector: outlet.injector },
      );
    });
  }
}

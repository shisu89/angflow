import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgFlowService, type FitViewResult } from '@angflow/angular';

// long enough for a test to interrupt the transition halfway
const duration = 5000;

// fitView resolves { zoom, clamped, ended }; the other helpers resolve a boolean.
type Transition = () => Promise<unknown>;

@Component({
  selector: 'viewport-transitions-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display: flex; flex-direction: column; gap: 4px; padding: 8px; background: white">
      <button class="nodrag" (click)="track('fit view', fitViewTarget)">fit view</button>
      <button class="nodrag" (click)="track('set center', setCenterLong)">set center</button>
      <button class="nodrag" (click)="track('zoom to', zoomTo)">zoom to</button>
      <button class="nodrag" (click)="track('zoom in', zoomIn)">zoom in</button>
      <button class="nodrag" (click)="track('set center briefly', setCenterBrief)">set center briefly</button>
      <button class="nodrag" (click)="track('set center then set viewport', setCenterThenSetViewport)">
        set center then set viewport
      </button>
      <button class="nodrag" (click)="track('fit view twice', fitViewTwice)">fit view twice</button>
      <div role="status">{{ status() }}</div>
    </div>
  `,
})
export class ViewportTransitionsNodeComponent {
  private readonly flow = inject(NgFlowService);
  protected readonly status = signal('idle');

  protected async track(name: string, transition: Transition): Promise<void> {
    this.status.set(`${name}: pending`);
    const result = await transition();
    const ended = typeof result === 'boolean' ? result : (result as FitViewResult).ended;
    this.status.set(`${name}: ${ended ? 'ended' : 'interrupted'}`);
  }

  protected readonly fitViewTarget: Transition = () => this.flow.fitView({ nodes: [{ id: 'target' }], duration });
  protected readonly setCenterLong: Transition = () => this.flow.setCenter(800, 600, { zoom: 2, duration });
  protected readonly zoomTo: Transition = () => this.flow.zoomTo(2, { duration });
  protected readonly zoomIn: Transition = () => this.flow.zoomIn({ duration });
  protected readonly setCenterBrief: Transition = () => this.flow.setCenter(800, 600, { zoom: 2, duration: 200 });

  protected readonly setCenterThenSetViewport: Transition = () => {
    const transition = this.flow.setCenter(800, 600, { zoom: 2, duration });
    this.flow.setViewport({ x: 0, y: 0, zoom: 1 });
    return transition;
  };

  protected readonly fitViewTwice: Transition = () => {
    const transition = this.flow.fitView({ nodes: [{ id: 'target' }], duration });
    setTimeout(() => this.flow.fitView({ nodes: [{ id: 'transitions' }], duration: 2000 }), 500);
    return transition;
  };
}

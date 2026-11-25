import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { NgFlowService } from '@angflow/angular';

// NOT COVERAGE: upstream's connection-hooks.spec.ts starts with test.skip(FRAMEWORK !== 'react'),
// so this page exists for route parity only and is never exercised on Angular.
// React: useNodeConnections({ id: 'a', onConnect, onDisconnect }).
// angflow's selectNodeConnections has no onConnect/onDisconnect callbacks, so the
// connect/disconnect events are derived by diffing successive connection lists.
@Component({
  selector: 'connection-updates-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nodrag nopan">
      <output data-testid="connections">{{ connectionIds() }}</output>
      <output data-testid="connection-events">{{ events().join(',') }}</output>
      <button (click)="add()">Add connection</button>
      <button (click)="remove()">Remove connection</button>
      <button (click)="removeAll()">Remove all connections</button>
    </div>
  `,
})
export class ConnectionUpdatesNodeComponent {
  private readonly flow = inject(NgFlowService);
  private readonly connections = this.flow.selectNodeConnections('a');
  protected readonly events = signal<string[]>([]);
  protected readonly connectionIds = () => this.connections().map((c) => c.edgeId).join(',');

  private previous: Set<string> | undefined;

  constructor() {
    effect(() => {
      const current = new Set(this.connections().map((c) => c.edgeId));
      untracked(() => {
        if (this.previous) {
          const prev = this.previous;
          const added = [...current].filter((id) => !prev.has(id)).map((id) => `connect:${id}`);
          const removed = [...prev].filter((id) => !current.has(id)).map((id) => `disconnect:${id}`);
          if (added.length || removed.length) this.events.update((e) => [...e, ...added, ...removed]);
        }
        this.previous = current;
      });
    });
  }

  protected add(): void {
    this.flow.setEdges([...this.flow.getEdges(), { id: 'ac', source: 'a', target: 'c' }]);
  }
  protected remove(): void {
    this.flow.setEdges(this.flow.getEdges().filter(({ id }) => id !== 'ab'));
  }
  protected removeAll(): void {
    this.flow.setEdges([]);
  }
}

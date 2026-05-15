import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import {
  AngflowAgentBridge,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  NgFlowComponent,
  NgFlowService,
  PanelComponent,
  applyEdgeChanges,
  applyNodeChanges,
} from '@angflow/angular';
import type { Connection, Edge, Node } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-agent-bridge-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Agent bridge"
      description="The agent bridge exposes this canvas to AI agents over a JSON-RPC API. Open the devtools console and try the snippets below — every call mutates this flow live."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (init)="onInit($event)"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
        <ng-flow-minimap />
        <ng-flow-panel position="top-right">
          <div class="agent-panel">
            <div class="agent-panel__title">Try in the console</div>
            <pre class="agent-panel__code">await angflow.callTool('list_flows')</pre>
            <pre class="agent-panel__code">await angflow.callTool('add_node', {{ '{' }}
  node: {{ '{' }} id: 'a' + Date.now(), position: {{ '{' }} x: 200, y: 200 {{ '}' }}, data: {{ '{' }} label: 'agent' {{ '}' }} {{ '}' }}
{{ '}' }})</pre>
            <pre class="agent-panel__code">angflow.subscribe(e => console.log(e))</pre>
            <div class="agent-panel__title">Activity</div>
            <div class="agent-panel__log">
              @for (line of log(); track line.id) {
                <div class="agent-panel__line">{{ line.text }}</div>
              }
            </div>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .agent-panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #ffffff;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
      max-width: 360px;
      font-size: 11px;
    }
    .agent-panel__title {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 4px;
    }
    .agent-panel__code {
      margin: 0;
      padding: 6px 8px;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .agent-panel__log {
      max-height: 120px;
      overflow-y: auto;
      background: #f8fafc;
      border-radius: 4px;
      padding: 4px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      color: #475569;
    }
    .agent-panel__line {
      padding: 1px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class AgentBridgeExampleComponent implements OnDestroy {
  private readonly bridge = inject(AngflowAgentBridge);
  private unregister?: () => void;
  private nextLogId = 1;

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 100, y: 100 }, data: { label: 'Start' } },
    { id: '2', position: { x: 320, y: 180 }, data: { label: 'Process' } },
    { id: '3', type: 'output', position: { x: 540, y: 100 }, data: { label: 'Done' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3' },
  ];

  readonly log = signal<{ id: number; text: string }[]>([]);

  onInit(service: NgFlowService<Node, Edge>): void {
    this.unregister = this.bridge.register('demo', service);
    this.appendLog('Bridge registered flow "demo".');

    if (typeof window !== 'undefined') {
      const api = (window as unknown as { angflow?: { subscribe: (h: (e: unknown) => void) => () => void } }).angflow;
      if (api) {
        api.subscribe((evt) => {
          const e = evt as { event?: string; params?: { flowId?: string } };
          if (e.event === 'flow.state' && e.params?.flowId === 'demo') return;
          this.appendLog(`${e.event ?? 'event'}` + (e.params?.flowId ? ` (${e.params.flowId})` : ''));
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.unregister?.();
  }

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  private appendLog(text: string): void {
    const id = this.nextLogId++;
    const next = [...this.log(), { id, text }];
    this.log.set(next.length > 20 ? next.slice(next.length - 20) : next);
  }
}

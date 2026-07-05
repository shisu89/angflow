import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import {
  AgentChatComponent,
  AngflowAgentBridge,
  BackgroundComponent,
  ControlsComponent,
  NgFlowComponent,
  NgFlowService,
  PanelComponent,
  applyEdgeChanges,
  applyNodeChanges,
} from '@angflow/angular';
import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-agent-chat-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    AgentChatComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Agent chat"
      description="An end-user copilot embedded in the app. Start a reference proxy (Anthropic, OpenAI, Gemini, or Ollama via the OpenAI proxy — see server/ in examples/angular), then ask the copilot to edit this canvas — e.g. &quot;add a database node, connect it to Process, and tidy the layout&quot;."
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
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-right">
          <ng-flow-agent-chat />
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
  `],
})
export class AgentChatExampleComponent implements OnDestroy {
  private readonly bridge = inject(AngflowAgentBridge);
  private unregister?: () => void;

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 100, y: 100 }, data: { label: 'Start' } },
    { id: '2', position: { x: 320, y: 180 }, data: { label: 'Process' } },
    { id: '3', type: 'output', position: { x: 540, y: 100 }, data: { label: 'Done' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3' },
  ];

  onInit(service: NgFlowService<Node, Edge>): void {
    this.unregister = this.bridge.register('chat-demo', service);
  }

  ngOnDestroy(): void {
    this.unregister?.();
  }

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}

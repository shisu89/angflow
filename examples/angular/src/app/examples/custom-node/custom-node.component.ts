import { Component, ChangeDetectionStrategy, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  BackgroundComponent,
  ControlsComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  injectNgFlowNode,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

interface EmojiData { icon: string; title: string; subtitle: string }

// Custom node: an "emoji card" showing an icon, title, and subtitle. Uses the
// recommended injection-based API (injectNgFlowNode) — the alternative is to
// declare per-property inputs by hand; see custom-node-inject for the
// equivalent example with explanatory framing.
@Component({
  selector: 'app-emoji-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="emoji-node" [class.selected]="node.selected()">
      <div class="emoji-node__icon">{{ node.data()?.icon ?? '*' }}</div>
      <div class="emoji-node__text">
        <div class="emoji-node__title">{{ node.data()?.title ?? 'Untitled' }}</div>
        <div class="emoji-node__subtitle">{{ node.data()?.subtitle ?? '' }}</div>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    .emoji-node {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 10px;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.18);
      transition: box-shadow 0.15s, transform 0.15s;
      font-family: inherit;
    }
    .emoji-node.selected {
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);
      transform: translateY(-1px);
    }
    .emoji-node__icon {
      font-size: 22px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .emoji-node__title {
      font-size: 13px;
      font-weight: 700;
      color: #78350f;
    }
    .emoji-node__subtitle {
      font-size: 11px;
      color: #92400e;
      margin-top: 2px;
    }
  `],
})
export class EmojiNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<EmojiData>();
}

@Component({
  selector: 'app-custom-node-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom Node"
      description="Build a node from scratch with your own template and styling. Wire source/target handles with HandleComponent, read reactive per-node state with injectNgFlowNode()."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class CustomNodeExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    emoji: EmojiNodeComponent,
  };

  nodes: Node[] = [
    {
      id: '1',
      type: 'emoji',
      position: { x: 80, y: 80 },
      data: { icon: 'A', title: 'Read data', subtitle: 'from source' },
    },
    {
      id: '2',
      type: 'emoji',
      position: { x: 340, y: 220 },
      data: { icon: 'T', title: 'Transform', subtitle: 'map + filter' },
    },
    {
      id: '3',
      type: 'emoji',
      position: { x: 600, y: 100 },
      data: { icon: 'W', title: 'Write', subtitle: 'to destination' },
    },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3', animated: true },
  ];

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

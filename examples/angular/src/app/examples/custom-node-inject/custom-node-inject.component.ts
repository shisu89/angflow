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

// Custom node using the injection-based API. Note the class body: two lines.
@Component({
  selector: 'app-emoji-inject-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div
      class="emoji-inject-node"
      [class.selected]="node.selected()"
      [class.not-connectable]="!node.isConnectable()"
    >
      <div class="emoji-inject-node__icon">{{ node.data()?.icon ?? '*' }}</div>
      <div class="emoji-inject-node__text">
        <div class="emoji-inject-node__title">{{ node.data()?.title ?? 'Untitled' }}</div>
        <div class="emoji-inject-node__subtitle">{{ node.data()?.subtitle ?? '' }}</div>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
  styles: [`
    .emoji-inject-node {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      border: 2px solid #6366f1;
      border-radius: 10px;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.18);
      transition: box-shadow 0.15s, transform 0.15s;
      font-family: inherit;
    }
    .emoji-inject-node.selected {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
      transform: translateY(-1px);
    }
    .emoji-inject-node.not-connectable {
      border-style: dashed;
      opacity: 0.85;
    }
    .emoji-inject-node__icon {
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
    .emoji-inject-node__title {
      font-size: 13px;
      font-weight: 700;
      color: #312e81;
    }
    .emoji-inject-node__subtitle {
      font-size: 11px;
      color: #4f46e5;
      margin-top: 2px;
    }
  `],
})
export class EmojiInjectNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<EmojiData>();
}

@Component({
  selector: 'app-custom-node-inject-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom node (inject)"
      description="Custom node built with the injectNgFlowNode() API — the recommended pattern for new code. Reads node.data() (icon/title/subtitle), node.selected() (lift on selection), and node.isConnectable() (the 'Locked' node sets connectable: false, dimming its dashed handles). The class body is one injection call instead of ~13 input declarations."
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
export class CustomNodeInjectExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    emojiInject: EmojiInjectNodeComponent,
  };

  nodes: Node[] = [
    { id: '1', type: 'emojiInject', position: { x: 80, y: 80 }, data: { icon: 'A', title: 'Read data', subtitle: 'from source' } },
    { id: '2', type: 'emojiInject', position: { x: 340, y: 220 }, data: { icon: 'T', title: 'Transform', subtitle: 'map + filter' } },
    { id: '3', type: 'emojiInject', position: { x: 600, y: 100 }, data: { icon: 'W', title: 'Write', subtitle: 'to destination' } },
    { id: '4', type: 'emojiInject', position: { x: 340, y: 380 }, connectable: false, data: { icon: 'L', title: 'Locked', subtitle: 'connectable: false' } },
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

import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import {
  NgFlowComponent,
  NgFlowService,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, Viewport } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const STORAGE_KEY = 'angflow:gallery:save-restore';

interface PersistedFlow {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
}

@Component({
  selector: 'app-save-restore-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Save & Restore"
      description="Use NgFlowService.toObject() to serialize the current graph, store it in localStorage, and restore it later."
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
        <ng-flow-panel position="top-right">
          <div class="save-panel">
            <button class="save-panel__btn save-panel__btn--save" (click)="save()">Save</button>
            <button class="save-panel__btn" [disabled]="!hasSaved()" (click)="restore()">Restore</button>
            <button class="save-panel__btn" (click)="reset()">Reset</button>
            @if (status()) {
              <div class="save-panel__status">{{ status() }}</div>
            }
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
    .save-panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #ffffff;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
      min-width: 140px;
    }
    .save-panel__btn {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.1s, border-color 0.1s;
      font-family: inherit;
    }
    .save-panel__btn:hover:not(:disabled) {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .save-panel__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .save-panel__btn--save {
      background: #6366f1;
      color: #ffffff;
      border-color: #6366f1;
    }
    .save-panel__btn--save:hover:not(:disabled) {
      background: #4f46e5;
      border-color: #4f46e5;
    }
    .save-panel__status {
      font-size: 10px;
      color: #64748b;
      text-align: center;
      margin-top: 2px;
    }
  `],
})
export class SaveRestoreExampleComponent {
  private flow?: NgFlowService<Node, Edge>;
  readonly hasSaved = signal<boolean>(this.readStorage() !== null);
  readonly status = signal<string>('');

  private readonly initialNodes: Node[] = [
    { id: '1', type: 'input', position: { x: 100, y: 100 }, data: { label: 'A' } },
    { id: '2', position: { x: 300, y: 180 }, data: { label: 'B' } },
    { id: '3', position: { x: 500, y: 100 }, data: { label: 'C' } },
    { id: '4', type: 'output', position: { x: 400, y: 300 }, data: { label: 'D' } },
  ];

  private readonly initialEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
  ];

  nodes: Node[] = structuredClone(this.initialNodes);
  edges: Edge[] = structuredClone(this.initialEdges);

  onInit(service: NgFlowService<Node, Edge>): void {
    this.flow = service;
  }

  save(): void {
    if (!this.flow) return;
    const snapshot = this.flow.toObject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    this.hasSaved.set(true);
    this.flash('Saved to localStorage');
  }

  restore(): void {
    const raw = this.readStorage();
    if (!raw) return;
    this.nodes = raw.nodes;
    this.edges = raw.edges;
    if (raw.viewport && this.flow) {
      this.flow.setViewport(raw.viewport);
    }
    this.flash('Restored');
  }

  reset(): void {
    this.nodes = structuredClone(this.initialNodes);
    this.edges = structuredClone(this.initialEdges);
    this.flash('Reset to initial');
  }

  private readStorage(): PersistedFlow | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PersistedFlow) : null;
    } catch {
      return null;
    }
  }

  private flash(message: string): void {
    this.status.set(message);
    setTimeout(() => this.status.set(''), 1500);
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
}

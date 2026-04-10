import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  Type,
} from '@angular/core';
import {
  NgFlowComponent,
  NgFlowDropZoneDirective,
  NgFlowService,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type {
  Node,
  Edge,
  Connection,
  Viewport,
  XYPosition,
} from '@angflow/angular';
import { addEdge } from '@angflow/system';

import { ShowcaseColorNodeComponent } from './nodes/color-node.component';
import { ShowcaseFormNodeComponent } from './nodes/form-node.component';
import { ShowcaseResultNodeComponent } from './nodes/result-node.component';
import { NodePaletteComponent, type PaletteKind } from './node-palette.component';
import { InspectorPanelComponent } from './inspector-panel.component';
import { ShowcaseToolbarComponent } from './toolbar.component';
import { SimulationService } from './simulation.service';
import { layoutLayered } from './layout';

const STORAGE_KEY = 'angflow:showcase:state';

interface PersistedFlow {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
}

function seedNodes(): Node[] {
  return [
    {
      id: 'src',
      type: 'input',
      position: { x: 300, y: 0 },
      data: { label: 'API Request' },
    },
    {
      id: 'http',
      type: 'formNode',
      position: { x: 40, y: 150 },
      data: {
        title: 'HTTP Config',
        fields: [
          {
            name: 'method',
            label: 'Method',
            type: 'select',
            value: 'GET',
            options: [
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
            ],
          },
          { name: 'url', label: 'URL', type: 'text', value: 'https://api.example.com', placeholder: 'Enter URL...' },
          { name: 'timeout', label: 'Timeout (ms)', type: 'number', value: 5000, min: 0, max: 60000, step: 100 },
        ],
      },
    },
    {
      id: 'transform',
      type: 'formNode',
      position: { x: 400, y: 150 },
      data: {
        title: 'Transform',
        fields: [
          {
            name: 'format',
            label: 'Output Format',
            type: 'select',
            value: 'json',
            options: [
              { value: 'json', label: 'JSON' },
              { value: 'xml', label: 'XML' },
              { value: 'csv', label: 'CSV' },
            ],
          },
          { name: 'template', label: 'Template', type: 'textarea', value: '{{ data | json }}', placeholder: 'Enter template...' },
          { name: 'pretty', label: 'Options', type: 'checkbox', value: true, checkboxLabel: 'Pretty print' },
        ],
      },
    },
    {
      id: 'validate',
      type: 'formNode',
      position: { x: 220, y: 420 },
      data: {
        title: 'Validation',
        fields: [
          { name: 'schema', label: 'Schema Name', type: 'text', value: 'user-v2', placeholder: 'e.g. user-v2' },
          { name: 'strict', label: 'Mode', type: 'checkbox', value: false, checkboxLabel: 'Strict validation' },
          { name: 'maxErrors', label: 'Max Errors', type: 'number', value: 10, min: 1, max: 100 },
        ],
      },
    },
    {
      id: 'result',
      type: 'resultNode',
      position: { x: 300, y: 640 },
      data: { label: 'Output' },
    },
  ];
}

function seedEdges(): Edge[] {
  return [
    { id: 'e-src-http', source: 'src', target: 'http', animated: true },
    { id: 'e-src-transform', source: 'src', target: 'transform', animated: true },
    { id: 'e-http-validate', source: 'http', target: 'validate' },
    { id: 'e-transform-validate', source: 'transform', target: 'validate' },
    { id: 'e-validate-result', source: 'validate', target: 'result' },
  ];
}

@Component({
  selector: 'app-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    NgFlowDropZoneDirective,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    NodePaletteComponent,
    InspectorPanelComponent,
    ShowcaseToolbarComponent,
  ],
  template: `
    <div class="showcase">
      <app-showcase-toolbar
        [nodeCount]="nodes().length"
        [edgeCount]="edges().length"
        [hasSelection]="hasSelection()"
        [hasSaved]="hasSaved()"
        [isRunning]="isRunning()"
        (add)="onAdd()"
        (delete)="onDelete()"
        (layout)="onLayout()"
        (fit)="onFit()"
        (save)="onSave()"
        (restore)="onRestore()"
        (clear)="onClear()"
        (run)="onRun()"
      />
      <div class="showcase__body">
        <app-node-palette />
        <div class="showcase__canvas">
          <ng-flow
            ngFlowDropZone
            [nodes]="nodes()"
            [edges]="edges()"
            [nodeTypes]="nodeTypes"
            [colorMode]="'system'"
            [fitView]="true"
            [deleteKeyCode]="['Backspace', 'Delete']"
            (init)="onInit($event)"
            (nodesChange)="onNodesChange($event)"
            (edgesChange)="onEdgesChange($event)"
            (connect)="onConnect($event)"
            (nodeDrop)="onNodeDrop($event)"
            (selectionChange)="onSelectionChange($event)"
          >
            <ng-flow-background variant="dots" [gap]="22" [size]="1" />
            <ng-flow-controls />
            <ng-flow-minimap />
          </ng-flow>
          @if (nodes().length === 0) {
            <div class="showcase__empty">
              <div class="showcase__empty-title">Empty canvas</div>
              <div class="showcase__empty-hint">Drag a node from the palette to get started</div>
            </div>
          }
          @if (statusMessage()) {
            <div class="showcase__toast">{{ statusMessage() }}</div>
          }
        </div>
        <app-inspector-panel [flow]="flowService()" />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      flex-direction: column;

      /* Light mode defaults */
      --sc-accent: #6366f1;
      --sc-accent-hover: #4f46e5;
      --sc-chrome-bg: #ffffff;
      --sc-chrome-border: #e2e8f0;
      --sc-chrome-muted: #94a3b8;
      --sc-chrome-text: #0f172a;
      --sc-canvas-bg: #f1f5f9;
      --sc-field-bg: #f8fafc;
      --sc-node-bg: #ffffff;
      --sc-node-text: #0f172a;
      --sc-node-muted: #64748b;
      --sc-border: #e2e8f0;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --sc-accent: #818cf8;
        --sc-accent-hover: #a5b4fc;
        --sc-chrome-bg: #0f172a;
        --sc-chrome-border: #1e293b;
        --sc-chrome-muted: #64748b;
        --sc-chrome-text: #e2e8f0;
        --sc-canvas-bg: #020617;
        --sc-field-bg: #1e293b;
        --sc-node-bg: #1e293b;
        --sc-node-text: #e2e8f0;
        --sc-node-muted: #94a3b8;
        --sc-border: #334155;
      }
    }
    .showcase {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--sc-canvas-bg, #f1f5f9);
      color: var(--sc-chrome-text, #0f172a);
    }
    .showcase__body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .showcase__canvas {
      flex: 1;
      min-width: 0;
      position: relative;
      background: var(--sc-canvas-bg, #f1f5f9);
    }
    .showcase__empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      pointer-events: none;
      color: var(--sc-chrome-muted, #94a3b8);
    }
    .showcase__empty-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
      color: var(--sc-chrome-text, #0f172a);
    }
    .showcase__empty-hint {
      font-size: 13px;
    }
    .showcase__toast {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--sc-chrome-text, #0f172a);
      color: var(--sc-chrome-bg, #ffffff);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
      pointer-events: none;
      animation: sc-toast-in 0.2s ease-out;
    }
    @keyframes sc-toast-in {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `],
})
export class ShowcaseComponent {
  private sim = inject(SimulationService);
  private flow?: NgFlowService<Node, Edge>;
  private idCounter = 100;
  private statusTimeout?: ReturnType<typeof setTimeout>;

  readonly nodeTypes: Record<string, Type<unknown>> = {
    colorNode: ShowcaseColorNodeComponent,
    formNode: ShowcaseFormNodeComponent,
    resultNode: ShowcaseResultNodeComponent,
  };

  readonly nodes = signal<Node[]>(seedNodes());
  readonly edges = signal<Edge[]>(seedEdges());
  readonly hasSelection = signal<boolean>(false);
  readonly hasSaved = signal<boolean>(this.readStorage() !== null);
  readonly isRunning = signal<boolean>(false);
  readonly statusMessage = signal<string>('');
  readonly flowService = signal<NgFlowService<Node, Edge> | null>(null);

  readonly selectedNodeIds = computed<string[]>(() =>
    this.nodes().filter((n) => n.selected).map((n) => n.id)
  );

  onInit(service: NgFlowService<Node, Edge>): void {
    this.flow = service;
    this.flowService.set(service);
  }

  onNodesChange(changes: any[]): void {
    this.nodes.set(applyNodeChanges(changes, this.nodes()));
  }

  onEdgesChange(changes: any[]): void {
    this.edges.set(applyEdgeChanges(changes, this.edges()));
  }

  onConnect(connection: Connection): void {
    this.edges.set(addEdge(connection, this.edges()) as Edge[]);
  }

  onSelectionChange(event: { nodes: Node[]; edges: Edge[] }): void {
    this.hasSelection.set(event.nodes.length + event.edges.length > 0);
  }

  onNodeDrop(payload: { event: DragEvent; flowPosition: XYPosition; data: string | null }): void {
    if (!payload.data) return;
    let parsed: { kind: PaletteKind } | null = null;
    try {
      parsed = JSON.parse(payload.data) as { kind: PaletteKind };
    } catch {
      return;
    }
    if (!parsed) return;

    const newNode = this.makeNodeFromPalette(parsed.kind, payload.flowPosition);
    this.nodes.set([...this.nodes(), newNode]);
    this.flash(`Added ${parsed.kind} node`);
  }

  // ── Toolbar actions ─────────────────────────────────────────────────

  onAdd(): void {
    const id = this.nextId('node');
    const newNode: Node = {
      id,
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 120 },
      data: { label: 'New node' },
    };
    this.nodes.set([...this.nodes(), newNode]);
    this.flash('Added node');
  }

  async onDelete(): Promise<void> {
    if (!this.flow) return;
    const selected = this.nodes().filter((n) => n.selected);
    const selectedEdges = this.edges().filter((e) => e.selected);
    if (selected.length === 0 && selectedEdges.length === 0) return;
    await this.flow.deleteElements({ nodes: selected, edges: selectedEdges });
    this.flash(`Deleted ${selected.length + selectedEdges.length} element(s)`);
  }

  onLayout(): void {
    this.nodes.set(layoutLayered(this.nodes(), this.edges()));
    this.flash('Auto-layout applied');
    // Fit view after layout
    queueMicrotask(() => this.flow?.fitView({ duration: 400 }));
  }

  onFit(): void {
    this.flow?.fitView({ duration: 400 });
  }

  onSave(): void {
    if (!this.flow) return;
    const snapshot = this.flow.toObject();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      this.hasSaved.set(true);
      this.flash('Saved');
    } catch {
      this.flash('Save failed');
    }
  }

  onRestore(): void {
    const saved = this.readStorage();
    if (!saved) return;
    this.nodes.set(saved.nodes);
    this.edges.set(saved.edges);
    if (saved.viewport && this.flow) {
      this.flow.setViewport(saved.viewport);
    }
    this.flash('Restored');
  }

  onClear(): void {
    if (this.nodes().length === 0 && this.edges().length === 0) return;
    if (!confirm('Clear all nodes and edges?')) return;
    this.nodes.set([]);
    this.edges.set([]);
    this.flash('Cleared');
  }

  async onRun(): Promise<void> {
    if (!this.flow) return;
    if (this.isRunning()) return;
    this.isRunning.set(true);
    try {
      await this.sim.run(this.flow, this.nodes(), this.edges());
      this.flash('Run complete');
    } catch (err) {
      this.flash((err as Error).message);
      this.sim.clearState(this.flow, this.nodes());
    } finally {
      this.isRunning.set(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private makeNodeFromPalette(kind: PaletteKind, position: XYPosition): Node {
    const id = this.nextId(kind);
    switch (kind) {
      case 'httpRequest':
        return {
          id,
          type: 'formNode',
          position,
          data: {
            title: 'HTTP Request',
            fields: [
              {
                name: 'method',
                label: 'Method',
                type: 'select',
                value: 'GET',
                options: [
                  { value: 'GET', label: 'GET' },
                  { value: 'POST', label: 'POST' },
                ],
              },
              { name: 'url', label: 'URL', type: 'text', value: '', placeholder: 'https://…' },
            ],
          },
        };
      case 'transform':
        return {
          id,
          type: 'formNode',
          position,
          data: {
            title: 'Transform',
            fields: [
              { name: 'template', label: 'Template', type: 'textarea', value: '', placeholder: '{{ data | json }}' },
            ],
          },
        };
      case 'validate':
        return {
          id,
          type: 'formNode',
          position,
          data: {
            title: 'Validate',
            fields: [
              { name: 'schema', label: 'Schema', type: 'text', value: '', placeholder: 'schema name' },
              { name: 'strict', label: 'Mode', type: 'checkbox', value: false, checkboxLabel: 'Strict' },
            ],
          },
        };
      case 'result':
        return {
          id,
          type: 'resultNode',
          position,
          data: { label: 'Result' },
        };
    }
  }

  private nextId(prefix: string): string {
    return `${prefix}-${++this.idCounter}`;
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
    this.statusMessage.set(message);
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => this.statusMessage.set(''), 1800);
  }
}

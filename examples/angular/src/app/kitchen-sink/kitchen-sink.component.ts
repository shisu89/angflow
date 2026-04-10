import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  Type,
} from '@angular/core';
import {
  NgFlowComponent,
  NgFlowService,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  EdgeToolbarComponent,
  ViewportPortalComponent,
  ConnectionMode,
  ConnectionLineType,
  PanOnScrollMode,
  SelectionMode,
  infiniteExtent,
  applyNodeChanges,
  applyEdgeChanges,
  type BackgroundVariant,
} from '@angflow/angular';
import type {
  Node,
  Edge,
  Connection,
  ColorMode,
  CoordinateExtent,
  NodeOrigin,
  SnapGrid,
  IsValidConnection,
  ZIndexMode,
  PanelPosition,
} from '@angflow/angular';
import { addEdge } from '@angflow/system';

import { AccordionSectionComponent } from './accordion-section.component';
import { EventLogComponent, type EventEntry } from './event-log.component';
import { KitchenSinkRichNodeComponent } from './nodes';
import { seedNodes, seedEdges, EDGE_TOOLBAR_EDGE_ID } from './seed-graph';
import { layoutLR, layoutTB, layoutRadial } from './layouts';

// ── Settings ─────────────────────────────────────────────────────────

type TranslateExtentPreset = 'infinite' | 'bounded';
type NodeOriginPreset = 'top-left' | 'center' | 'bottom-right';

interface KitchenSinkSettings {
  // Interaction
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  nodesFocusable: boolean;
  edgesFocusable: boolean;
  edgesReconnectable: boolean;
  elementsSelectable: boolean;
  selectNodesOnDrag: boolean;
  connectOnClick: boolean;
  autoPanOnNodeDrag: boolean;
  autoPanOnConnect: boolean;
  autoPanSpeed: number;
  nodeDragThreshold: number;
  connectionDragThreshold: number;

  // Viewport
  panOnDrag: boolean;
  panOnScroll: boolean;
  panOnScrollMode: PanOnScrollMode;
  panOnScrollSpeed: number;
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  zoomOnDoubleClick: boolean;
  preventScrolling: boolean;
  minZoom: number;
  maxZoom: number;
  translateExtentPreset: TranslateExtentPreset;
  nodeExtentPreset: TranslateExtentPreset;
  fitViewOnLoad: boolean;
  snapToGrid: boolean;
  snapGridX: number;
  snapGridY: number;

  // Behavior
  connectionMode: ConnectionMode;
  connectionLineType: ConnectionLineType;
  connectionRadius: number;
  reconnectRadius: number;
  paneClickDistance: number;
  nodeClickDistance: number;
  onlyRenderVisibleElements: boolean;
  nodeOriginPreset: NodeOriginPreset;
  isValidConnectionEnabled: boolean;
  debug: boolean;

  // Appearance
  colorMode: ColorMode;
  defaultMarkerColor: string;
  elevateNodesOnSelect: boolean;
  elevateEdgesOnSelect: boolean;
  zIndexMode: ZIndexMode;
  backgroundVariant: BackgroundVariant;

  // Selection
  selectionOnDrag: boolean;
  selectionMode: SelectionMode;

  // Keyboard
  deleteKeyCode: string;
  selectionKeyCode: string;
  panActivationKeyCode: string;
  multiSelectionKeyCode: string;
  zoomActivationKeyCode: string;
  disableKeyboardA11y: boolean;

  // Plugins
  showBackground: boolean;
  showControls: boolean;
  showMiniMap: boolean;
  miniMapPosition: PanelPosition;
  showPanel: boolean;
  showNodeToolbar: boolean;
  showEdgeToolbar: boolean;
  showNodeResizer: boolean;
  showViewportPortal: boolean;
  hideAttribution: boolean;
}

const BOUNDED_EXTENT: CoordinateExtent = [
  [-2000, -2000],
  [2000, 2000],
];

const DEFAULTS: KitchenSinkSettings = {
  // Interaction
  nodesDraggable: true,
  nodesConnectable: true,
  nodesFocusable: true,
  edgesFocusable: true,
  edgesReconnectable: true,
  elementsSelectable: true,
  selectNodesOnDrag: true,
  connectOnClick: true,
  autoPanOnNodeDrag: true,
  autoPanOnConnect: true,
  autoPanSpeed: 15,
  nodeDragThreshold: 1,
  connectionDragThreshold: 1,
  // Viewport
  panOnDrag: true,
  panOnScroll: false,
  panOnScrollMode: PanOnScrollMode.Free,
  panOnScrollSpeed: 0.5,
  zoomOnScroll: true,
  zoomOnPinch: true,
  zoomOnDoubleClick: true,
  preventScrolling: true,
  minZoom: 0.5,
  maxZoom: 2,
  translateExtentPreset: 'infinite',
  nodeExtentPreset: 'infinite',
  fitViewOnLoad: true,
  snapToGrid: false,
  snapGridX: 15,
  snapGridY: 15,
  // Behavior
  connectionMode: ConnectionMode.Strict,
  connectionLineType: ConnectionLineType.Bezier,
  connectionRadius: 20,
  reconnectRadius: 10,
  paneClickDistance: 0,
  nodeClickDistance: 0,
  onlyRenderVisibleElements: false,
  nodeOriginPreset: 'top-left',
  isValidConnectionEnabled: false,
  debug: false,
  // Appearance
  colorMode: 'system',
  defaultMarkerColor: '#b1b1b7',
  elevateNodesOnSelect: true,
  elevateEdgesOnSelect: false,
  zIndexMode: 'basic',
  backgroundVariant: 'dots',
  // Selection
  selectionOnDrag: false,
  selectionMode: SelectionMode.Full,
  // Keyboard
  deleteKeyCode: 'Backspace,Delete',
  selectionKeyCode: 'Shift',
  panActivationKeyCode: ' ',
  multiSelectionKeyCode: 'Meta,Control',
  zoomActivationKeyCode: 'Meta',
  disableKeyboardA11y: false,
  // Plugins
  showBackground: true,
  showControls: true,
  showMiniMap: true,
  miniMapPosition: 'bottom-right',
  showPanel: true,
  showNodeToolbar: true,
  showEdgeToolbar: true,
  showNodeResizer: true,
  showViewportPortal: true,
  hideAttribution: false,
};

// Category groupings for non-default counting
const CATEGORY_KEYS: Record<string, (keyof KitchenSinkSettings)[]> = {
  Interaction: [
    'nodesDraggable', 'nodesConnectable', 'nodesFocusable', 'edgesFocusable',
    'edgesReconnectable', 'elementsSelectable', 'selectNodesOnDrag', 'connectOnClick',
    'autoPanOnNodeDrag', 'autoPanOnConnect', 'autoPanSpeed', 'nodeDragThreshold',
    'connectionDragThreshold',
  ],
  Viewport: [
    'panOnDrag', 'panOnScroll', 'panOnScrollMode', 'panOnScrollSpeed',
    'zoomOnScroll', 'zoomOnPinch', 'zoomOnDoubleClick', 'preventScrolling',
    'minZoom', 'maxZoom', 'translateExtentPreset', 'nodeExtentPreset',
    'fitViewOnLoad', 'snapToGrid', 'snapGridX', 'snapGridY',
  ],
  Behavior: [
    'connectionMode', 'connectionLineType', 'connectionRadius', 'reconnectRadius',
    'paneClickDistance', 'nodeClickDistance', 'onlyRenderVisibleElements',
    'nodeOriginPreset', 'isValidConnectionEnabled', 'debug',
  ],
  Appearance: [
    'colorMode', 'defaultMarkerColor', 'elevateNodesOnSelect', 'elevateEdgesOnSelect',
    'zIndexMode', 'backgroundVariant',
  ],
  Selection: ['selectionOnDrag', 'selectionMode'],
  Keyboard: [
    'deleteKeyCode', 'selectionKeyCode', 'panActivationKeyCode',
    'multiSelectionKeyCode', 'zoomActivationKeyCode', 'disableKeyboardA11y',
  ],
  Plugins: [
    'showBackground', 'showControls', 'showMiniMap', 'miniMapPosition',
    'showPanel', 'showNodeToolbar', 'showEdgeToolbar', 'showNodeResizer',
    'showViewportPortal', 'hideAttribution',
  ],
};

function parseKeyCode(raw: string): string | string[] {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0] : parts;
}

@Component({
  selector: 'app-kitchen-sink',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    EdgeToolbarComponent,
    ViewportPortalComponent,
    AccordionSectionComponent,
    EventLogComponent,
  ],
  template: `
    <div class="ks">
      <div class="ks__canvas">
        <ng-flow
          [nodes]="nodes()"
          [edges]="edges()"
          [nodeTypes]="nodeTypes"
          [nodesDraggable]="settings().nodesDraggable"
          [nodesConnectable]="settings().nodesConnectable"
          [nodesFocusable]="settings().nodesFocusable"
          [edgesFocusable]="settings().edgesFocusable"
          [edgesReconnectable]="settings().edgesReconnectable"
          [elementsSelectable]="settings().elementsSelectable"
          [selectNodesOnDrag]="settings().selectNodesOnDrag"
          [connectOnClick]="settings().connectOnClick"
          [autoPanOnNodeDrag]="settings().autoPanOnNodeDrag"
          [autoPanOnConnect]="settings().autoPanOnConnect"
          [autoPanSpeed]="settings().autoPanSpeed"
          [nodeDragThreshold]="settings().nodeDragThreshold"
          [connectionDragThreshold]="settings().connectionDragThreshold"
          [panOnDrag]="settings().panOnDrag"
          [panOnScroll]="settings().panOnScroll"
          [panOnScrollMode]="settings().panOnScrollMode"
          [panOnScrollSpeed]="settings().panOnScrollSpeed"
          [zoomOnScroll]="settings().zoomOnScroll"
          [zoomOnPinch]="settings().zoomOnPinch"
          [zoomOnDoubleClick]="settings().zoomOnDoubleClick"
          [preventScrolling]="settings().preventScrolling"
          [minZoom]="settings().minZoom"
          [maxZoom]="settings().maxZoom"
          [translateExtent]="computedTranslateExtent()"
          [nodeExtent]="computedNodeExtent()"
          [fitView]="settings().fitViewOnLoad"
          [snapToGrid]="settings().snapToGrid"
          [snapGrid]="computedSnapGrid()"
          [connectionMode]="settings().connectionMode"
          [connectionLineType]="settings().connectionLineType"
          [connectionRadius]="settings().connectionRadius"
          [reconnectRadius]="settings().reconnectRadius"
          [paneClickDistance]="settings().paneClickDistance"
          [nodeClickDistance]="settings().nodeClickDistance"
          [onlyRenderVisibleElements]="settings().onlyRenderVisibleElements"
          [nodeOrigin]="computedNodeOrigin()"
          [isValidConnection]="computedIsValidConnection()"
          [debug]="settings().debug"
          [colorMode]="settings().colorMode"
          [defaultMarkerColor]="settings().defaultMarkerColor"
          [elevateNodesOnSelect]="settings().elevateNodesOnSelect"
          [elevateEdgesOnSelect]="settings().elevateEdgesOnSelect"
          [zIndexMode]="settings().zIndexMode"
          [selectionOnDrag]="settings().selectionOnDrag"
          [selectionMode]="settings().selectionMode"
          [deleteKeyCode]="computedDeleteKeyCode()"
          [selectionKeyCode]="computedSelectionKeyCode()"
          [panActivationKeyCode]="computedPanActivationKeyCode()"
          [multiSelectionKeyCode]="computedMultiSelectionKeyCode()"
          [zoomActivationKeyCode]="computedZoomActivationKeyCode()"
          [disableKeyboardA11y]="settings().disableKeyboardA11y"
          [hideAttribution]="settings().hideAttribution"
          (nodesChange)="onNodesChange($event)"
          (edgesChange)="onEdgesChange($event)"
          (connect)="onConnect($event)"
          (init)="onFlowInit($event)"
          (nodeClick)="logEvent('nodeClick', $event.node.id)"
          (nodeDoubleClick)="logEvent('nodeDoubleClick', $event.node.id)"
          (nodeContextMenu)="logEvent('nodeContextMenu', $event.node.id)"
          (edgeClick)="logEvent('edgeClick', $event.edge.id)"
          (edgeDoubleClick)="logEvent('edgeDoubleClick', $event.edge.id)"
          (edgeContextMenu)="logEvent('edgeContextMenu', $event.edge.id)"
          (nodeDragStart)="logEvent('nodeDragStart', $event.node.id)"
          (nodeDragStop)="logEvent('nodeDragStop', $event.node.id)"
          (selectionChange)="onSelectionChange($event)"
          (selectionStart)="logEvent('selectionStart', '')"
          (selectionEnd)="logEvent('selectionEnd', '')"
          (move)="onMove($event)"
          (moveStart)="logEvent('moveStart', formatViewport($event.viewport))"
          (moveEnd)="logEvent('moveEnd', formatViewport($event.viewport))"
          (viewportChange)="onViewportChange($any($event))"
          (paneClick)="logEvent('paneClick', '')"
          (paneContextMenu)="logEvent('paneContextMenu', '')"
          (reconnect)="logEvent('reconnect', $event.edge.id)"
          (nodesDelete)="logEvent('nodesDelete', $event.length + ' nodes')"
          (edgesDelete)="logEvent('edgesDelete', $event.length + ' edges')"
          (delete)="onDeleteEvent($any($event))"
          (error)="logEvent('error', $event.message)"
        >
          @if (settings().showBackground) {
            <ng-flow-background [variant]="settings().backgroundVariant" [gap]="22" [size]="1" />
          }
          @if (settings().showControls) {
            <ng-flow-controls />
          }
          @if (settings().showMiniMap) {
            <ng-flow-minimap [position]="settings().miniMapPosition" />
          }
          @if (settings().showEdgeToolbar) {
            <ng-flow-edge-toolbar
              [edgeId]="edgeToolbarId"
              [x]="edgeToolbarPos().x"
              [y]="edgeToolbarPos().y"
            >
              <div class="ks-edge-toolbar">
                <button type="button">edit</button>
                <button type="button">remove</button>
              </div>
            </ng-flow-edge-toolbar>
          }
          @if (settings().showViewportPortal) {
            <ng-flow-viewport-portal>
              <div class="ks-portal-marker" style="transform: translate(880px, 40px);">
                Viewport portal · flow (880, 40)
              </div>
            </ng-flow-viewport-portal>
          }
          @if (settings().showPanel) {
            <ng-flow-panel position="bottom-center">
              <app-event-log
                [events]="loggedEvents()"
                [paused]="eventLogPaused()"
                [expanded]="eventLogExpanded()"
                (clear)="clearEvents()"
                (togglePause)="eventLogPaused.set(!eventLogPaused())"
                (toggleExpanded)="eventLogExpanded.set(!eventLogExpanded())"
              />
            </ng-flow-panel>
          }
        </ng-flow>
      </div>

      <aside class="ks__drawer" [class.is-closed]="!drawerOpen()">
        <button
          type="button"
          class="ks__drawer-toggle"
          (click)="drawerOpen.set(!drawerOpen())"
          [title]="drawerOpen() ? 'Close controls' : 'Open controls'"
        >
          {{ drawerOpen() ? '›' : '‹' }}
        </button>

        @if (drawerOpen()) {
          <div class="ks__drawer-content">
            <div class="ks__drawer-header">
              <div>
                <div class="ks__drawer-title">Controls</div>
                <div class="ks__drawer-subtitle">
                  {{ totalNonDefaults() }} non-default
                </div>
              </div>
              <button type="button" class="ks__reset" (click)="resetDefaults()">
                Reset
              </button>
            </div>

            <div class="ks__drawer-body">
              <!-- Interaction -->
              <app-accordion-section
                title="Interaction"
                [open]="isOpen('Interaction')"
                [nonDefaultCount]="nonDefaultCount('Interaction')"
                (toggle)="toggleSection('Interaction')"
              >
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">nodesDraggable</span>
                  <input type="checkbox" [checked]="settings().nodesDraggable" (change)="set('nodesDraggable', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">nodesConnectable</span>
                  <input type="checkbox" [checked]="settings().nodesConnectable" (change)="set('nodesConnectable', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">nodesFocusable</span>
                  <input type="checkbox" [checked]="settings().nodesFocusable" (change)="set('nodesFocusable', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">edgesFocusable</span>
                  <input type="checkbox" [checked]="settings().edgesFocusable" (change)="set('edgesFocusable', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">edgesReconnectable</span>
                  <input type="checkbox" [checked]="settings().edgesReconnectable" (change)="set('edgesReconnectable', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">elementsSelectable</span>
                  <input type="checkbox" [checked]="settings().elementsSelectable" (change)="set('elementsSelectable', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">selectNodesOnDrag</span>
                  <input type="checkbox" [checked]="settings().selectNodesOnDrag" (change)="set('selectNodesOnDrag', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">connectOnClick</span>
                  <input type="checkbox" [checked]="settings().connectOnClick" (change)="set('connectOnClick', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">autoPanOnNodeDrag</span>
                  <input type="checkbox" [checked]="settings().autoPanOnNodeDrag" (change)="set('autoPanOnNodeDrag', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">autoPanOnConnect</span>
                  <input type="checkbox" [checked]="settings().autoPanOnConnect" (change)="set('autoPanOnConnect', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">autoPanSpeed ({{ settings().autoPanSpeed }})</span>
                  <input type="range" min="1" max="50" [value]="settings().autoPanSpeed" (input)="set('autoPanSpeed', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">nodeDragThreshold ({{ settings().nodeDragThreshold }})</span>
                  <input type="range" min="0" max="20" [value]="settings().nodeDragThreshold" (input)="set('nodeDragThreshold', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">connectionDragThreshold ({{ settings().connectionDragThreshold }})</span>
                  <input type="range" min="0" max="20" [value]="settings().connectionDragThreshold" (input)="set('connectionDragThreshold', +$any($event.target).value)" />
                </div>
              </app-accordion-section>

              <!-- Viewport -->
              <app-accordion-section
                title="Viewport"
                [open]="isOpen('Viewport')"
                [nonDefaultCount]="nonDefaultCount('Viewport')"
                (toggle)="toggleSection('Viewport')"
              >
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">panOnDrag</span>
                  <input type="checkbox" [checked]="settings().panOnDrag" (change)="set('panOnDrag', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">panOnScroll</span>
                  <input type="checkbox" [checked]="settings().panOnScroll" (change)="set('panOnScroll', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">panOnScrollMode</span>
                  <select [value]="settings().panOnScrollMode" (change)="set('panOnScrollMode', $any($event.target).value)">
                    <option [value]="'free'">Free</option>
                    <option [value]="'vertical'">Vertical</option>
                    <option [value]="'horizontal'">Horizontal</option>
                  </select>
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">panOnScrollSpeed ({{ settings().panOnScrollSpeed }})</span>
                  <input type="range" min="0.1" max="2" step="0.1" [value]="settings().panOnScrollSpeed" (input)="set('panOnScrollSpeed', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">zoomOnScroll</span>
                  <input type="checkbox" [checked]="settings().zoomOnScroll" (change)="set('zoomOnScroll', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">zoomOnPinch</span>
                  <input type="checkbox" [checked]="settings().zoomOnPinch" (change)="set('zoomOnPinch', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">zoomOnDoubleClick</span>
                  <input type="checkbox" [checked]="settings().zoomOnDoubleClick" (change)="set('zoomOnDoubleClick', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">preventScrolling</span>
                  <input type="checkbox" [checked]="settings().preventScrolling" (change)="set('preventScrolling', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">minZoom ({{ settings().minZoom }})</span>
                  <input type="range" min="0.1" max="1" step="0.05" [value]="settings().minZoom" (input)="set('minZoom', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">maxZoom ({{ settings().maxZoom }})</span>
                  <input type="range" min="1" max="8" step="0.25" [value]="settings().maxZoom" (input)="set('maxZoom', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">translateExtent</span>
                  <select [value]="settings().translateExtentPreset" (change)="set('translateExtentPreset', $any($event.target).value)">
                    <option [value]="'infinite'">infinite</option>
                    <option [value]="'bounded'">bounded (±2000)</option>
                  </select>
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">nodeExtent</span>
                  <select [value]="settings().nodeExtentPreset" (change)="set('nodeExtentPreset', $any($event.target).value)">
                    <option [value]="'infinite'">infinite</option>
                    <option [value]="'bounded'">bounded (±2000)</option>
                  </select>
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">fitView (on load)</span>
                  <input type="checkbox" [checked]="settings().fitViewOnLoad" (change)="set('fitViewOnLoad', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">snapToGrid</span>
                  <input type="checkbox" [checked]="settings().snapToGrid" (change)="set('snapToGrid', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--pair">
                  <span class="ctrl__label">snapGrid (x, y)</span>
                  <div class="ctrl__pair">
                    <input type="number" [value]="settings().snapGridX" (input)="set('snapGridX', +$any($event.target).value)" />
                    <input type="number" [value]="settings().snapGridY" (input)="set('snapGridY', +$any($event.target).value)" />
                  </div>
                </div>
              </app-accordion-section>

              <!-- Behavior -->
              <app-accordion-section
                title="Behavior"
                [open]="isOpen('Behavior')"
                [nonDefaultCount]="nonDefaultCount('Behavior')"
                (toggle)="toggleSection('Behavior')"
              >
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">connectionMode</span>
                  <select [value]="settings().connectionMode" (change)="set('connectionMode', $any($event.target).value)">
                    <option [value]="'strict'">Strict</option>
                    <option [value]="'loose'">Loose</option>
                  </select>
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">connectionLineType</span>
                  <select [value]="settings().connectionLineType" (change)="set('connectionLineType', $any($event.target).value)">
                    <option [value]="'default'">default (bezier)</option>
                    <option [value]="'bezier'">bezier</option>
                    <option [value]="'straight'">straight</option>
                    <option [value]="'step'">step</option>
                    <option [value]="'smoothstep'">smoothstep</option>
                    <option [value]="'simplebezier'">simplebezier</option>
                  </select>
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">connectionRadius ({{ settings().connectionRadius }})</span>
                  <input type="range" min="5" max="80" [value]="settings().connectionRadius" (input)="set('connectionRadius', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">reconnectRadius ({{ settings().reconnectRadius }})</span>
                  <input type="range" min="5" max="40" [value]="settings().reconnectRadius" (input)="set('reconnectRadius', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">paneClickDistance ({{ settings().paneClickDistance }})</span>
                  <input type="range" min="0" max="20" [value]="settings().paneClickDistance" (input)="set('paneClickDistance', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--slider">
                  <span class="ctrl__label">nodeClickDistance ({{ settings().nodeClickDistance }})</span>
                  <input type="range" min="0" max="20" [value]="settings().nodeClickDistance" (input)="set('nodeClickDistance', +$any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">onlyRenderVisibleElements</span>
                  <input type="checkbox" [checked]="settings().onlyRenderVisibleElements" (change)="set('onlyRenderVisibleElements', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">nodeOrigin</span>
                  <select [value]="settings().nodeOriginPreset" (change)="set('nodeOriginPreset', $any($event.target).value)">
                    <option [value]="'top-left'">top-left [0, 0]</option>
                    <option [value]="'center'">center [0.5, 0.5]</option>
                    <option [value]="'bottom-right'">bottom-right [1, 1]</option>
                  </select>
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">isValidConnection (no self-loops demo)</span>
                  <input type="checkbox" [checked]="settings().isValidConnectionEnabled" (change)="set('isValidConnectionEnabled', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">debug</span>
                  <input type="checkbox" [checked]="settings().debug" (change)="set('debug', $any($event.target).checked)" />
                </div>
              </app-accordion-section>

              <!-- Appearance -->
              <app-accordion-section
                title="Appearance"
                [open]="isOpen('Appearance')"
                [nonDefaultCount]="nonDefaultCount('Appearance')"
                (toggle)="toggleSection('Appearance')"
              >
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">colorMode</span>
                  <select [value]="settings().colorMode" (change)="set('colorMode', $any($event.target).value)">
                    <option [value]="'light'">light</option>
                    <option [value]="'dark'">dark</option>
                    <option [value]="'system'">system</option>
                  </select>
                </div>
                <div class="ctrl ctrl--color">
                  <span class="ctrl__label">defaultMarkerColor</span>
                  <input type="color" [value]="settings().defaultMarkerColor" (input)="set('defaultMarkerColor', $any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">elevateNodesOnSelect</span>
                  <input type="checkbox" [checked]="settings().elevateNodesOnSelect" (change)="set('elevateNodesOnSelect', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">elevateEdgesOnSelect</span>
                  <input type="checkbox" [checked]="settings().elevateEdgesOnSelect" (change)="set('elevateEdgesOnSelect', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">zIndexMode</span>
                  <select [value]="settings().zIndexMode" (change)="set('zIndexMode', $any($event.target).value)">
                    <option [value]="'basic'">basic</option>
                    <option [value]="'elevateOnSelect'">elevateOnSelect</option>
                  </select>
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">background variant</span>
                  <select [value]="settings().backgroundVariant" (change)="set('backgroundVariant', $any($event.target).value)">
                    <option [value]="'dots'">dots</option>
                    <option [value]="'lines'">lines</option>
                    <option [value]="'cross'">cross</option>
                  </select>
                </div>
              </app-accordion-section>

              <!-- Selection -->
              <app-accordion-section
                title="Selection"
                [open]="isOpen('Selection')"
                [nonDefaultCount]="nonDefaultCount('Selection')"
                (toggle)="toggleSection('Selection')"
              >
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">selectionOnDrag</span>
                  <input type="checkbox" [checked]="settings().selectionOnDrag" (change)="set('selectionOnDrag', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">selectionMode</span>
                  <select [value]="settings().selectionMode" (change)="set('selectionMode', $any($event.target).value)">
                    <option [value]="'full'">Full</option>
                    <option [value]="'partial'">Partial</option>
                  </select>
                </div>
              </app-accordion-section>

              <!-- Keyboard -->
              <app-accordion-section
                title="Keyboard"
                [open]="isOpen('Keyboard')"
                [nonDefaultCount]="nonDefaultCount('Keyboard')"
                (toggle)="toggleSection('Keyboard')"
              >
                <div class="ctrl ctrl--text">
                  <span class="ctrl__label">deleteKeyCode (comma-sep)</span>
                  <input type="text" [value]="settings().deleteKeyCode" (input)="set('deleteKeyCode', $any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--text">
                  <span class="ctrl__label">selectionKeyCode</span>
                  <input type="text" [value]="settings().selectionKeyCode" (input)="set('selectionKeyCode', $any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--text">
                  <span class="ctrl__label">panActivationKeyCode</span>
                  <input type="text" [value]="settings().panActivationKeyCode" (input)="set('panActivationKeyCode', $any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--text">
                  <span class="ctrl__label">multiSelectionKeyCode</span>
                  <input type="text" [value]="settings().multiSelectionKeyCode" (input)="set('multiSelectionKeyCode', $any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--text">
                  <span class="ctrl__label">zoomActivationKeyCode</span>
                  <input type="text" [value]="settings().zoomActivationKeyCode" (input)="set('zoomActivationKeyCode', $any($event.target).value)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">disableKeyboardA11y</span>
                  <input type="checkbox" [checked]="settings().disableKeyboardA11y" (change)="set('disableKeyboardA11y', $any($event.target).checked)" />
                </div>
              </app-accordion-section>

              <!-- Layout (action buttons, not toggles) -->
              <app-accordion-section
                title="Layout"
                [open]="isOpen('Layout')"
                [nonDefaultCount]="0"
                (toggle)="toggleSection('Layout')"
              >
                <div class="ctrl ctrl--actions">
                  <button type="button" (click)="applyLayout('LR')">Layout LR</button>
                  <button type="button" (click)="applyLayout('TB')">Layout TB</button>
                  <button type="button" (click)="applyLayout('Radial')">Radial</button>
                  <button type="button" (click)="triggerFitView()">Fit view</button>
                </div>
              </app-accordion-section>

              <!-- Plugins -->
              <app-accordion-section
                title="Plugins"
                [open]="isOpen('Plugins')"
                [nonDefaultCount]="nonDefaultCount('Plugins')"
                (toggle)="toggleSection('Plugins')"
              >
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">Background</span>
                  <input type="checkbox" [checked]="settings().showBackground" (change)="set('showBackground', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">Controls</span>
                  <input type="checkbox" [checked]="settings().showControls" (change)="set('showControls', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">MiniMap</span>
                  <input type="checkbox" [checked]="settings().showMiniMap" (change)="set('showMiniMap', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--select">
                  <span class="ctrl__label">MiniMap position</span>
                  <select [value]="settings().miniMapPosition" (change)="set('miniMapPosition', $any($event.target).value)">
                    <option [value]="'top-left'">top-left</option>
                    <option [value]="'top-right'">top-right</option>
                    <option [value]="'bottom-left'">bottom-left</option>
                    <option [value]="'bottom-right'">bottom-right</option>
                  </select>
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">Panel (event log)</span>
                  <input type="checkbox" [checked]="settings().showPanel" (change)="set('showPanel', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">NodeToolbar</span>
                  <input type="checkbox" [checked]="settings().showNodeToolbar" (change)="set('showNodeToolbar', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">EdgeToolbar</span>
                  <input type="checkbox" [checked]="settings().showEdgeToolbar" (change)="set('showEdgeToolbar', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">NodeResizer</span>
                  <input type="checkbox" [checked]="settings().showNodeResizer" (change)="set('showNodeResizer', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">ViewportPortal</span>
                  <input type="checkbox" [checked]="settings().showViewportPortal" (change)="set('showViewportPortal', $any($event.target).checked)" />
                </div>
                <div class="ctrl ctrl--switch">
                  <span class="ctrl__label">hideAttribution</span>
                  <input type="checkbox" [checked]="settings().hideAttribution" (change)="set('hideAttribution', $any($event.target).checked)" />
                </div>
              </app-accordion-section>
            </div>
          </div>
        }
      </aside>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;

      /* Light defaults */
      --ks-accent: #6366f1;
      --ks-chrome-bg: #ffffff;
      --ks-border: #e2e8f0;
      --ks-border-subtle: #f1f5f9;
      --ks-muted: #94a3b8;
      --ks-text: #0f172a;
      --ks-canvas-bg: #f1f5f9;
      --ks-field-bg: #f8fafc;
      --ks-node-bg: #ffffff;
      --ks-node-text: #0f172a;
      --ks-node-muted: #64748b;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --ks-accent: #818cf8;
        --ks-chrome-bg: #0f172a;
        --ks-border: #1e293b;
        --ks-border-subtle: #172034;
        --ks-muted: #64748b;
        --ks-text: #e2e8f0;
        --ks-canvas-bg: #020617;
        --ks-field-bg: #1e293b;
        --ks-node-bg: #1e293b;
        --ks-node-text: #e2e8f0;
        --ks-node-muted: #94a3b8;
      }
    }
    .ks {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      background: var(--ks-canvas-bg);
    }
    .ks__canvas {
      flex: 1;
      min-width: 0;
      position: relative;
    }
    .ks__drawer {
      position: relative;
      width: 320px;
      flex-shrink: 0;
      background: var(--ks-chrome-bg);
      border-left: 1px solid var(--ks-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s ease;
    }
    .ks__drawer.is-closed {
      width: 32px;
    }
    .ks__drawer-toggle {
      position: absolute;
      top: 12px;
      left: 6px;
      width: 20px;
      height: 20px;
      background: var(--ks-accent);
      color: #ffffff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      z-index: 10;
    }
    .ks__drawer-content {
      padding: 12px 0 0 34px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }
    .ks__drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0 14px 12px;
      border-bottom: 1px solid var(--ks-border);
    }
    .ks__drawer-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--ks-text);
    }
    .ks__drawer-subtitle {
      font-size: 10px;
      color: var(--ks-muted);
      margin-top: 2px;
    }
    .ks__reset {
      padding: 5px 12px;
      background: transparent;
      border: 1px solid var(--ks-border);
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--ks-text);
      cursor: pointer;
      font-family: inherit;
    }
    .ks__reset:hover {
      background: var(--ks-field-bg);
    }
    .ks__drawer-body {
      flex: 1;
      overflow-y: auto;
    }

    .ctrl {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--ks-text);
      min-height: 22px;
    }
    .ctrl__label {
      flex: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10.5px;
      color: var(--ks-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ctrl input[type="checkbox"] {
      accent-color: var(--ks-accent);
      cursor: pointer;
    }
    .ctrl input[type="range"] {
      width: 120px;
      accent-color: var(--ks-accent);
    }
    .ctrl--slider .ctrl__label {
      font-variant-numeric: tabular-nums;
    }
    .ctrl select,
    .ctrl input[type="text"],
    .ctrl input[type="number"],
    .ctrl input[type="color"] {
      padding: 3px 6px;
      background: var(--ks-field-bg);
      border: 1px solid var(--ks-border);
      border-radius: 4px;
      font-size: 10.5px;
      color: var(--ks-text);
      font-family: inherit;
      min-width: 0;
      max-width: 130px;
    }
    .ctrl input[type="color"] {
      padding: 0;
      width: 30px;
      height: 22px;
      cursor: pointer;
    }
    .ctrl__pair {
      display: flex;
      gap: 4px;
    }
    .ctrl__pair input {
      width: 54px;
    }
    .ctrl--actions {
      flex-wrap: wrap;
      gap: 4px;
    }
    .ctrl--actions button {
      padding: 5px 10px;
      background: var(--ks-field-bg);
      border: 1px solid var(--ks-border);
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--ks-text);
      cursor: pointer;
      font-family: inherit;
    }
    .ctrl--actions button:hover {
      background: var(--ks-chrome-bg);
      border-color: var(--ks-accent);
    }

    .ks-edge-toolbar {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--ks-chrome-bg);
      border: 1px solid var(--ks-border);
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
    }
    .ks-edge-toolbar button {
      padding: 3px 8px;
      background: transparent;
      border: none;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      color: var(--ks-text);
      cursor: pointer;
      font-family: inherit;
    }
    .ks-edge-toolbar button:hover {
      background: var(--ks-field-bg);
    }
    .ks-portal-marker {
      position: absolute;
      top: 0;
      left: 0;
      padding: 6px 12px;
      background: var(--ks-accent);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      pointer-events: none;
    }
  `],
})
export class KitchenSinkComponent {
  readonly settings = signal<KitchenSinkSettings>({ ...DEFAULTS });
  readonly nodes = signal<Node[]>(seedNodes());
  readonly edges = signal<Edge[]>(seedEdges());
  readonly drawerOpen = signal<boolean>(true);
  readonly openSections = signal<Set<string>>(new Set(['Interaction', 'Plugins']));

  readonly loggedEvents = signal<EventEntry[]>([]);
  readonly eventLogPaused = signal<boolean>(false);
  readonly eventLogExpanded = signal<boolean>(true);
  private eventIdCounter = 0;
  private lastMoveLoggedAt = 0;
  private lastViewportLoggedAt = 0;

  /** Captured from <ng-flow> (init) — null until the flow mounts. */
  private flowApi: NgFlowService | null = null;

  constructor() {
    // Propagate plugin toggles that live on node data: the rich node reads
    // data._showToolbar / data._showResizer. Patch the nodes signal whenever
    // the relevant settings change. Runs once on construction with the
    // defaults (which match seed data), then on every subsequent toggle.
    effect(() => {
      const showToolbar = this.settings().showNodeToolbar;
      const showResizer = this.settings().showNodeResizer;
      this.nodes.update((nodes) =>
        nodes.map((n) =>
          n.id === 'rich'
            ? {
                ...n,
                data: {
                  ...n.data,
                  _showToolbar: showToolbar,
                  _showResizer: showResizer,
                },
              }
            : n
        )
      );
    });
  }

  readonly nodeTypes: Record<string, Type<unknown>> = {
    ksRich: KitchenSinkRichNodeComponent,
  };

  readonly edgeToolbarId = EDGE_TOOLBAR_EDGE_ID;
  readonly edgeToolbarPos = computed<{ x: number; y: number }>(() => {
    const edge = this.edges().find((e) => e.id === EDGE_TOOLBAR_EDGE_ID);
    if (!edge) return { x: 0, y: 0 };
    const source = this.nodes().find((n) => n.id === edge.source);
    const target = this.nodes().find((n) => n.id === edge.target);
    if (!source || !target) return { x: 0, y: 0 };
    return {
      x: (source.position.x + target.position.x) / 2 + 80,
      y: (source.position.y + target.position.y) / 2 + 50,
    };
  });

  readonly computedSnapGrid = computed<SnapGrid>(() => {
    return [this.settings().snapGridX, this.settings().snapGridY];
  });

  readonly computedTranslateExtent = computed<CoordinateExtent>(() => {
    return this.settings().translateExtentPreset === 'bounded' ? BOUNDED_EXTENT : infiniteExtent;
  });

  readonly computedNodeExtent = computed<CoordinateExtent>(() => {
    return this.settings().nodeExtentPreset === 'bounded' ? BOUNDED_EXTENT : infiniteExtent;
  });

  readonly computedNodeOrigin = computed<NodeOrigin>(() => {
    switch (this.settings().nodeOriginPreset) {
      case 'center': return [0.5, 0.5];
      case 'bottom-right': return [1, 1];
      default: return [0, 0];
    }
  });

  readonly computedIsValidConnection = computed<IsValidConnection | undefined>(() => {
    if (!this.settings().isValidConnectionEnabled) return undefined;
    return ((conn: Connection | Edge) => conn.source !== conn.target) as IsValidConnection;
  });

  readonly computedDeleteKeyCode = computed(() => parseKeyCode(this.settings().deleteKeyCode));
  readonly computedSelectionKeyCode = computed(() => parseKeyCode(this.settings().selectionKeyCode));
  readonly computedPanActivationKeyCode = computed(() => parseKeyCode(this.settings().panActivationKeyCode));
  readonly computedMultiSelectionKeyCode = computed(() => parseKeyCode(this.settings().multiSelectionKeyCode));
  readonly computedZoomActivationKeyCode = computed(() => parseKeyCode(this.settings().zoomActivationKeyCode));

  readonly totalNonDefaults = computed<number>(() => {
    const s = this.settings();
    let count = 0;
    for (const key of Object.keys(DEFAULTS) as (keyof KitchenSinkSettings)[]) {
      if (JSON.stringify(s[key]) !== JSON.stringify(DEFAULTS[key])) count++;
    }
    return count;
  });

  set<K extends keyof KitchenSinkSettings>(key: K, value: KitchenSinkSettings[K]): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }

  resetDefaults(): void {
    this.settings.set({ ...DEFAULTS });
  }

  nonDefaultCount(category: string): number {
    const keys = CATEGORY_KEYS[category] ?? [];
    const s = this.settings();
    let count = 0;
    for (const key of keys) {
      if (JSON.stringify(s[key]) !== JSON.stringify(DEFAULTS[key])) count++;
    }
    return count;
  }

  isOpen(category: string): boolean {
    return this.openSections().has(category);
  }

  toggleSection(category: string): void {
    const next = new Set(this.openSections());
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    this.openSections.set(next);
  }

  applyLayout(kind: 'LR' | 'TB' | 'Radial'): void {
    const n = this.nodes();
    const e = this.edges();
    switch (kind) {
      case 'LR': this.nodes.set(layoutLR(n, e)); break;
      case 'TB': this.nodes.set(layoutTB(n, e)); break;
      case 'Radial': this.nodes.set(layoutRadial(n, e)); break;
    }
    this.logEvent('layout', kind);
  }

  triggerFitView(): void {
    this.flowApi?.fitView();
  }

  onFlowInit(service: NgFlowService): void {
    this.flowApi = service;
    this.logEvent('init', 'ready');
  }

  // ── Graph mutations ─────────────────────────────────────────────────

  onNodesChange(changes: any[]): void {
    this.nodes.set(applyNodeChanges(changes, this.nodes()));
  }

  onEdgesChange(changes: any[]): void {
    this.edges.set(applyEdgeChanges(changes, this.edges()));
  }

  onConnect(connection: Connection): void {
    this.edges.set(addEdge(connection, this.edges()) as Edge[]);
    this.logEvent('connect', `${connection.source} → ${connection.target}`);
  }

  onSelectionChange(event: { nodes: Node[]; edges: Edge[] }): void {
    this.logEvent('selectionChange', `${event.nodes.length}n / ${event.edges.length}e`);
  }

  // ── Throttled events ─────────────────────────────────────────────────

  onMove(event: { viewport: { x: number; y: number; zoom: number } }): void {
    const now = Date.now();
    if (now - this.lastMoveLoggedAt < 200) return;
    this.lastMoveLoggedAt = now;
    this.logEvent('move', this.formatViewport(event.viewport));
  }

  onViewportChange(viewport: { x: number; y: number; zoom: number } | undefined): void {
    if (!viewport) return;
    const now = Date.now();
    if (now - this.lastViewportLoggedAt < 200) return;
    this.lastViewportLoggedAt = now;
    this.logEvent('viewportChange', this.formatViewport(viewport));
  }

  onDeleteEvent(event: { nodes: Node[]; edges: Edge[] } | undefined): void {
    if (!event) return;
    this.logEvent('delete', `${event.nodes.length}n/${event.edges.length}e`);
  }

  // ── Event log ──────────────────────────────────────────────────────

  logEvent(name: string, payload: string): void {
    if (this.eventLogPaused()) return;
    const entry: EventEntry = {
      id: ++this.eventIdCounter,
      timestamp: Date.now(),
      name,
      payload,
    };
    this.loggedEvents.update((events) => {
      const next = [entry, ...events];
      return next.slice(0, 50);
    });
  }

  clearEvents(): void {
    this.loggedEvents.set([]);
  }

  formatViewport(v: { x: number; y: number; zoom: number }): string {
    return `x=${v.x.toFixed(0)} y=${v.y.toFixed(0)} z=${v.zoom.toFixed(2)}`;
  }
}

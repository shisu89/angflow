import { Routes } from '@angular/router';
import { OverviewExampleComponent } from './examples/overview/overview.component';
import { CustomNodeExampleComponent } from './examples/custom-node/custom-node.component';
import { CustomEdgeExampleComponent } from './examples/custom-edge/custom-edge.component';
import { SubFlowsExampleComponent } from './examples/sub-flows/sub-flows.component';
import { NodeResizerExampleComponent } from './examples/node-resizer/node-resizer.component';
import { ConnectionValidationExampleComponent } from './examples/connection-validation/connection-validation.component';
import { DragFromSidebarExampleComponent } from './examples/drag-from-sidebar/drag-from-sidebar.component';
import { MinimapCustomExampleComponent } from './examples/minimap-custom/minimap-custom.component';
import { BackgroundsVariantsExampleComponent } from './examples/backgrounds-variants/backgrounds-variants.component';
import { SaveRestoreExampleComponent } from './examples/save-restore/save-restore.component';
import { EdgeTypesExampleComponent } from './examples/edge-types/edge-types.component';
import { NodeToolbarExampleComponent } from './examples/node-toolbar/node-toolbar.component';
import { EdgeToolbarExampleComponent } from './examples/edge-toolbar/edge-toolbar.component';
import { FloatingEdgesExampleComponent } from './examples/floating-edges/floating-edges.component';
import { CardinalEdgesExampleComponent } from './examples/cardinal-edges/cardinal-edges.component';
import { ClickDistanceExampleComponent } from './examples/click-distance/click-distance.component';
import { ZIndexModeExampleComponent } from './examples/z-index-mode/z-index-mode.component';
import { CancelConnectionExampleComponent } from './examples/cancel-connection/cancel-connection.component';
import { ColorModeExampleComponent } from './examples/color-mode/color-mode.component';
import { InteractionExampleComponent } from './examples/interaction/interaction.component';
import { TypedHandlesExampleComponent } from './examples/typed-handles/typed-handles.component';
import { CustomNodeInjectExampleComponent } from './examples/custom-node-inject/custom-node-inject.component';
import { A11yExampleComponent } from './examples/a11y/a11y.component';
import { HiddenExampleComponent } from './examples/hidden/hidden.component';
import { TouchDeviceExampleComponent } from './examples/touch-device/touch-device.component';
import { UndirectionalExampleComponent } from './examples/undirectional/undirectional.component';
import { ControlledViewportExampleComponent } from './examples/controlled-viewport/controlled-viewport.component';
import { DragHandleExampleComponent } from './examples/drag-handle/drag-handle.component';
import { InteractiveMinimapExampleComponent } from './examples/interactive-minimap/interactive-minimap.component';
import { MultiFlowsExampleComponent } from './examples/multi-flows/multi-flows.component';
import { UpdateNodeExampleComponent } from './examples/update-node/update-node.component';
import { NodeTypeChangeExampleComponent } from './examples/node-type-change/node-type-change.component';
import { KitchenSinkComponent } from './kitchen-sink/kitchen-sink.component';

export interface HarnessRoute {
  name: string;
  path: string;
  component: unknown;
}

export const HARNESS_ROUTES: HarnessRoute[] = [
  { name: 'Overview',              path: 'overview',              component: OverviewExampleComponent },
  { name: 'Custom node',           path: 'custom-node',           component: CustomNodeExampleComponent },
  { name: 'Custom node (inject)',  path: 'custom-node-inject',    component: CustomNodeInjectExampleComponent },
  { name: 'Custom edge',           path: 'custom-edge',           component: CustomEdgeExampleComponent },
  { name: 'Subflows',              path: 'sub-flows',             component: SubFlowsExampleComponent },
  { name: 'Node resizer',          path: 'node-resizer',          component: NodeResizerExampleComponent },
  { name: 'Connection validation', path: 'connection-validation', component: ConnectionValidationExampleComponent },
  { name: 'Drag from sidebar',     path: 'drag-from-sidebar',     component: DragFromSidebarExampleComponent },
  { name: 'Minimap custom',        path: 'minimap-custom',        component: MinimapCustomExampleComponent },
  { name: 'Backgrounds variants',  path: 'backgrounds-variants',  component: BackgroundsVariantsExampleComponent },
  { name: 'Save / restore',        path: 'save-restore',          component: SaveRestoreExampleComponent },
  { name: 'Edge types',            path: 'edge-types',            component: EdgeTypesExampleComponent },
  { name: 'Node toolbar',          path: 'node-toolbar',          component: NodeToolbarExampleComponent },
  { name: 'Edge toolbar',          path: 'edge-toolbar',          component: EdgeToolbarExampleComponent },
  { name: 'Floating edges',        path: 'floating-edges',        component: FloatingEdgesExampleComponent },
  { name: 'Cardinal edges',        path: 'cardinal-edges',        component: CardinalEdgesExampleComponent },
  { name: 'Click distance',        path: 'click-distance',        component: ClickDistanceExampleComponent },
  { name: 'Cancel connection',     path: 'cancel-connection',     component: CancelConnectionExampleComponent },
  { name: 'Color mode',            path: 'color-mode',            component: ColorModeExampleComponent },
  { name: 'Interaction',           path: 'interaction',           component: InteractionExampleComponent },
  { name: 'Typed handles',         path: 'typed-handles',         component: TypedHandlesExampleComponent },
  { name: 'Accessibility',         path: 'a11y',                  component: A11yExampleComponent },
  { name: 'Hidden',                path: 'hidden',                component: HiddenExampleComponent },
  { name: 'Z-index mode',          path: 'z-index-mode',          component: ZIndexModeExampleComponent },
  { name: 'Touch device',          path: 'touch-device',          component: TouchDeviceExampleComponent },
  { name: 'Undirectional',         path: 'undirectional',         component: UndirectionalExampleComponent },
  { name: 'Controlled viewport',   path: 'controlled-viewport',   component: ControlledViewportExampleComponent },
  { name: 'Drag handle',           path: 'drag-handle',           component: DragHandleExampleComponent },
  { name: 'Interactive minimap',   path: 'interactive-minimap',   component: InteractiveMinimapExampleComponent },
  { name: 'Multi flows',           path: 'multi-flows',           component: MultiFlowsExampleComponent },
  { name: 'Update node',           path: 'update-node',           component: UpdateNodeExampleComponent },
  { name: 'Node type change',      path: 'node-type-change',      component: NodeTypeChangeExampleComponent },
  { name: 'Kitchen sink',          path: 'kitchen-sink',          component: KitchenSinkComponent },
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...HARNESS_ROUTES.map((r) => ({ path: r.path, component: r.component as never })),
];

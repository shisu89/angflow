import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { GalleryShellComponent } from './shell/gallery-shell.component';
import { ComingSoonComponent } from './shell/coming-soon.component';
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
import { TypedHandlesExampleComponent } from './examples/typed-handles/typed-handles.component';
import { KitchenSinkComponent } from './kitchen-sink/kitchen-sink.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'gallery' },
      {
        path: 'gallery',
        component: GalleryShellComponent,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          { path: 'overview', component: OverviewExampleComponent },
          { path: 'custom-node', component: CustomNodeExampleComponent },
          { path: 'custom-edge', component: CustomEdgeExampleComponent },
          { path: 'sub-flows', component: SubFlowsExampleComponent },
          { path: 'node-resizer', component: NodeResizerExampleComponent },
          { path: 'connection-validation', component: ConnectionValidationExampleComponent },
          { path: 'drag-from-sidebar', component: DragFromSidebarExampleComponent },
          { path: 'minimap-custom', component: MinimapCustomExampleComponent },
          { path: 'backgrounds-variants', component: BackgroundsVariantsExampleComponent },
          { path: 'save-restore', component: SaveRestoreExampleComponent },
          { path: 'edge-types', component: EdgeTypesExampleComponent },
          { path: 'node-toolbar', component: NodeToolbarExampleComponent },
          { path: 'edge-toolbar', component: EdgeToolbarExampleComponent },
          { path: 'floating-edges', component: FloatingEdgesExampleComponent },
          { path: 'typed-handles', component: TypedHandlesExampleComponent },
        ],
      },
      { path: 'kitchen-sink', component: KitchenSinkComponent },
      { path: '**', component: ComingSoonComponent },
    ],
  },
];

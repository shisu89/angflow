import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tests/generic/nodes/general',
    loadComponent: () => import('./generic-tests/nodes/general.component').then(m => m.NodesGeneralComponent),
  },
  {
    path: 'tests/generic/edges/general',
    loadComponent: () => import('./generic-tests/edges/general.component').then(m => m.EdgesGeneralComponent),
  },
  {
    path: 'tests/generic/pane/general',
    loadComponent: () => import('./generic-tests/pane/general.component').then(m => m.PaneGeneralComponent),
  },
  {
    path: 'tests/generic/pane/non-defaults',
    loadComponent: () => import('./generic-tests/pane/non-defaults.component').then(m => m.PaneNonDefaultsComponent),
  },
  {
    path: 'tests/generic/node-toolbar/general',
    loadComponent: () => import('./generic-tests/node-toolbar/general.component').then(m => m.NodeToolbarGeneralComponent),
  },
  {
    path: 'examples/color-mode',
    loadComponent: () => import('./examples/color-mode/color-mode.component').then(m => m.ColorModeComponent),
  },
];

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'list.pageTitle',
    loadComponent: () =>
      import('./features/controls-list/controls-list.page').then((m) => m.ControlsListPage),
  },
  {
    path: 'controls/new',
    title: 'editor.titleNew',
    loadComponent: () =>
      import('./features/control-editor/control-editor.page').then((m) => m.ControlEditorPage),
  },
  {
    path: 'controls/:id',
    title: 'editor.titleEdit',
    loadComponent: () =>
      import('./features/control-editor/control-editor.page').then((m) => m.ControlEditorPage),
  },
  {
    path: 'runs/:id',
    title: 'results.pageTitle',
    loadComponent: () =>
      import('./features/run-results/run-results.page').then((m) => m.RunResultsPage),
  },
  {
    path: '**',
    title: 'states.notFound.title',
    loadComponent: () =>
      import('./shared/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

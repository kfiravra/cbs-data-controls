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
    // `new` is the id of a control that is not saved yet: one route, so a first save keeps the screen
    path: 'controls/:id',
    title: (route) => (route.paramMap.get('id') === 'new' ? 'editor.titleNew' : 'editor.titleEdit'),
    loadComponent: () =>
      import('./features/control-editor/control-editor.page').then((m) => m.ControlEditorPage),
    // a changed draft is not left by a link of the app without a word, as it is not by closing the tab
    canDeactivate: [
      (editor: { mayLeave(nextUrl: string): boolean }, _route, _state, next) => editor.mayLeave(next.url),
    ],
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

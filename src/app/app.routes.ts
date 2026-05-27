import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'roadmap-editor' },
  {
    path: 'roadmap-editor',
    loadComponent: () =>
      import('./screens/roadmap-editor/roadmap-editor.component').then(
        (m) => m.RoadmapEditorComponent,
      ),
  },
  {
    path: 'roadmap',
    loadComponent: () =>
      import('./screens/roadmap/roadmap.component').then(
        (m) => m.RoadmapComponent,
      ),
  },
  { path: '**', redirectTo: 'roadmap-editor' },
];

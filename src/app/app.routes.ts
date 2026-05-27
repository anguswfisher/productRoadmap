import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'roadmap-editor' },
  {
    path: 'login',
    loadComponent: () =>
      import('./screens/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'roadmap-editor',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./screens/roadmap-editor/roadmap-editor.component').then(
        (m) => m.RoadmapEditorComponent,
      ),
  },
  {
    path: 'roadmap',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./screens/roadmap/roadmap.component').then(
        (m) => m.RoadmapComponent,
      ),
  },
  { path: '**', redirectTo: 'roadmap-editor' },
];

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
    // Public, read-only — no guard. Shareable with stakeholders.
    path: 'roadmap',
    loadComponent: () =>
      import('./screens/roadmap/roadmap.component').then(
        (m) => m.RoadmapComponent,
      ),
  },
  {
    // Backlog of items not yet slotted into a roadmap (team-only).
    path: 'next-editor',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./screens/next/next-editor.component').then(
        (m) => m.NextEditorComponent,
      ),
  },
  {
    // Public, read-only "what's coming next".
    path: 'next',
    loadComponent: () =>
      import('./screens/next/next.component').then((m) => m.NextComponent),
  },
  { path: '**', redirectTo: 'roadmap-editor' },
];

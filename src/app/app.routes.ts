import { Routes } from '@angular/router';
import { AuthPageComponent } from './features/auth/auth-page.component';
import { AppsPageComponent } from './features/apps/apps-page.component';
import { ShellLayoutComponent } from './layout/shell-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login'
      },
      {
        path: 'login',
        component: AuthPageComponent,
        title: 'Account Terminal | Login'
      },
      {
        path: 'apps',
        component: AppsPageComponent,
        title: 'Account Terminal | App Center'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

import { Routes } from '@angular/router';
import { AuthPageComponent } from './features/auth/auth-page.component';
import { AppsPageComponent } from './features/apps/apps-page.component';
import { CliAuthPageComponent } from './features/cli/cli-auth-page.component';
import { ManagePageComponent } from './features/manage/manage-page.component';
import { SettingsPageComponent } from './features/settings/settings-page.component';
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
        title: '齐天簿 | 登录'
      },
      {
        path: 'cli',
        component: CliAuthPageComponent,
        title: '齐天簿 | CLI 授权'
      },
      {
        path: 'apps',
        component: AppsPageComponent,
        title: '齐天簿 | 应用中心'
      },
      {
        path: 'apps/new/manage',
        component: ManagePageComponent,
        title: '齐天簿 | 新建应用'
      },
      {
        path: 'apps/:appId/manage',
        component: ManagePageComponent,
        title: '齐天簿 | 应用管理'
      },
      {
        path: 'settings',
        component: SettingsPageComponent,
        title: '齐天簿 | 账户设置'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

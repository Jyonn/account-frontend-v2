import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountApp } from '../../core/models/account.models';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';

@Component({
  selector: 'app-apps-page',
  imports: [MarkdownPipe],
  templateUrl: './apps-page.component.html',
  styleUrl: './apps-page.component.scss'
})
export class AppsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly launchingAppId = signal('');
  protected readonly error = signal('');
  protected readonly allApps = signal<AccountApp[]>([]);
  protected readonly devApps = signal<AccountApp[]>([]);
  protected readonly appScope = signal<'mine' | 'developed'>('mine');
  protected readonly selectedAppId = signal('');
  protected readonly selectedApp = signal<AccountApp | null>(null);
  protected readonly detailDrawerOpen = signal(false);
  protected readonly showScopeToggle = computed(() => !!this.session.user()?.is_dev);
  protected readonly canManageSelectedApp = computed(() => !!this.selectedApp()?.relation?.belong);
  protected readonly displayedApps = computed(() =>
    this.appScope() === 'developed' && this.showScopeToggle() ? this.devApps() : this.allApps()
  );
  protected readonly activeScopeTitle = computed(() => (this.appScope() === 'developed' ? '我开发的应用' : '我的应用'));
  protected readonly activeScopeDescription = computed(() =>
    this.appScope() === 'developed'
      ? '这里只展示当前账号拥有并可管理的应用。'
      : '这里只展示当前账号可直接进入或已绑定的应用。'
  );
  protected readonly totalAppsCount = computed(() => {
    const ids = new Set([...this.allApps(), ...this.devApps()].map((app) => app.app_id));
    return ids.size;
  });

  async ngOnInit() {
    await this.session.bootstrap();
    if (!this.session.isLoggedIn()) {
      await this.router.navigateByUrl('/login');
      return;
    }

    await this.loadApps();
  }

  protected async reload() {
    await this.loadApps();
  }

  protected setAppScope(scope: 'mine' | 'developed') {
    if (scope === 'developed' && !this.showScopeToggle()) {
      return;
    }

    this.appScope.set(scope);
  }

  protected async inspect(appId: string) {
    this.error.set('');
    this.selectedAppId.set(appId);
    this.detailDrawerOpen.set(true);
    this.detailLoading.set(true);

    try {
      this.selectedApp.set(await this.api.getAppDetail(appId));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '应用详情加载失败');
    } finally {
      this.detailLoading.set(false);
    }
  }

  protected closeDetailDrawer() {
    this.detailDrawerOpen.set(false);
    this.selectedAppId.set('');
    this.selectedApp.set(null);
    this.detailLoading.set(false);
  }

  protected async enter(app: AccountApp) {
    this.launchingAppId.set(app.app_id);
    this.error.set('');

    try {
      const payload = await this.api.authorizeApp(app.app_id);
      window.location.href = this.attachAuthCode(payload.redirect_uri, payload.auth_code);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '进入应用失败');
    } finally {
      this.launchingAppId.set('');
    }
  }

  protected async manage(app: AccountApp) {
    await this.router.navigate(['/apps', app.app_id, 'manage']);
  }

  protected formatTime(timestamp?: number) {
    if (!timestamp) {
      return '未知';
    }
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
  }

  private async loadApps() {
    this.loading.set(true);
    this.error.set('');

    try {
      const [allApps, devApps] = await Promise.all([
        this.api.getAppList({ relation: '', frequent: false, count: 12 }),
        this.api.getAppList({ relation: 'owner' })
      ]);

      this.allApps.set(allApps);
      this.devApps.set(devApps);

      if (!this.showScopeToggle()) {
        this.appScope.set('mine');
      }

      const currentSelectedAppId = this.selectedAppId();
      if (!currentSelectedAppId) {
        this.selectedApp.set(null);
        this.detailDrawerOpen.set(false);
        return;
      }

      const nextSelected = [...devApps, ...allApps].find((item) => item.app_id === currentSelectedAppId);
      if (nextSelected && this.detailDrawerOpen()) {
        void this.inspect(nextSelected.app_id);
      } else {
        this.closeDetailDrawer();
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '应用中心加载失败');
    } finally {
      this.loading.set(false);
    }
  }

  private attachAuthCode(redirectUri: string, code: string) {
    const separator = redirectUri.includes('?') ? '&' : '?';
    return `${redirectUri}${separator}code=${encodeURIComponent(code)}`;
  }
}

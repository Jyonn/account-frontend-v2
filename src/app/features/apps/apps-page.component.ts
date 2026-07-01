import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountApp } from '../../core/models/account.models';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-apps-page',
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
  protected readonly hint = signal('');
  protected readonly allApps = signal<AccountApp[]>([]);
  protected readonly devApps = signal<AccountApp[]>([]);
  protected readonly selectedApp = signal<AccountApp | null>(null);
  protected readonly canManageSelectedApp = computed(() => !!this.selectedApp()?.relation?.belong);

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

  protected async inspect(appId: string) {
    this.error.set('');
    this.hint.set('');
    this.detailLoading.set(true);

    try {
      this.selectedApp.set(await this.api.getAppDetail(appId));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '应用详情加载失败');
    } finally {
      this.detailLoading.set(false);
    }
  }

  protected async enter(app: AccountApp) {
    this.launchingAppId.set(app.app_id);
    this.error.set('');
    this.hint.set('');

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

  protected async copyAppId(appId: string) {
    try {
      await navigator.clipboard.writeText(appId);
      this.hint.set(`应用 ID 已复制：${appId}`);
    } catch {
      this.hint.set(`应用 ID：${appId}`);
    }
  }

  protected formatTime(timestamp?: number) {
    if (!timestamp) {
      return 'unknown';
    }
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
  }

  private async loadApps() {
    this.loading.set(true);
    this.error.set('');
    this.hint.set('');

    try {
      const [allApps, devApps] = await Promise.all([
        this.api.getAppList({ relation: '', frequent: false, count: 12 }),
        this.api.getAppList({ relation: 'owner' })
      ]);

      this.allApps.set(allApps);
      this.devApps.set(devApps);

      const currentSelectedApp = this.selectedApp();
      const first = currentSelectedApp
        ? [...devApps, ...allApps].find((item) => item.app_id === currentSelectedApp.app_id)
        : devApps[0] || allApps[0];

      if (first) {
        this.selectedApp.set(first);
        void this.inspect(first.app_id);
      } else {
        this.selectedApp.set(null);
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

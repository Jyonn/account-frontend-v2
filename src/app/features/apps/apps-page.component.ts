import { Component, OnInit, inject } from '@angular/core';
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

  protected loading = true;
  protected detailLoading = false;
  protected launchingAppId = '';
  protected error = '';
  protected hint = '';
  protected allApps: AccountApp[] = [];
  protected devApps: AccountApp[] = [];
  protected selectedApp: AccountApp | null = null;

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
    this.error = '';
    this.hint = '';
    this.detailLoading = true;

    try {
      this.selectedApp = await this.api.getAppDetail(appId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : '应用详情加载失败';
    } finally {
      this.detailLoading = false;
    }
  }

  protected async enter(app: AccountApp) {
    this.launchingAppId = app.app_id;
    this.error = '';
    this.hint = '';

    try {
      const payload = await this.api.authorizeApp(app.app_id);
      window.location.href = this.attachAuthCode(payload.redirect_uri, payload.auth_code);
    } catch (error) {
      this.error = error instanceof Error ? error.message : '进入应用失败';
    } finally {
      this.launchingAppId = '';
    }
  }

  protected async manage(app: AccountApp) {
    await this.router.navigate(['/apps', app.app_id, 'manage']);
  }

  protected async copyAppId(appId: string) {
    try {
      await navigator.clipboard.writeText(appId);
      this.hint = `app_id copied: ${appId}`;
    } catch {
      this.hint = `app_id: ${appId}`;
    }
  }

  protected formatTime(timestamp?: number) {
    if (!timestamp) {
      return 'unknown';
    }
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
  }

  protected get canManageSelectedApp() {
    return !!this.selectedApp?.relation?.belong;
  }

  private async loadApps() {
    this.loading = true;
    this.error = '';
    this.hint = '';

    try {
      const [allApps, devApps] = await Promise.all([
        this.api.getAppList({ relation: '', frequent: false, count: 12 }),
        this.api.getAppList({ relation: 'owner' })
      ]);

      this.allApps = allApps;
      this.devApps = devApps;

      const first = this.selectedApp
        ? [...devApps, ...allApps].find((item) => item.app_id === this.selectedApp?.app_id)
        : devApps[0] || allApps[0];

      if (first) {
        this.selectedApp = first;
        void this.inspect(first.app_id);
      } else {
        this.selectedApp = null;
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : '应用中心加载失败';
    } finally {
      this.loading = false;
    }
  }

  private attachAuthCode(redirectUri: string, code: string) {
    const separator = redirectUri.includes('?') ? '&' : '?';
    return `${redirectUri}${separator}code=${encodeURIComponent(code)}`;
  }
}

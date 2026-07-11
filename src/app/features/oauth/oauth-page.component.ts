import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountApp } from '../../core/models/account.models';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';

@Component({
  selector: 'app-oauth-page',
  imports: [MarkdownPipe],
  templateUrl: './oauth-page.component.html',
  styleUrl: './oauth-page.component.scss'
})
export class OauthPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly loading = signal(true);
  protected readonly authorizing = signal(false);
  protected readonly app = signal<AccountApp | null>(null);
  protected readonly error = signal('');

  async ngOnInit() {
    await this.session.bootstrap();

    const appId = this.route.snapshot.queryParamMap.get('app_id')?.trim() ?? '';
    if (!appId) {
      this.error.set('缺少应用 ID');
      this.loading.set(false);
      return;
    }

    if (!this.session.isLoggedIn()) {
      await this.router.navigate(['/login'], {
        queryParams: {
          returnTo: this.router.url
        }
      });
      return;
    }

    try {
      this.app.set(await this.api.getAppDetail(appId));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '读取应用信息失败');
    } finally {
      this.loading.set(false);
    }
  }

  protected async authorize() {
    const app = this.app();
    if (!app) {
      return;
    }

    this.authorizing.set(true);
    this.error.set('');

    try {
      const payload = await this.api.authorizeApp(app.app_id);
      window.location.href = this.attachAuthCode(payload.redirect_uri, payload.auth_code);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '应用授权失败');
      this.authorizing.set(false);
    }
  }

  protected async backToApps() {
    await this.router.navigateByUrl('/apps');
  }

  protected formatTime(timestamp?: number) {
    if (!timestamp) {
      return '未知';
    }
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
  }

  private attachAuthCode(redirectUri: string, code: string) {
    const separator = redirectUri.includes('?') ? '&' : '?';
    return `${redirectUri}${separator}code=${encodeURIComponent(code)}`;
  }
}

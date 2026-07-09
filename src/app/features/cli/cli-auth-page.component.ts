import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CliDeviceGrantPayload } from '../../core/models/account.models';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-cli-auth-page',
  imports: [FormsModule],
  templateUrl: './cli-auth-page.component.html',
  styleUrl: './cli-auth-page.component.scss'
})
export class CliAuthPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly loading = signal(false);
  protected readonly confirming = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly deviceGrant = signal<CliDeviceGrantPayload | null>(null);
  protected readonly currentCode = signal('');
  protected readonly normalizedCode = computed(() => this.normalizeUserCode(this.currentCode()));
  protected readonly canLookup = computed(() => this.normalizedCode().replace('-', '').length === 8);
  protected readonly returnTo = computed(() => {
    const code = this.normalizedCode();
    return code ? `/cli?code=${encodeURIComponent(code)}` : '/cli';
  });

  async ngOnInit() {
    await this.session.bootstrap();

    const queryCode = this.route.snapshot.queryParamMap.get('code');
    if (queryCode) {
      this.currentCode.set(this.normalizeUserCode(queryCode));
      if (this.session.isLoggedIn()) {
        await this.lookupGrant();
      }
    }
  }

  protected async lookupGrant() {
    if (!this.canLookup()) {
      this.error.set('请输入 8 位设备确认码');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      this.deviceGrant.set(await this.api.getCliDeviceGrant(this.normalizedCode()));
    } catch (error) {
      this.deviceGrant.set(null);
      this.error.set(error instanceof Error ? error.message : '读取 CLI 授权请求失败');
    } finally {
      this.loading.set(false);
    }
  }

  protected async confirm(decision: 'approve' | 'deny') {
    const grant = this.deviceGrant();
    if (!grant) {
      return;
    }

    this.confirming.set(true);
    this.error.set('');
    this.message.set('');

    try {
      this.deviceGrant.set(await this.api.confirmCliDeviceGrant(grant.user_code, decision));
      this.message.set(decision === 'approve' ? '已批准本次 CLI 登录请求。' : '已拒绝本次 CLI 登录请求。');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '更新 CLI 授权状态失败');
    } finally {
      this.confirming.set(false);
    }
  }

  protected async goToLogin() {
    await this.router.navigate(['/login'], {
      queryParams: {
        returnTo: this.returnTo()
      }
    });
  }

  protected onCodeInput(value: string) {
    this.currentCode.set(this.normalizeUserCode(value));
    this.deviceGrant.set(null);
    this.error.set('');
    this.message.set('');
  }

  private normalizeUserCode(value: string) {
    const normalized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    if (normalized.length <= 4) {
      return normalized;
    }
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
}

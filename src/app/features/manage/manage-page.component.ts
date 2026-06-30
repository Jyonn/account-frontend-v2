import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AccountApp, ChoiceItem } from '../../core/models/account.models';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-manage-page',
  imports: [FormsModule],
  templateUrl: './manage-page.component.html',
  styleUrl: './manage-page.component.scss'
})
export class ManagePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected loading = true;
  protected saving = false;
  protected uploadingLogo = false;
  protected error = '';
  protected message = '';
  protected app: AccountApp | null = null;
  protected appSecret = '';
  protected scopeOptions: ChoiceItem[] = [];
  protected premiseOptions: ChoiceItem[] = [];
  protected draft = {
    app_name: '',
    app_desc: '',
    redirect_uri: '',
    test_redirect_uri: '',
    app_info: ''
  };

  async ngOnInit() {
    await this.session.bootstrap();
    if (!this.session.isLoggedIn()) {
      await this.router.navigateByUrl('/login');
      return;
    }

    const appId = this.route.snapshot.paramMap.get('appId');
    if (!appId) {
      this.error = 'missing app id';
      this.loading = false;
      return;
    }

    await this.loadApp(appId);
  }

  protected async save() {
    if (!this.app) {
      return;
    }

    const validationMessage = this.validate();
    if (validationMessage) {
      this.error = validationMessage;
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    try {
      const updated = await this.api.updateAppInfo(this.app.app_id, {
        name: this.draft.app_name.trim(),
        desc: this.draft.app_desc.trim(),
        info: this.draft.app_info.trim(),
        redirect_uri: this.draft.redirect_uri.trim(),
        test_redirect_uri: this.draft.test_redirect_uri.trim(),
        scopes: this.scopeOptions.filter((item) => item.selected).map((item) => item.id),
        premises: this.premiseOptions.filter((item) => item.selected).map((item) => item.id)
      });

      this.app = {
        ...this.app,
        ...updated,
        app_secret: this.appSecret,
        scopes: this.scopeOptions.filter((item) => item.selected),
        premises: this.premiseOptions.filter((item) => item.selected)
      };
      this.message = 'app updated';
      this.syncDraft();
    } catch (error) {
      this.error = error instanceof Error ? error.message : '更新应用失败';
    } finally {
      this.saving = false;
    }
  }

  protected async uploadLogo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.app) {
      return;
    }

    this.uploadingLogo = true;
    this.error = '';
    this.message = '';

    try {
      const uploadToken = await this.api.getLogoUploadToken(file.name, this.app.app_id);
      const uploaded = await this.api.uploadFile({
        key: uploadToken.key,
        token: uploadToken.upload_token,
        file
      });
      this.app = {
        ...this.app,
        ...(uploaded as Record<string, unknown>)
      } as AccountApp;
      this.message = 'logo uploaded';
    } catch (error) {
      this.error = error instanceof Error ? error.message : '图标上传失败';
    } finally {
      input.value = '';
      this.uploadingLogo = false;
    }
  }

  protected toggleChoice(list: ChoiceItem[], itemId: string) {
    list.forEach((item) => {
      if (item.id === itemId && item.always !== true) {
        item.selected = !item.selected;
      }
    });
  }

  protected async copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.message = `${label} copied`;
    } catch {
      this.message = `${label}: ${value}`;
    }
  }

  protected get logoUrl() {
    const logo = this.app?.logo;
    if (!logo) {
      return '';
    }
    return typeof logo === 'string' ? logo : logo.link || '';
  }

  protected get oauthUrl() {
    if (!this.app?.app_id) {
      return '';
    }
    return `${window.location.origin}/oauth/?app_id=${this.app.app_id}`;
  }

  protected async backToApps() {
    await this.router.navigateByUrl('/apps');
  }

  private async loadApp(appId: string) {
    this.loading = true;
    this.error = '';

    try {
      const [app, appSecret, scopes, premises] = await Promise.all([
        this.api.getAppDetail(appId),
        this.api.getAppSecret(appId),
        this.api.getAppScope(),
        this.api.getAppPremise()
      ]);

      if (!app.relation?.belong) {
        this.error = 'current session is not the owner of this app';
        this.loading = false;
        return;
      }

      const selectedScopeIds = new Set((app.scopes || []).map((item) => item.id));
      const selectedPremiseIds = new Set((app.premises || []).map((item) => item.id));

      this.scopeOptions = scopes.map((item) => ({
        ...item,
        selected: item.always === true || selectedScopeIds.has(item.id)
      }));
      this.premiseOptions = premises.map((item) => ({
        ...item,
        selected: item.always === true || selectedPremiseIds.has(item.id)
      }));

      this.app = {
        ...app,
        app_secret: appSecret
      };
      this.appSecret = appSecret;
      this.syncDraft();
    } catch (error) {
      this.error = error instanceof Error ? error.message : '应用信息加载失败';
    } finally {
      this.loading = false;
    }
  }

  private validate() {
    if (!this.draft.app_name.trim()) {
      return '应用名不能为空';
    }
    if (!this.draft.app_desc.trim()) {
      return '应用标语不能为空';
    }
    if (!this.draft.redirect_uri.trim()) {
      return '回调 URI 不能为空';
    }
    if (!this.draft.app_info.trim()) {
      return '应用介绍不能为空';
    }
    return '';
  }

  private syncDraft() {
    this.draft = {
      app_name: this.app?.app_name || '',
      app_desc: this.app?.app_desc || '',
      redirect_uri: this.app?.redirect_uri || '',
      test_redirect_uri: this.app?.test_redirect_uri || '',
      app_info: this.app?.app_info || ''
    };
  }
}

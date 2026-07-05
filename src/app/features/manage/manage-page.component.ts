import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploadingLogo = signal(false);
  protected readonly mobileMetaOpen = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly app = signal<AccountApp | null>(null);
  protected readonly appSecret = signal('');
  protected readonly scopeOptions = signal<ChoiceItem[]>([]);
  protected readonly premiseOptions = signal<ChoiceItem[]>([]);
  protected draft = {
    app_name: '',
    app_desc: '',
    redirect_uri: '',
    test_redirect_uri: '',
    app_info: ''
  };
  protected readonly appId = computed(() => this.app()?.app_id || '');
  protected readonly appUserCount = computed(() => this.app()?.user_num || 0);
  protected readonly isCreateMode = computed(() => this.route.snapshot.routeConfig?.path === 'apps/new/manage');
  protected readonly pageTitle = computed(() => this.isCreateMode() ? '新建应用' : (this.app()?.app_name || '管理应用'));
  protected readonly primaryActionLabel = computed(() => {
    if (this.saving()) {
      return this.isCreateMode() ? '创建中...' : '保存中...';
    }
    return this.isCreateMode() ? '创建应用' : '保存应用设置';
  });

  async ngOnInit() {
    await this.session.bootstrap();
    if (!this.session.isLoggedIn()) {
      await this.router.navigateByUrl('/login');
      return;
    }

    if (this.isCreateMode()) {
      await this.loadCreateForm();
      return;
    }

    const appId = this.route.snapshot.paramMap.get('appId');
    if (!appId) {
      this.error.set('missing app id');
      this.loading.set(false);
      return;
    }

    await this.loadApp(appId);
  }

  protected async save() {
    const validationMessage = this.validate();
    if (validationMessage) {
      this.error.set(validationMessage);
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const payload = {
        name: this.draft.app_name.trim(),
        desc: this.draft.app_desc.trim(),
        redirect_uri: this.draft.redirect_uri.trim(),
        test_redirect_uri: this.draft.test_redirect_uri.trim(),
        scopes: this.scopeOptions().filter((item) => item.selected).map((item) => item.id),
        premises: this.premiseOptions().filter((item) => item.selected).map((item) => item.id)
      };

      if (this.isCreateMode()) {
        const created = await this.api.createApp(payload);
        await this.router.navigate(['/apps', created.app_id, 'manage']);
        return;
      }

      const app = this.app();
      if (!app) {
        return;
      }

      const updated = await this.api.updateAppInfo(app.app_id, {
        ...payload,
        info: this.draft.app_info.trim(),
        max_user_num: 0
      });

      this.app.set({
        ...app,
        ...updated,
        app_secret: this.appSecret(),
        scopes: this.scopeOptions().filter((item) => item.selected),
        premises: this.premiseOptions().filter((item) => item.selected)
      });
      this.message.set('app updated');
      this.syncDraft();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '更新应用失败');
    } finally {
      this.saving.set(false);
    }
  }

  protected async uploadLogo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const app = this.app();
    if (!file || !app) {
      return;
    }

    this.uploadingLogo.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const uploadToken = await this.api.getLogoUploadToken(file.name, app.app_id);
      const uploaded = await this.api.uploadFile({
        key: uploadToken.key,
        token: uploadToken.upload_token,
        file
      });
      this.app.set({
        ...app,
        ...(uploaded as Record<string, unknown>)
      } as AccountApp);
      this.message.set('logo uploaded');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '图标上传失败');
    } finally {
      input.value = '';
      this.uploadingLogo.set(false);
    }
  }

  protected toggleScope(itemId: string) {
    this.scopeOptions.update((list) => list.map((item) => {
      if (item.id === itemId && item.always !== true) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  }

  protected togglePremise(itemId: string) {
    this.premiseOptions.update((list) => list.map((item) => {
      if (item.id === itemId && item.always !== true) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  }

  protected async copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.message.set(`${label} copied`);
    } catch {
      this.message.set(`${label}: ${value}`);
    }
  }

  protected get logoUrl() {
    const logo = this.app()?.logo;
    if (!logo) {
      return '';
    }
    return typeof logo === 'string' ? logo : logo.link || '';
  }

  protected get oauthUrl() {
    const appId = this.app()?.app_id;
    if (!appId) {
      return '';
    }
    return `${window.location.origin}/oauth/?app_id=${appId}`;
  }

  protected async backToApps() {
    await this.router.navigateByUrl('/apps');
  }

  protected toggleMobileMeta() {
    this.mobileMetaOpen.update((value) => !value);
  }

  private async loadApp(appId: string) {
    this.loading.set(true);
    this.error.set('');

    try {
      const [app, appSecret, scopes, premises] = await Promise.all([
        this.api.getAppDetail(appId),
        this.api.getAppSecret(appId),
        this.api.getAppScope(),
        this.api.getAppPremise()
      ]);

      if (!app.relation?.belong) {
        this.error.set('current session is not the owner of this app');
        this.loading.set(false);
        return;
      }

      const selectedScopeIds = new Set((app.scopes || []).map((item) => item.id));
      const selectedPremiseIds = new Set((app.premises || []).map((item) => item.id));

      this.scopeOptions.set(scopes.map((item) => ({
        ...item,
        selected: item.always === true || selectedScopeIds.has(item.id)
      })));
      this.premiseOptions.set(premises.map((item) => ({
        ...item,
        selected: item.always === true || selectedPremiseIds.has(item.id)
      })));

      this.app.set({
        ...app,
        app_secret: appSecret
      });
      this.appSecret.set(appSecret);
      this.syncDraft();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '应用信息加载失败');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCreateForm() {
    this.loading.set(true);
    this.error.set('');

    try {
      const [scopes, premises] = await Promise.all([
        this.api.getAppScope(),
        this.api.getAppPremise()
      ]);

      this.scopeOptions.set(scopes);
      this.premiseOptions.set(premises);
      this.app.set(null);
      this.appSecret.set('');
      this.draft = {
        app_name: '',
        app_desc: '',
        redirect_uri: window.location.origin,
        test_redirect_uri: window.location.origin,
        app_info: ''
      };
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '创建表单加载失败');
    } finally {
      this.loading.set(false);
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
    if (!this.isCreateMode() && !this.draft.app_info.trim()) {
      return '应用介绍不能为空';
    }
    return '';
  }

  private syncDraft() {
    const app = this.app();
    this.draft = {
      app_name: app?.app_name || '',
      app_desc: app?.app_desc || '',
      redirect_uri: app?.redirect_uri || '',
      test_redirect_uri: app?.test_redirect_uri || '',
      app_info: app?.app_info || ''
    };
  }
}

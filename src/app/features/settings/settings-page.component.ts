import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected loading = true;
  protected saving = false;
  protected applyingDev = false;
  protected editMode = false;
  protected message = '';
  protected error = '';
  protected draft = {
    nickname: '',
    description: '',
    qitian: '',
    birthday: ''
  };

  async ngOnInit() {
    await this.session.bootstrap();
    if (!this.session.isLoggedIn()) {
      await this.router.navigateByUrl('/login');
      return;
    }

    if (!this.session.user()) {
      await this.session.refreshProfile();
    }

    this.syncDraft();
    this.loading = false;
  }

  protected beginEdit() {
    this.editMode = true;
    this.message = '';
    this.error = '';
    this.syncDraft();
  }

  protected cancelEdit() {
    this.editMode = false;
    this.message = '';
    this.error = '';
    this.syncDraft();
  }

  protected async saveProfile() {
    if (!this.draft.nickname.trim()) {
      this.error = '昵称不能为空';
      return;
    }

    this.saving = true;
    this.message = '';
    this.error = '';

    try {
      const user = await this.api.updateUserInfo({
        nickname: this.draft.nickname.trim(),
        description: this.draft.description.trim(),
        qitian: this.draft.qitian.trim(),
        birthday: this.draft.birthday || ''
      });
      this.session.user.set(user);
      this.editMode = false;
      this.message = 'profile updated';
      this.syncDraft();
    } catch (error) {
      this.error = error instanceof Error ? error.message : '资料更新失败';
    } finally {
      this.saving = false;
    }
  }

  protected async uploadAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.saving = true;
    this.message = '';
    this.error = '';

    try {
      const uploadToken = await this.api.getAvatarUploadToken(file.name);
      const uploaded = await this.api.uploadFile({
        key: uploadToken.key,
        token: uploadToken.upload_token,
        file
      });
      const current = this.session.user();
      this.session.user.set({
        ...current,
        ...(uploaded as Record<string, unknown>)
      } as typeof current);
      this.message = 'avatar uploaded';
    } catch (error) {
      this.error = error instanceof Error ? error.message : '头像上传失败';
    } finally {
      input.value = '';
      this.saving = false;
    }
  }

  protected async applyDev() {
    if (!this.canApplyDev) {
      return;
    }

    this.applyingDev = true;
    this.message = '';
    this.error = '';

    try {
      const user = await this.api.applyDev();
      this.session.user.set(user);
      this.message = 'developer access granted';
    } catch (error) {
      this.error = error instanceof Error ? error.message : '开发者申请失败';
    } finally {
      this.applyingDev = false;
    }
  }

  protected openExternal(url: string) {
    window.open(url, '_blank', 'noopener');
  }

  protected get avatarUrl() {
    const avatar = this.session.user()?.avatar;
    if (!avatar) {
      return '';
    }
    return typeof avatar === 'string' ? avatar : avatar.link || '';
  }

  protected get verifyStatusText() {
    const status = this.session.user()?.verify_status ?? 0;
    switch (status) {
      case 3:
        return 'verified';
      case 2:
        return 'manual-review';
      case 1:
        return 'auto-review';
      default:
        return 'unverified';
    }
  }

  protected get canApplyDev() {
    const user = this.session.user();
    return !!user && !user.is_dev && user.verify_status === 3;
  }

  private syncDraft() {
    const user = this.session.user();
    this.draft = {
      nickname: user?.nickname || '',
      description: user?.description || '',
      qitian: user?.qitian || '',
      birthday: user?.birthday || ''
    };
  }
}

import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

interface VerifyDraft {
  name: string;
  male: boolean;
  idcard: string;
  birthday: string;
  validStart: string;
  validEnd: string;
  token: string;
}

const MAX_IDCARD_IMAGE_SIZE = 10 * 1024 * 1024;

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly applyingDev = signal(false);
  protected readonly editMode = signal(false);
  protected readonly verificationBusy = signal(false);
  protected readonly uploadingFront = signal(false);
  protected readonly uploadingBack = signal(false);
  protected readonly manualVerification = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected draft = {
    nickname: '',
    description: '',
    qitian: '',
    birthday: ''
  };
  protected verifyDraft: VerifyDraft = this.emptyVerifyDraft();
  protected cardFrontPreview = '';
  protected cardBackPreview = '';
  protected readonly canApplyDev = computed(() => {
    const user = this.session.user();
    return !!user && !user.is_dev && user.verify_status === 3;
  });

  private frontPreviewUrl = '';
  private backPreviewUrl = '';
  private autoVerifySnapshot: VerifyDraft | null = null;

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
    this.loading.set(false);
  }

  ngOnDestroy() {
    this.releasePreviewUrl('front');
    this.releasePreviewUrl('back');
  }

  protected beginEdit() {
    this.editMode.set(true);
    this.message.set('');
    this.error.set('');
    this.syncDraft();
  }

  protected cancelEdit() {
    this.editMode.set(false);
    this.message.set('');
    this.error.set('');
    this.syncDraft();
  }

  protected async saveProfile() {
    if (!this.draft.nickname.trim()) {
      this.error.set('昵称不能为空');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    try {
      const user = await this.api.updateUserInfo({
        nickname: this.draft.nickname.trim(),
        description: this.draft.description.trim(),
        qitian: this.draft.qitian.trim(),
        birthday: this.draft.birthday || ''
      });
      this.session.user.set(user);
      this.editMode.set(false);
      this.message.set('资料已保存');
      this.syncDraft();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '资料更新失败');
    } finally {
      this.saving.set(false);
    }
  }

  protected async uploadAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

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
      this.message.set('头像已更新');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      input.value = '';
      this.saving.set(false);
    }
  }

  protected async uploadIdCard(event: Event, back: boolean) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_IDCARD_IMAGE_SIZE) {
      this.error.set('身份证图片不能超过 10MB');
      input.value = '';
      return;
    }

    back ? this.uploadingBack.set(true) : this.uploadingFront.set(true);
    this.message.set('');
    this.error.set('');

    try {
      const uploadToken = await this.api.getIdCardUploadToken(file.name, back);
      await this.api.uploadFile({
        key: uploadToken.key,
        token: uploadToken.upload_token,
        file
      });
      this.setPreview(back ? 'back' : 'front', file);
      this.message.set(back ? '身份证国徽面已上传' : '身份证人像面已上传');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '身份证上传失败');
    } finally {
      input.value = '';
      back ? this.uploadingBack.set(false) : this.uploadingFront.set(false);
    }
  }

  protected startManualVerification() {
    if (!this.canStartVerification) {
      this.error.set('请先上传身份证正反面');
      return;
    }

    this.manualVerification.set(true);
    this.message.set('');
    this.error.set('');
    this.autoVerifySnapshot = null;
    this.verifyDraft = {
      name: this.verifyDraft.name || '',
      male: this.verifyDraft.male,
      idcard: this.verifyDraft.idcard || '',
      birthday: this.verifyDraft.birthday || this.session.user()?.birthday || '',
      validStart: this.verifyDraft.validStart || '',
      validEnd: this.verifyDraft.validEnd || '',
      token: ''
    };
  }

  protected async autoVerify() {
    if (!this.canStartVerification) {
      this.error.set('请先上传身份证正反面');
      return;
    }

    this.verificationBusy.set(true);
    this.message.set('');
    this.error.set('');

    try {
      const payload = await this.api.autoVerify();
      this.manualVerification.set(false);
      this.verifyDraft = {
        name: payload.name || '',
        male: payload.male ?? true,
        idcard: payload.idcard || '',
        birthday: payload.birthday || '',
        validStart: payload.valid_start || '',
        validEnd: payload.valid_end || '',
        token: payload.token || ''
      };
      this.autoVerifySnapshot = { ...this.verifyDraft };
      this.message.set('证件信息已识别，请确认后提交');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '自动识别失败');
    } finally {
      this.verificationBusy.set(false);
    }
  }

  protected async submitVerification() {
    if (!this.canSubmitVerification) {
      this.error.set('请先完善认证资料');
      return;
    }

    const validationMessage = this.validateVerifyDraft();
    if (validationMessage) {
      this.error.set(validationMessage);
      return;
    }

    this.verificationBusy.set(true);
    this.message.set('');
    this.error.set('');

    try {
      const user = await this.api.confirmVerify(this.buildVerifyPayload());
      this.session.user.set(user);
      this.manualVerification.set(false);
      this.verifyDraft = this.emptyVerifyDraft();
      this.autoVerifySnapshot = null;
      this.message.set(user.verify_status === 3 ? '实名认证已完成' : '认证资料已提交，等待人工审核');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '认证提交失败');
    } finally {
      this.verificationBusy.set(false);
    }
  }

  protected async applyDev() {
    if (!this.canApplyDev()) {
      return;
    }

    this.applyingDev.set(true);
    this.message.set('');
    this.error.set('');

    try {
      const user = await this.api.applyDev();
      this.session.user.set(user);
      this.message.set('开发者权限已开通');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '开发者申请失败');
    } finally {
      this.applyingDev.set(false);
    }
  }

  protected selectGender(male: boolean) {
    this.verifyDraft = {
      ...this.verifyDraft,
      male
    };
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
        return '已完成实名认证';
      case 2:
        return '人工审核中';
      case 1:
        return '系统审核中';
      default:
        return '尚未认证';
    }
  }

  protected get developerStatusText() {
    return this.session.user()?.is_dev ? '已开通开发者权限' : '尚未开通开发者权限';
  }

  protected get verifyGuideText() {
    const status = this.session.user()?.verify_status ?? 0;
    if (status === 3) {
      return '当前账号已经完成实名认证，可以继续申请开发者权限。';
    }
    if (status === 2) {
      return '资料已经提交，等待人工审核。';
    }
    if (status === 1) {
      return '系统正在处理认证资料，请稍后刷新查看结果。';
    }
    if (this.showVerifyForm) {
      return this.manualVerification()
        ? '请核对并填写真实身份信息，提交后将进入人工审核。'
        : '自动识别结果已经载入，请确认无误后提交。';
    }
    return '先上传身份证正反面，再进行自动识别或人工审核提交。';
  }

  protected get canStartVerification() {
    return (this.session.user()?.verify_status ?? 0) === 0 && !!this.cardFrontPreview && !!this.cardBackPreview;
  }

  protected get canSubmitVerification() {
    return (this.session.user()?.verify_status ?? 0) === 0 && (this.manualVerification() || !!this.verifyDraft.token);
  }

  protected get showVerifyForm() {
    return this.manualVerification() || !!this.verifyDraft.token;
  }

  protected get verifyActionLabel() {
    if (this.verificationBusy()) {
      return '提交中...';
    }
    return this.manualVerification() ? '提交人工审核' : '确认认证';
  }

  protected get devActionLabel() {
    if (this.applyingDev()) {
      return '开通中...';
    }
    if (this.canApplyDev()) {
      return '申请开发者权限';
    }
    return '完成认证后可申请';
  }

  protected get uploadFrontLabel() {
    return this.uploadingFront() ? '上传中...' : this.cardFrontPreview ? '重新上传人像面' : '上传身份证人像面';
  }

  protected get uploadBackLabel() {
    return this.uploadingBack() ? '上传中...' : this.cardBackPreview ? '重新上传国徽面' : '上传身份证国徽面';
  }

  private buildVerifyPayload() {
    const useAutoToken =
      !this.manualVerification() &&
      !!this.verifyDraft.token &&
      !!this.autoVerifySnapshot &&
      this.isSameVerifyDraft(this.verifyDraft, this.autoVerifySnapshot);

    if (useAutoToken) {
      return {
        token: this.verifyDraft.token
      };
    }

    return {
      name: this.verifyDraft.name.trim(),
      birthday: this.verifyDraft.birthday,
      idcard: this.verifyDraft.idcard.trim(),
      male: this.verifyDraft.male,
      auto: false
    };
  }

  private validateVerifyDraft() {
    if (!this.verifyDraft.name.trim()) {
      return '请输入真实姓名';
    }
    if (!this.verifyDraft.idcard.trim()) {
      return '请输入身份证号';
    }
    if (!this.verifyDraft.birthday) {
      return '请选择生日';
    }
    return '';
  }

  private emptyVerifyDraft(): VerifyDraft {
    return {
      name: '',
      male: true,
      idcard: '',
      birthday: '',
      validStart: '',
      validEnd: '',
      token: ''
    };
  }

  private setPreview(side: 'front' | 'back', file: File) {
    this.releasePreviewUrl(side);
    const url = URL.createObjectURL(file);

    if (side === 'front') {
      this.frontPreviewUrl = url;
      this.cardFrontPreview = url;
      return;
    }

    this.backPreviewUrl = url;
    this.cardBackPreview = url;
  }

  private releasePreviewUrl(side: 'front' | 'back') {
    if (side === 'front' && this.frontPreviewUrl) {
      URL.revokeObjectURL(this.frontPreviewUrl);
      this.frontPreviewUrl = '';
    }

    if (side === 'back' && this.backPreviewUrl) {
      URL.revokeObjectURL(this.backPreviewUrl);
      this.backPreviewUrl = '';
    }
  }

  private isSameVerifyDraft(left: VerifyDraft, right: VerifyDraft) {
    return (
      left.name === right.name &&
      left.male === right.male &&
      left.idcard === right.idcard &&
      left.birthday === right.birthday
    );
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

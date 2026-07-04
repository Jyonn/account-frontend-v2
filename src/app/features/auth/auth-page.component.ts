import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AuthPayload,
  AuthV2CodeVerifyNextPayload,
  AuthV2Intent,
  AuthV2Method,
  AuthV2Purpose
} from '../../core/models/account.models';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { RecaptchaPanelComponent } from '../../shared/recaptcha-panel/recaptcha-panel.component';

type IdentityMode = 'phone' | 'qitian';
type AuthStage = 'identity' | 'credential' | 'verification';
type PhoneCredentialMode = 'password' | 'code';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RecaptchaPanelComponent],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss'
})
export class AuthPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly session = inject(SessionService);
  @ViewChildren('codeDigitInput') private readonly codeDigitInputs?: QueryList<ElementRef<HTMLInputElement>>;

  protected authStage: AuthStage = 'identity';
  protected identityMode: IdentityMode = 'phone';
  protected authIntent: AuthV2Intent = 'login';
  protected phoneCredentialMode: PhoneCredentialMode = 'password';
  protected regionCode = '+86';
  protected phoneNumber = '';
  protected qitianId = '';
  protected password = '';
  protected verificationDigits = Array.from({ length: 6 }, () => '');
  protected message = '';
  protected error = '';
  protected captchaVisible = false;
  protected busy = false;

  private authFlowToken = '';
  private authPurpose: AuthV2Purpose | null = null;
  private allowedMethods: AuthV2Method[] = [];
  private passwordSetupPending = false;

  ngOnInit() {
    if (this.session.isLoggedIn()) {
      void this.router.navigateByUrl('/apps');
    }
  }

  protected switchIdentityMode(mode: IdentityMode) {
    this.identityMode = mode;
    this.authIntent = 'login';
    this.authStage = 'identity';
    this.phoneCredentialMode = 'password';
    this.resetFlowState();
  }

  protected togglePhoneCredentialMode() {
    if (!this.canToggleCredentialMode) {
      return;
    }

    this.phoneCredentialMode = this.phoneCredentialMode === 'password' ? 'code' : 'password';
    this.clearRuntimeFeedback();
    this.password = '';
  }

  protected handleSectionLink() {
    if (this.authStage === 'identity') {
      this.switchIdentityMode(this.identityMode === 'phone' ? 'qitian' : 'phone');
      return;
    }

    if (this.authStage === 'credential' && this.identityMode === 'phone') {
      this.togglePhoneCredentialMode();
    }
  }

  protected async submit() {
    if (this.busy) {
      return;
    }

    this.clearRuntimeFeedback();

    if (this.authStage === 'verification') {
      await this.submitVerificationCode();
      return;
    }

    if (this.authStage === 'identity') {
      const validationMessage = this.validateIdentityStep();
      if (validationMessage) {
        this.error = validationMessage;
        return;
      }

      await this.startSession(this.authIntent);
      return;
    }

    const validationMessage = this.validateCredentialStep();
    if (validationMessage) {
      this.error = validationMessage;
      return;
    }

    if (this.passwordSetupPending || this.usesPasswordCredential) {
      await this.submitPassword();
      return;
    }

    await this.sendVerificationCode();
  }

  protected async submitPhoneIdentity(mode: PhoneCredentialMode) {
    if (this.busy || this.authStage !== 'identity' || this.identityMode !== 'phone') {
      return;
    }

    this.clearRuntimeFeedback();
    const validationMessage = this.validatePhoneIdentity();
    if (validationMessage) {
      this.error = validationMessage;
      return;
    }

    this.phoneCredentialMode = mode;
    this.authIntent = 'login';
    await this.startSession('login');
  }

  protected async onCaptchaResolved(response: string) {
    if (!this.authFlowToken) {
      this.captchaVisible = false;
      this.error = '登录流程无效，请重新开始';
      return;
    }

    this.busy = true;
    this.clearRuntimeFeedback();

    try {
      const payload = await this.api.completeAuthV2Captcha(this.authFlowToken, response);
      this.authFlowToken = payload.flow_token;
      this.authPurpose = payload.purpose;
      this.allowedMethods = payload.allowed_methods;

      if (this.shouldAutoSendCodeAfterCaptcha) {
        this.phoneCredentialMode = 'code';
        this.authStage = 'credential';
        this.password = '';
        await this.sendVerificationCode();
        return;
      }

      this.authStage = 'credential';
      this.password = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : '人机验证失败';
    } finally {
      this.captchaVisible = false;
      this.busy = false;
      this.flushView();
    }
  }

  protected cancelCaptcha() {
    this.captchaVisible = false;
  }

  protected onCaptchaFailed(message: string) {
    this.captchaVisible = false;
    this.error = message;
  }

  protected get drawerTitle() {
    if (this.authStage === 'identity') {
      return this.identityMode === 'phone' ? '手机号' : '齐天号';
    }

    if (this.authStage === 'credential') {
      if (this.passwordSetupPending) {
        return '密码';
      }
      return this.usesPasswordCredential ? '密码' : '验证码';
    }

    return '验证码';
  }

  protected get sectionEyebrow() {
    if (this.authStage === 'identity') {
      return 'Identity';
    }

    if (this.passwordSetupPending) {
      return this.authPurpose === 'register' ? 'Register' : 'Recovery';
    }

    if (this.authStage === 'verification') {
      return 'Verify';
    }

    if (this.authPurpose === 'register') {
      return 'Register';
    }

    if (this.authPurpose === 'reset') {
      return 'Recovery';
    }

    return this.usesPasswordCredential ? 'Credential' : 'Request';
  }

  protected get drawerMeta() {
    if (this.authStage === 'identity') {
      return this.identityMode === 'phone' ? '齐天号登录' : '手机号登录';
    }

    if (this.canToggleCredentialMode) {
      return this.phoneCredentialMode === 'password' ? '验证码登录' : '密码登录';
    }

    return '';
  }

  protected get primaryActionLabel() {
    if (this.busy && this.authStage === 'identity') {
      return '检查中...';
    }

    if (this.authStage === 'identity') {
      return '下一步';
    }

    if (this.authStage === 'credential') {
      if (this.passwordSetupPending) {
        return this.authPurpose === 'register' ? '注册' : '重设并登录';
      }

      return this.usesPasswordCredential ? '登录' : '获取验证码';
    }

    return '验证';
  }

  protected get showMethodSwitch() {
    return this.authStage === 'identity' || this.canToggleCredentialMode;
  }

  protected get showBackAction() {
    return this.authStage === 'credential' || this.authStage === 'verification';
  }

  protected get showRecoverAction() {
    return (
      this.authStage === 'credential' &&
      this.identityMode === 'phone' &&
      this.authPurpose === 'login' &&
      this.phoneCredentialMode === 'password' &&
      !this.passwordSetupPending
    );
  }

  protected handleBackAction() {
    this.clearRuntimeFeedback();

    if (this.authStage === 'verification') {
      this.authStage = 'credential';
      this.verificationDigits = Array.from({ length: 6 }, () => '');
      this.flushView();
      return;
    }

    if (this.passwordSetupPending) {
      this.password = '';
      this.authStage = 'verification';
      this.flushView();
      return;
    }

    this.authStage = 'identity';
    this.authIntent = 'login';
    this.phoneCredentialMode = 'password';
    this.clearFlowState();
    this.flushView();
  }

  protected async beginRecovery() {
    if (this.busy || this.identityMode !== 'phone') {
      return;
    }

    const validationMessage = this.validatePhoneIdentity();
    if (validationMessage) {
      this.error = validationMessage;
      return;
    }

    this.phoneCredentialMode = 'code';
    await this.startSession('recover');
  }

  protected get wholePhoneNumber() {
    return `${this.regionCode.trim()}${this.phoneNumber.trim()}`;
  }

  protected get verificationCode() {
    return this.verificationDigits.join('');
  }

  protected onCodeDigitInput(index: number, value: string) {
    const normalized = value.replace(/\D/g, '').slice(-1);
    this.verificationDigits[index] = normalized;

    if (normalized && index < this.verificationDigits.length - 1) {
      this.focusCodeDigit(index + 1);
    }
  }

  protected onCodeDigitKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !this.verificationDigits[index] && index > 0) {
      this.focusCodeDigit(index - 1);
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusCodeDigit(index - 1);
    }

    if (event.key === 'ArrowRight' && index < this.verificationDigits.length - 1) {
      event.preventDefault();
      this.focusCodeDigit(index + 1);
    }
  }

  protected onCodePaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';
    if (!pasted) {
      return;
    }

    this.verificationDigits = Array.from({ length: 6 }, (_, index) => pasted[index] ?? '');
    this.focusCodeDigit(Math.min(pasted.length, 6) - 1);
  }

  private async startSession(intent: AuthV2Intent) {
    this.busy = true;
    this.clearRuntimeFeedback();

    try {
      const payload =
        this.identityMode === 'phone'
          ? await this.api.startAuthV2Session({
              identity_type: 'phone',
              intent,
              phone: this.wholePhoneNumber
            })
          : await this.api.startAuthV2Session({
              identity_type: 'qitian',
              intent,
              qt: this.qitianId.trim()
            });

      this.authIntent = intent;
      this.authFlowToken = payload.flow_token;
      this.authPurpose = payload.purpose;
      this.allowedMethods = payload.allowed_methods;
      this.passwordSetupPending = false;
      this.verificationDigits = Array.from({ length: 6 }, () => '');

      if (this.identityMode === 'phone') {
        if (!payload.allowed_methods.includes(this.phoneCredentialMode)) {
          this.phoneCredentialMode = payload.allowed_methods.includes('password') ? 'password' : 'code';
        }
      }

      this.captchaVisible = true;
    } catch (error) {
      this.clearFlowState();
      this.authIntent = 'login';
      this.error = error instanceof Error ? error.message : '身份校验失败';
    } finally {
      this.busy = false;
      this.flushView();
    }
  }

  private async submitPassword() {
    if (!this.authFlowToken) {
      this.error = '登录流程无效，请重新开始';
      return;
    }

    this.busy = true;

    try {
      const payload = await this.api.submitAuthV2Password(this.authFlowToken, this.password);
      await this.finishLogin(payload);
    } catch (error) {
      this.error = error instanceof Error ? error.message : '密码提交失败';
    } finally {
      this.busy = false;
      this.flushView();
    }
  }

  private async sendVerificationCode() {
    if (!this.authFlowToken) {
      this.error = '登录流程无效，请重新开始';
      return;
    }

    this.busy = true;

    try {
      const payload = await this.api.sendAuthV2Code(this.authFlowToken);
      this.authFlowToken = payload.flow_token;
      this.authStage = 'verification';
      this.verificationDigits = Array.from({ length: 6 }, () => '');
      this.message = '验证码已发送。';
      this.focusCodeDigit(0);
    } catch (error) {
      this.error = error instanceof Error ? error.message : '验证码发送失败';
    } finally {
      this.busy = false;
      this.flushView();
    }
  }

  private async submitVerificationCode() {
    if (!this.authFlowToken) {
      this.error = '登录流程无效，请重新开始';
      return;
    }

    if (this.verificationCode.length !== 6) {
      this.error = '请输入 6 位验证码';
      return;
    }

    this.busy = true;

    try {
      const payload = await this.api.verifyAuthV2Code(this.authFlowToken, this.verificationCode);
      if (this.isAuthPayload(payload)) {
        await this.finishLogin(payload);
        return;
      }

      this.authFlowToken = payload.flow_token;
      this.passwordSetupPending = true;
      this.phoneCredentialMode = 'password';
      this.authStage = 'credential';
      this.password = '';
      this.message = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : '验证码提交失败';
    } finally {
      this.busy = false;
      this.flushView();
    }
  }

  private validateIdentityStep() {
    if (this.identityMode === 'qitian') {
      return this.qitianId.trim() ? '' : '请输入齐天号';
    }

    return this.validatePhoneIdentity();
  }

  private validatePhoneIdentity() {
    return this.phoneNumber.trim() ? '' : '请输入手机号';
  }

  private validateCredentialStep() {
    if (!this.usesPasswordCredential && !this.passwordSetupPending) {
      return '';
    }

    return this.password ? '' : '请输入密码';
  }

  private clearRuntimeFeedback() {
    this.message = '';
    this.error = '';
  }

  private clearFlowState() {
    this.authFlowToken = '';
    this.authPurpose = null;
    this.allowedMethods = [];
    this.passwordSetupPending = false;
    this.captchaVisible = false;
  }

  private resetFlowState() {
    this.clearRuntimeFeedback();
    this.clearFlowState();
    this.verificationDigits = Array.from({ length: 6 }, () => '');
    this.password = '';
  }

  private get canToggleCredentialMode() {
    return (
      this.authStage === 'credential' &&
      this.identityMode === 'phone' &&
      this.authPurpose === 'login' &&
      !this.passwordSetupPending &&
      this.allowedMethods.includes('password') &&
      this.allowedMethods.includes('code')
    );
  }

  private get usesPasswordCredential() {
    return this.identityMode === 'qitian' || this.phoneCredentialMode === 'password';
  }

  private get shouldAutoSendCodeAfterCaptcha() {
    return (
      this.identityMode === 'phone' &&
      !this.passwordSetupPending &&
      this.allowedMethods.length === 1 &&
      this.allowedMethods[0] === 'code'
    );
  }

  private isAuthPayload(payload: AuthPayload | AuthV2CodeVerifyNextPayload): payload is AuthPayload {
    return 'token' in payload;
  }

  private async finishLogin(payload: AuthPayload) {
    this.clearFlowState();
    this.session.acceptLogin(payload);
    await this.router.navigateByUrl('/apps');
  }

  private flushView() {
    this.cdr.detectChanges();
  }

  private focusCodeDigit(index: number) {
    setTimeout(() => {
      this.codeDigitInputs?.get(index)?.nativeElement.focus();
      this.codeDigitInputs?.get(index)?.nativeElement.select();
    });
  }
}

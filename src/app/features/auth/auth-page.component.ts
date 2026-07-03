import { Component, ElementRef, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { AuthPayload, CaptchaFlowResult } from '../../core/models/account.models';
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
  protected readonly session = inject(SessionService);
  @ViewChildren('codeDigitInput') private readonly codeDigitInputs?: QueryList<ElementRef<HTMLInputElement>>;

  protected authStage: AuthStage = 'identity';
  protected identityMode: IdentityMode = 'phone';
  protected phoneCredentialMode: PhoneCredentialMode = 'password';
  protected regionCode = '+86';
  protected phoneNumber = '';
  protected qitianId = '';
  protected password = '';
  protected verificationDigits = Array.from({ length: 6 }, () => '');
  protected verificationMode: 5 | 6 | 7 | null = null;
  protected message = '';
  protected error = '';
  protected captchaVisible = false;
  protected busy = false;

  ngOnInit() {
    if (this.session.isLoggedIn()) {
      void this.router.navigateByUrl('/apps');
    }
  }

  protected switchIdentityMode(mode: IdentityMode) {
    this.identityMode = mode;
    this.phoneCredentialMode = 'password';
    this.authStage = 'identity';
    this.resetFlowState();
  }

  protected togglePhoneCredentialMode() {
    if (this.identityMode !== 'phone' || this.authStage !== 'credential') {
      return;
    }

    this.phoneCredentialMode = this.phoneCredentialMode === 'password' ? 'code' : 'password';
    this.error = '';
    this.message = '';
    this.password = '';
  }

  protected handleSectionLink() {
    if (this.authStage === 'identity') {
      this.switchIdentityMode(this.identityMode === 'phone' ? 'qitian' : 'phone');
      return;
    }

    if (this.authStage === 'credential') {
      if (this.identityMode === 'phone') {
        this.togglePhoneCredentialMode();
      } else {
        this.authStage = 'identity';
        this.error = '';
        this.message = '';
      }
      return;
    }

    this.resetVerification();
  }

  protected async submit() {
    this.error = '';
    this.message = '';

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

      this.authStage = 'credential';
      return;
    }

    const validationMessage = this.validateCredentialStep();
    if (validationMessage) {
      this.error = validationMessage;
      return;
    }

    this.captchaVisible = true;
  }

  protected async onCaptchaResolved(response: string) {
    this.busy = true;
    this.error = '';
    this.message = '';

    try {
      if (this.identityMode === 'phone' && this.phoneCredentialMode === 'code') {
        const payload = (await this.api.beginCaptchaFlow({
          mode: 0,
          response,
          phone: this.wholePhoneNumber
        })) as CaptchaFlowResult;
        this.verificationMode = payload.next_mode;
        this.verificationDigits = Array.from({ length: 6 }, () => '');
        this.password = '';
        this.authStage = 'verification';
        this.message = payload.toast_msg || '验证码已发送。';
        this.focusCodeDigit(0);
      } else if (this.identityMode === 'phone') {
        const payload = (await this.api.beginCaptchaFlow({
          mode: 1,
          response,
          phone: this.wholePhoneNumber,
          pwd: this.password
        })) as AuthPayload;
        await this.finishLogin(payload);
      } else {
        const payload = (await this.api.beginCaptchaFlow({
          mode: 2,
          response,
          qt: this.qitianId.trim(),
          pwd: this.password
        })) as AuthPayload;
        await this.finishLogin(payload);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : '操作失败';
    } finally {
      this.captchaVisible = false;
      this.busy = false;
    }
  }

  protected cancelCaptcha() {
    this.captchaVisible = false;
  }

  protected onCaptchaFailed(message: string) {
    this.captchaVisible = false;
    this.error = message;
  }

  protected resetVerification() {
    this.authStage = 'credential';
    this.verificationMode = null;
    this.verificationDigits = Array.from({ length: 6 }, () => '');
    this.password = '';
    this.message = '';
  }

  protected get needsPasswordForCodeStep() {
    return this.verificationMode === 6 || this.verificationMode === 7;
  }

  protected get drawerTitle() {
    if (this.authStage === 'identity') {
      return this.identityMode === 'phone' ? '手机号' : '齐天号';
    }
    if (this.authStage === 'credential') {
      return this.identityMode === 'phone' && this.phoneCredentialMode === 'code' ? '验证码' : '密码';
    }
    return '验证码';
  }

  protected get drawerMeta() {
    if (this.authStage === 'identity') {
      return this.identityMode === 'phone' ? '齐天号登录' : '手机号登录';
    }
    if (this.authStage === 'credential' && this.identityMode === 'phone') {
      return this.phoneCredentialMode === 'password' ? '验证码登录' : '密码登录';
    }
    if (this.authStage === 'credential') {
      return '返回上一步';
    }
    return '返回上一步';
  }

  protected get primaryActionLabel() {
    if (this.authStage === 'identity') {
      return '下一步';
    }
    if (this.authStage === 'credential') {
      return this.identityMode === 'phone' && this.phoneCredentialMode === 'code' ? '获取验证码' : '下一步';
    }
    return '验证';
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

  private async submitVerificationCode() {
    if (!this.verificationCode || this.verificationCode.length !== 6) {
      this.error = '请输入 6 位验证码';
      return;
    }

    if (this.needsPasswordForCodeStep && !this.password) {
      this.error = '请先设置密码';
      return;
    }

    this.busy = true;
    this.error = '';

    try {
      const payload = (await this.api.beginCaptchaFlow({
        mode: this.verificationMode,
        code: this.verificationCode,
        ...(this.needsPasswordForCodeStep ? { pwd: this.password } : {})
      })) as AuthPayload;
      await this.finishLogin(payload);
    } catch (error) {
      this.error = error instanceof Error ? error.message : '验证码提交失败';
    } finally {
      this.busy = false;
    }
  }

  private validateIdentityStep() {
    if (this.identityMode === 'qitian') {
      return this.qitianId.trim() ? '' : '请输入齐天号';
    }

    return this.phoneNumber.trim() ? '' : '请输入手机号';
  }

  private validateCredentialStep() {
    if (this.identityMode === 'qitian') {
      if (!this.password) {
        return '请输入密码';
      }
      return '';
    }

    if (this.phoneCredentialMode === 'password' && !this.password) {
      return '请输入密码';
    }

    return '';
  }

  private resetFlowState() {
    this.message = '';
    this.error = '';
    this.captchaVisible = false;
    this.verificationMode = null;
    this.verificationDigits = Array.from({ length: 6 }, () => '');
    this.password = '';
  }

  private async finishLogin(payload: AuthPayload) {
    this.session.acceptLogin(payload);
    await this.router.navigateByUrl('/apps');
  }

  private focusCodeDigit(index: number) {
    setTimeout(() => {
      this.codeDigitInputs?.get(index)?.nativeElement.focus();
      this.codeDigitInputs?.get(index)?.nativeElement.select();
    });
  }
}

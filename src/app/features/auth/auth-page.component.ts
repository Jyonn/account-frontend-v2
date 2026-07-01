import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { AuthPayload, CaptchaFlowResult } from '../../core/models/account.models';
import { RecaptchaPanelComponent } from '../../shared/recaptcha-panel/recaptcha-panel.component';

type CredentialMode = 'qitian-password' | 'phone-password' | 'phone-code';

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

  protected mode: CredentialMode = 'qitian-password';
  protected regionCode = '+86';
  protected phoneNumber = '';
  protected qitianId = '';
  protected password = '';
  protected verificationCode = '';
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

  protected switchMode(mode: CredentialMode) {
    this.mode = mode;
    this.message = '';
    this.error = '';
    this.captchaVisible = false;
    this.verificationMode = null;
    this.verificationCode = '';
    if (mode !== 'phone-password') {
      this.password = '';
    }
  }

  protected async submit() {
    this.error = '';
    this.message = '';

    if (this.verificationMode !== null) {
      await this.submitVerificationCode();
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
      if (this.mode === 'phone-code') {
        const payload = (await this.api.beginCaptchaFlow({
          mode: 0,
          response,
          phone: this.wholePhoneNumber
        })) as CaptchaFlowResult;
        this.verificationMode = payload.next_mode;
        this.verificationCode = '';
        this.password = '';
        this.message = payload.toast_msg || '验证码已发送。';
      } else if (this.mode === 'phone-password') {
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
          qt: this.qitianId,
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
    this.verificationMode = null;
    this.verificationCode = '';
    this.password = '';
    this.message = '';
  }

  protected get needsPasswordForCodeStep() {
    return this.verificationMode === 6 || this.verificationMode === 7;
  }

  protected get codeStepLabel() {
    if (this.verificationMode === 6) {
      return '设置密码';
    }
    if (this.verificationMode === 7) {
      return '新密码';
    }
    return '6位验证码';
  }

  protected get wholePhoneNumber() {
    return `${this.regionCode}${this.phoneNumber}`;
  }

  protected get modeLabel() {
    switch (this.mode) {
      case 'phone-password':
        return '手机号 + 密码';
      case 'phone-code':
        return '手机号 + 验证码';
      default:
        return '齐天号 + 密码';
    }
  }

  protected get verificationRequiredText() {
    return this.verificationMode === null ? '需要' : '已进入下一步';
  }

  protected get verificationStepText() {
    if (this.verificationMode === 5) {
      return '等待输入短信验证码';
    }
    if (this.verificationMode === 6) {
      return '验证码通过后需要设置密码';
    }
    if (this.verificationMode === 7) {
      return '验证码通过后需要重设密码';
    }
    return '尚未开始';
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

  private validateCredentialStep() {
    if (this.mode === 'qitian-password') {
      if (!this.qitianId) {
        return '请输入齐天号';
      }
      if (!this.password) {
        return '请输入密码';
      }
      return '';
    }

    if (!this.phoneNumber) {
      return '请输入手机号';
    }

    if (this.mode === 'phone-password' && !this.password) {
      return '请输入密码';
    }

    return '';
  }

  private async finishLogin(payload: AuthPayload) {
    this.session.acceptLogin(payload);
    await this.router.navigateByUrl('/apps');
  }
}

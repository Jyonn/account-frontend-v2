import { Injectable } from '@angular/core';

const SCRIPT_ID = 'account-recaptcha-script';
const SCRIPT_SRC = 'https://recaptcha.net/recaptcha/api.js?hl=zh-CN&render=explicit&onload=onAccountRecaptchaLoaded';

@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private readyTask: Promise<void> | null = null;

  ensureReady() {
    if (window.grecaptcha?.render) {
      return Promise.resolve();
    }

    if (this.readyTask) {
      return this.readyTask;
    }

    this.readyTask = new Promise<void>((resolve, reject) => {
      window.onAccountRecaptchaLoaded = () => resolve();

      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        this.waitForWindowCaptcha(resolve, reject);
        return;
      }

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.defer = true;
      script.onerror = () => reject(new Error('reCAPTCHA 脚本加载失败'));
      document.head.appendChild(script);
    });

    return this.readyTask;
  }

  private waitForWindowCaptcha(resolve: () => void, reject: (reason?: unknown) => void) {
    let retry = 0;
    const timer = window.setInterval(() => {
      if (window.grecaptcha?.render) {
        window.clearInterval(timer);
        resolve();
        return;
      }

      retry += 1;
      if (retry > 60) {
        window.clearInterval(timer);
        reject(new Error('reCAPTCHA 初始化超时'));
      }
    }, 100);
  }
}

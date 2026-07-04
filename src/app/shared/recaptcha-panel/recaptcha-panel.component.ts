import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { RecaptchaService } from '../../core/services/recaptcha.service';

declare const grecaptcha: Window['grecaptcha'];

@Component({
  selector: 'app-recaptcha-panel',
  standalone: true,
  templateUrl: './recaptcha-panel.component.html',
  styleUrl: './recaptcha-panel.component.scss'
})
export class RecaptchaPanelComponent implements AfterViewInit, OnChanges {
  @Input() visible = false;
  @Input() busy = false;
  @Output() resolved = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() failed = new EventEmitter<string>();

  @ViewChild('captchaSlot') private captchaSlot?: ElementRef<HTMLDivElement>;

  private readonly recaptcha = inject(RecaptchaService);
  private viewReady = false;
  private widgetId: number | null = null;
  private retryTimerId: number | null = null;
  protected state: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  protected errorMessage = '';
  protected retryCooldown = 0;

  ngAfterViewInit() {
    this.viewReady = true;
    this.maybeRender();
  }

  ngOnDestroy() {
    this.clearRetryCooldown();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('visible' in changes) {
      if (!this.visible) {
        this.state = 'idle';
        this.errorMessage = '';
        this.retryCooldown = 0;
        this.clearRetryCooldown();
      } else {
        this.startRetryCooldown();
      }
      this.maybeRender();
    }
  }

  protected cancel() {
    this.cancelled.emit();
  }

  protected retry() {
    if (this.busy || this.retryCooldown > 0) {
      return;
    }

    this.errorMessage = '';
    this.startRetryCooldown();
    this.maybeRenderInternal();
  }

  protected get retryLabel() {
    return this.retryCooldown > 0 ? `${this.retryCooldown}s 后可重新加载` : '点击此处重新加载';
  }

  private maybeRender() {
    this.maybeRenderInternal();
  }

  private maybeRenderInternal() {
    if (!this.visible || !this.viewReady) {
      return;
    }

    this.state = 'loading';
    this.errorMessage = '';

    void this.recaptcha
      .ensureReady()
      .then(() => {
        window.setTimeout(() => this.renderWidget(), 40);
      })
      .catch((error: Error) => {
        this.state = 'error';
        this.errorMessage = error.message || 'reCAPTCHA 加载失败';
      });
  }

  private renderWidget() {
    if (!this.visible || !this.captchaSlot || !grecaptcha) {
      return;
    }

    if (this.widgetId !== null) {
      grecaptcha.reset(this.widgetId);
      this.state = 'ready';
      return;
    }

    this.widgetId = grecaptcha.render(this.captchaSlot.nativeElement, {
      sitekey: '6LdL9I4UAAAAANyqEJ8vBeDZJz-hvcafJJnhGaWb',
      theme: 'dark',
      callback: (token: string) => this.resolved.emit(token),
      'expired-callback': () => {
        this.state = 'error';
        this.errorMessage = '验证码已过期，请重试。';
      }
    });

    this.state = 'ready';
  }

  private startRetryCooldown() {
    this.retryCooldown = 5;
    this.clearRetryCooldown();
    this.retryTimerId = window.setInterval(() => {
      this.retryCooldown -= 1;
      if (this.retryCooldown <= 0) {
        this.retryCooldown = 0;
        this.clearRetryCooldown();
      }
    }, 1000);
  }

  private clearRetryCooldown() {
    if (this.retryTimerId !== null) {
      window.clearInterval(this.retryTimerId);
      this.retryTimerId = null;
    }
  }
}

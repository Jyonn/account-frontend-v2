import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { RecaptchaService } from '../../core/services/recaptcha.service';

declare const grecaptcha: Window['grecaptcha'];

@Component({
  selector: 'app-recaptcha-panel',
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

  ngAfterViewInit() {
    this.viewReady = true;
    this.maybeRender();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('visible' in changes) {
      this.maybeRender();
    }
  }

  protected cancel() {
    this.cancelled.emit();
  }

  private maybeRender() {
    if (!this.visible || !this.viewReady) {
      return;
    }

    void this.recaptcha
      .ensureReady()
      .then(() => {
        window.setTimeout(() => this.renderWidget(), 40);
      })
      .catch((error: Error) => this.failed.emit(error.message));
  }

  private renderWidget() {
    if (!this.visible || !this.captchaSlot || !grecaptcha) {
      return;
    }

    if (this.widgetId !== null) {
      grecaptcha.reset(this.widgetId);
      return;
    }

    this.widgetId = grecaptcha.render(this.captchaSlot.nativeElement, {
      sitekey: '6LdL9I4UAAAAANyqEJ8vBeDZJz-hvcafJJnhGaWb',
      theme: 'dark',
      callback: (token: string) => this.resolved.emit(token),
      'expired-callback': () => this.failed.emit('验证码已过期，请重试。')
    });
  }
}

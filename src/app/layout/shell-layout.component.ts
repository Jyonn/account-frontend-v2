import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/services/session.service';

@Component({
  selector: 'app-shell-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.scss'
})
export class ShellLayoutComponent implements OnInit {
  protected readonly session = inject(SessionService);
  protected readonly mobileNavOpen = signal(false);
  protected readonly shouldShowLoginNav = computed(() => !this.session.isLoggedIn());
  protected readonly sessionStatusText = computed(() => {
    switch (this.session.status()) {
      case 'loading':
        return '正在恢复登录状态';
      case 'ready':
        return '会话已就绪';
      default:
        return '等待检查本地会话';
    }
  });
  protected readonly tokenStatusText = computed(() => this.session.token() ? '已缓存' : '未缓存');
  protected readonly developerStatusText = computed(() => this.session.user()?.is_dev ? '已开通' : '未开通');
  protected readonly qitianStatusText = computed(() => this.session.user()?.qitian || '未设置');

  ngOnInit() {
    void this.session.bootstrap();
  }

  protected toggleMobileNav() {
    this.mobileNavOpen.update((value) => !value);
  }

  protected closeMobileNav() {
    this.mobileNavOpen.set(false);
  }
}

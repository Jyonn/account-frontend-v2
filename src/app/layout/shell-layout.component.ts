import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SessionService } from '../core/services/session.service';

@Component({
  selector: 'app-shell-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.scss'
})
export class ShellLayoutComponent implements OnInit {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly navOpen = signal(false);
  protected readonly currentPath = signal(this.router.url);
  protected readonly tiltX = signal(0);
  protected readonly tiltY = signal(0);
  protected readonly shouldShowLoginNav = computed(() => !this.session.isLoggedIn());
  protected readonly sessionStatusText = computed(() => {
    switch (this.session.status()) {
      case 'loading':
        return '会话同步中';
      case 'ready':
        return this.session.isLoggedIn() ? '身份已识别' : '等待登录';
      default:
        return '等待本地会话';
    }
  });
  protected readonly sphereSlices = [
    { index: 0, offset: '-7.1rem', xOffset: '-1.55rem', scale: '0.58', opacity: '0.88', tone: '0.82', blur: '0.026rem', zIndex: '100' },
    { index: 1, offset: '-5.6rem', xOffset: '-1.1rem', scale: '0.82', opacity: '0.9', tone: '0.76', blur: '0.022rem', zIndex: '99' },
    { index: 2, offset: '-4rem', xOffset: '-0.55rem', scale: '0.98', opacity: '0.92', tone: '0.69', blur: '0.018rem', zIndex: '98' },
    { index: 3, offset: '-2.1rem', xOffset: '-0.05rem', scale: '1.1', opacity: '0.93', tone: '0.62', blur: '0.014rem', zIndex: '97' },
    { index: 4, offset: '-0.1rem', xOffset: '0.38rem', scale: '1.17', opacity: '0.93', tone: '0.55', blur: '0.012rem', zIndex: '96' },
    { index: 5, offset: '1.95rem', xOffset: '0.78rem', scale: '1.15', opacity: '0.92', tone: '0.48', blur: '0.013rem', zIndex: '95' },
    { index: 6, offset: '3.95rem', xOffset: '1rem', scale: '1.04', opacity: '0.89', tone: '0.4', blur: '0.016rem', zIndex: '94' },
    { index: 7, offset: '5.75rem', xOffset: '0.88rem', scale: '0.88', opacity: '0.85', tone: '0.32', blur: '0.02rem', zIndex: '93' },
    { index: 8, offset: '7.2rem', xOffset: '0.45rem', scale: '0.72', opacity: '0.8', tone: '0.25', blur: '0.024rem', zIndex: '92' },
    { index: 9, offset: '8.3rem', xOffset: '-0.05rem', scale: '0.58', opacity: '0.74', tone: '0.19', blur: '0.03rem', zIndex: '91' }
  ];
  protected readonly currentSectionLabel = computed(() => {
    const path = this.currentPath();
    if (path.startsWith('/settings')) {
      return '账户';
    }
    if (path.startsWith('/apps')) {
      return '应用';
    }
    return '入口';
  });

  ngOnInit() {
    void this.session.bootstrap();
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      this.currentPath.set(this.router.url);
      this.navOpen.set(false);
    });
  }

  protected toggleNav() {
    this.navOpen.update((value) => !value);
  }

  protected closeNav() {
    this.navOpen.set(false);
  }

  protected updateSphereTilt(event: MouseEvent) {
    const stage = event.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    const ratioX = (event.clientX - rect.left) / rect.width - 0.5;
    const ratioY = (event.clientY - rect.top) / rect.height - 0.5;
    this.tiltX.set(-ratioY * 5.5);
    this.tiltY.set(ratioX * 8);
  }

  protected resetSphereTilt() {
    this.tiltX.set(0);
    this.tiltY.set(0);
  }
}

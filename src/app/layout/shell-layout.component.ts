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
    { index: 0, offset: '-7.9rem', scale: '0.62', opacity: '0.88', tone: '0.8', blur: '0.03rem', zIndex: '100' },
    { index: 1, offset: '-6.1rem', scale: '0.88', opacity: '0.9', tone: '0.74', blur: '0.026rem', zIndex: '99' },
    { index: 2, offset: '-4.3rem', scale: '1.04', opacity: '0.92', tone: '0.68', blur: '0.022rem', zIndex: '98' },
    { index: 3, offset: '-2.2rem', scale: '1.14', opacity: '0.93', tone: '0.61', blur: '0.018rem', zIndex: '97' },
    { index: 4, offset: '0rem', scale: '1.18', opacity: '0.92', tone: '0.54', blur: '0.012rem', zIndex: '96' },
    { index: 5, offset: '2.2rem', scale: '1.12', opacity: '0.9', tone: '0.47', blur: '0.014rem', zIndex: '95' },
    { index: 6, offset: '4.4rem', scale: '0.98', opacity: '0.88', tone: '0.39', blur: '0.018rem', zIndex: '94' },
    { index: 7, offset: '6.3rem', scale: '0.82', opacity: '0.84', tone: '0.31', blur: '0.022rem', zIndex: '93' },
    { index: 8, offset: '7.9rem', scale: '0.68', opacity: '0.8', tone: '0.24', blur: '0.028rem', zIndex: '92' },
    { index: 9, offset: '9rem', scale: '0.56', opacity: '0.72', tone: '0.19', blur: '0.034rem', zIndex: '91' }
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

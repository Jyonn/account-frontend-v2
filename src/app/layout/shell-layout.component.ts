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
  protected readonly sphereSlices = Array.from({ length: 13 }, (_, index) => {
    const position = index / 12;
    const theta = (position - 0.5) * Math.PI;
    const radius = Math.cos(theta);
    return {
      index,
      offset: `${Math.sin(theta) * 8.5}rem`,
      depth: `${radius * 2.2}rem`,
      scale: `${0.28 + radius * 0.78}`,
      blur: `${(1 - radius) * 0.08}rem`,
      brightness: `${0.76 + radius * 0.22}`,
      opacity: `${0.22 + radius * 0.7}`
    };
  });
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

import { Component, OnInit, inject } from '@angular/core';
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

  ngOnInit() {
    void this.session.bootstrap();
  }
}

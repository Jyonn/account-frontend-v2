import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthPayload, UserProfile } from '../models/account.models';
import { ApiService } from './api.service';

const PRIMARY_TOKEN_KEY = 'user-token-v2';
const FALLBACK_TOKEN_KEY = 'user-token';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly token = signal(this.readToken());
  readonly user = signal<UserProfile | null>(null);
  readonly status = signal<'idle' | 'loading' | 'ready'>('idle');
  readonly error = signal('');
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user()?.user_str_id);

  private bootstrapTask: Promise<void> | null = null;

  bootstrap() {
    if (this.bootstrapTask) {
      return this.bootstrapTask;
    }

    this.bootstrapTask = this.bootstrapInternal();
    return this.bootstrapTask;
  }

  acceptLogin(payload: AuthPayload) {
    this.persistToken(payload.token);
    this.user.set(payload.user);
    this.error.set('');
    this.status.set('ready');
  }

  async refreshProfile() {
    if (!this.token()) {
      this.user.set(null);
      return;
    }

    try {
      const profile = await this.api.getProfile();
      this.user.set(profile);
      this.error.set('');
    } catch (error) {
      this.clearSession();
      this.error.set(error instanceof Error ? error.message : '会话已失效');
    }
  }

  async logout() {
    this.clearSession();
    await this.router.navigateByUrl('/login');
  }

  private async bootstrapInternal() {
    this.status.set('loading');
    if (!this.token()) {
      this.status.set('ready');
      return;
    }

    await this.refreshProfile();
    this.status.set('ready');
  }

  private persistToken(token: string) {
    localStorage.setItem(PRIMARY_TOKEN_KEY, token);
    this.token.set(token);
  }

  private clearSession() {
    localStorage.removeItem(PRIMARY_TOKEN_KEY);
    this.token.set('');
    this.user.set(null);
  }

  private readToken() {
    return localStorage.getItem(PRIMARY_TOKEN_KEY) || localStorage.getItem(FALLBACK_TOKEN_KEY) || '';
  }
}

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AccountApp,
  AuthPayload,
  CaptchaFlowResult,
  LegacyEnvelope,
  OAuthPayload,
  UserProfile
} from '../models/account.models';

const API_HOST = 'https://api.qt.6-79.cn';
const TOKEN_KEYS = ['user-token-v2', 'user-token'] as const;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  async getProfile() {
    return this.request<UserProfile>('GET', '/user/');
  }

  async getAppList(params: Record<string, string | number | boolean | null | undefined>) {
    return this.request<AccountApp[]>('GET', '/app/', { params });
  }

  async getAppDetail(appId: string) {
    return this.request<AccountApp>('GET', `/app/${appId}`);
  }

  async beginCaptchaFlow(payload: Record<string, unknown>) {
    return this.request<CaptchaFlowResult | AuthPayload>('POST', '/base/recaptcha', { body: payload });
  }

  async authorizeApp(appId: string) {
    return this.request<OAuthPayload>('POST', '/oauth/', { body: { app_id: appId } });
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | null | undefined>;
    } = {}
  ) {
    try {
      const response = await firstValueFrom(
        this.http.request<LegacyEnvelope<T>>(method, `${API_HOST}${path}`, {
          body: options.body,
          params: this.cleanParams(options.params),
          headers: this.buildHeaders(),
          withCredentials: true,
          responseType: 'json'
        })
      );

      if (!response || response.identifier !== 'OK') {
        throw new Error(response?.user_message || response?.identifier || '请求失败');
      }

      return response.body;
    } catch (error: unknown) {
      throw new Error(this.resolveError(error));
    }
  }

  private buildHeaders() {
    const token = this.readToken();
    return new HttpHeaders({
      Token: token
    });
  }

  private cleanParams(params?: Record<string, string | number | boolean | null | undefined>) {
    if (!params) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
    );
  }

  private readToken() {
    for (const key of TOKEN_KEYS) {
      const value = localStorage.getItem(key);
      if (value) {
        return value;
      }
    }
    return '';
  }

  private resolveError(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'user_message' in error.error &&
      typeof error.error.user_message === 'string'
    ) {
      return error.error.user_message;
    }

    return '网络请求失败';
  }
}

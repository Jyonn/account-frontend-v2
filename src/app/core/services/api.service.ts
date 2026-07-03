import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AccountApp,
  AuthPayload,
  CaptchaFlowResult,
  ChoiceItem,
  LegacyEnvelope,
  OAuthPayload,
  QitianCheckPayload,
  UploadTokenPayload,
  UserProfile
} from '../models/account.models';

const API_HOST = 'https://api.qt.6-79.cn';
const QINIU_HOST = 'https://up.qiniup.com';
const TOKEN_KEYS = ['user-token-v2', 'user-token'] as const;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  async getProfile() {
    const profile = await this.request<UserProfile>('GET', '/user/');
    return this.normalizeUser(profile);
  }

  async checkQitian(qitian: string) {
    return this.request<QitianCheckPayload>('GET', '/user/qitian', {
      params: { qitian }
    });
  }

  async getAppList(params: Record<string, string | number | boolean | null | undefined>) {
    const apps = await this.request<AccountApp[]>('GET', '/app/', { params });
    return apps.map((app) => this.normalizeApp(app));
  }

  async getAppDetail(appId: string) {
    const app = await this.request<AccountApp>('GET', `/app/${appId}`);
    return this.normalizeApp(app);
  }

  async getAppSecret(appId: string) {
    return this.request<string>('GET', `/app/${appId}/secret`);
  }

  async getAppScope() {
    const scopes = await this.request<Array<{ name: string; desc: string; detail?: string; always?: boolean | null }>>(
      'GET',
      '/app/scope'
    );
    return scopes.map((scope) => ({
      id: scope.name,
      key: scope.desc,
      detail: scope.detail,
      always: scope.always,
      selected: scope.always === true
    })) satisfies ChoiceItem[];
  }

  async getAppPremise() {
    const premises = await this.request<Array<{ name: string; desc: string; detail?: string; always?: boolean | null }>>(
      'GET',
      '/app/premise'
    );
    return premises.map((premise) => ({
      id: premise.name,
      key: premise.desc,
      detail: premise.detail,
      always: premise.always,
      selected: premise.always === true
    })) satisfies ChoiceItem[];
  }

  async updateAppInfo(
    appId: string,
    payload: {
      name: string;
      desc: string;
      info: string;
      redirect_uri: string;
      test_redirect_uri: string;
      scopes: string[];
      premises: string[];
    }
  ) {
    const app = await this.request<AccountApp>('PUT', `/app/${appId}`, { body: payload });
    return this.normalizeApp(app);
  }

  async updateUserInfo(payload: {
    nickname?: string;
    description?: string;
    qitian?: string;
    birthday?: string;
  }) {
    const profile = await this.request<UserProfile>('PUT', '/user/', { body: payload });
    return this.normalizeUser(profile);
  }

  async applyDev() {
    const profile = await this.request<UserProfile>('POST', '/user/dev', { body: {} });
    return this.normalizeUser(profile);
  }

  async getLogoUploadToken(filename: string, appId: string) {
    return this.request<UploadTokenPayload>('GET', '/app/logo', {
      params: {
        filename,
        app_id: appId
      }
    });
  }

  async getAvatarUploadToken(filename: string) {
    return this.request<UploadTokenPayload>('GET', '/user/avatar', {
      params: {
        filename
      }
    });
  }

  async uploadFile(payload: { key: string; token: string; file: File }) {
    const formData = new FormData();
    formData.append('key', payload.key);
    formData.append('token', payload.token);
    formData.append('file', payload.file);

    const response = await firstValueFrom(
      this.http.post<LegacyEnvelope<unknown>>(QINIU_HOST, formData, {
        headers: new HttpHeaders(),
        withCredentials: false
      })
    );

    if (!response || response.identifier !== 'OK') {
      throw new Error(response?.user_message || response?.identifier || '上传失败');
    }

    return response.body;
  }

  async beginCaptchaFlow(payload: Record<string, unknown>) {
    return this.request<CaptchaFlowResult | AuthPayload>('POST', '/base/recaptcha', { body: payload });
  }

  async authorizeApp(appId: string) {
    return this.request<OAuthPayload>('POST', '/oauth/', { body: { app_id: appId } });
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | null | undefined>;
    } = {}
  ) {
    try {
      const response =
        method === 'GET'
          ? await firstValueFrom(
              this.http.get<LegacyEnvelope<T>>(`${API_HOST}${path}`, {
                params: this.cleanParams(options.params),
                headers: this.buildHeaders(),
                withCredentials: true
              })
            )
          : method === 'POST'
            ? await firstValueFrom(
              this.http.post<LegacyEnvelope<T>>(`${API_HOST}${path}`, options.body, {
                params: this.cleanParams(options.params),
                headers: this.buildHeaders(),
                withCredentials: true
              })
            )
            : await firstValueFrom(
              this.http.put<LegacyEnvelope<T>>(`${API_HOST}${path}`, options.body, {
                params: this.cleanParams(options.params),
                headers: this.buildHeaders(),
                withCredentials: true
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
    ) as Record<string, string | number | boolean>;
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

  private normalizeApp(app: AccountApp) {
    return {
      ...app,
      logo: this.normalizeMedia(app.logo),
      scopes: this.normalizeChoices(
        ((app.scopes as Array<{ name?: string; desc?: string; detail?: string; always?: boolean | null }> | undefined) || [])
      ),
      premises: this.normalizeChoices(
        ((app.premises as Array<{ name?: string; desc?: string; detail?: string; always?: boolean | null }> | undefined) || [])
      )
    } satisfies AccountApp;
  }

  private normalizeUser(user: UserProfile) {
    return {
      ...user,
      avatar: this.normalizeMedia(user.avatar)
    } satisfies UserProfile;
  }

  private normalizeMedia(value: string | { link?: string | null } | null | undefined) {
    if (!value) {
      return null;
    }
    return typeof value === 'string' ? value : value.link || null;
  }

  private normalizeChoices(items: Array<{ name?: string; desc?: string; detail?: string; always?: boolean | null }>) {
    return items.map((item) => ({
      id: item.name || '',
      key: item.desc || item.name || '',
      detail: item.detail,
      always: item.always,
      selected: item.always === true
    }));
  }
}

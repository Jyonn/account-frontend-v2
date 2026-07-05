import { Injectable, inject } from '@angular/core';
import { AccountApp } from '../models/account.models';
import { ApiService } from './api.service';

export interface AppRegistrySnapshot {
  allApps: AccountApp[];
  devApps: AccountApp[];
}

@Injectable({ providedIn: 'root' })
export class AppRegistryService {
  private static readonly APP_LIST_FETCH_COUNT = 100;

  private readonly api = inject(ApiService);
  private preloadTask: Promise<AppRegistrySnapshot> | null = null;
  private snapshot: AppRegistrySnapshot | null = null;

  preload(force = false) {
    if (!force && this.snapshot) {
      return Promise.resolve(this.snapshot);
    }

    if (!force && this.preloadTask) {
      return this.preloadTask;
    }

    this.preloadTask = Promise.all([
      this.api.getAppList({ relation: 'none', frequent: false, count: AppRegistryService.APP_LIST_FETCH_COUNT }),
      this.api.getAppList({ relation: 'owner', count: AppRegistryService.APP_LIST_FETCH_COUNT })
    ])
      .then(([allApps, devApps]) => {
        this.snapshot = { allApps, devApps };
        return this.snapshot;
      })
      .finally(() => {
        this.preloadTask = null;
      });

    return this.preloadTask;
  }

  consume() {
    const snapshot = this.snapshot;
    this.snapshot = null;
    return snapshot;
  }

  clear() {
    this.preloadTask = null;
    this.snapshot = null;
  }
}

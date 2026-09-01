import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  migrateSettings,
} from '@knowledge-quest/learning';
import {
  LocalStorageAdapter,
  readLaunchSettingsFromUrl,
  SettingsRepository,
} from '@knowledge-quest/storage';

export type { AppSettings };
/** @deprecated Use AppSettings */
export type GameSettings = AppSettings;

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly repository = new SettingsRepository(new LocalStorageAdapter());
  private settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
  private settingsSubject = new BehaviorSubject<AppSettings>(this.settings);
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const fromLaunch = readLaunchSettingsFromUrl();
        if (fromLaunch) {
          await this.repository.save(fromLaunch);
          this.settings = fromLaunch;
        } else {
          this.settings = await this.repository.load();
        }
        this.settingsSubject.next(this.settings);
      })();
    }
    return this.initPromise;
  }

  getSettings() {
    return this.settingsSubject.asObservable();
  }

  getCurrentSettings(): AppSettings {
    return this.settings;
  }

  async updateSettings(newSettings: AppSettings | Partial<AppSettings>) {
    this.settings = migrateSettings({
      ...this.settings,
      ...newSettings,
      math: {
        ...this.settings.math,
        ...(newSettings as Partial<AppSettings>).math,
        operations: {
          ...this.settings.math.operations,
          ...(newSettings as Partial<AppSettings>).math?.operations,
        },
        numberRanges: {
          ...this.settings.math.numberRanges,
          ...(newSettings as Partial<AppSettings>).math?.numberRanges,
        },
      },
      portuguese: {
        categories: {
          ...this.settings.portuguese.categories,
          ...(newSettings as Partial<AppSettings>).portuguese?.categories,
        },
      },
      reading: {
        ...this.settings.reading,
        ...(newSettings as Partial<AppSettings>).reading,
      },
    });
    await this.repository.save(this.settings);
    this.settingsSubject.next(this.settings);
  }
}

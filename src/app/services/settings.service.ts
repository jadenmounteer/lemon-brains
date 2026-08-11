import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  migrateSettings,
} from '../learning/models/app-settings';

export type { AppSettings };
/** @deprecated Use AppSettings */
export type GameSettings = AppSettings;

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private settings: AppSettings;
  private settingsSubject = new BehaviorSubject<AppSettings>(
    structuredClone(DEFAULT_APP_SETTINGS)
  );

  constructor() {
    this.settings = this.loadSettings();
    this.settingsSubject.next(this.settings);
  }

  getSettings() {
    return this.settingsSubject.asObservable();
  }

  getCurrentSettings(): AppSettings {
    return this.settings;
  }

  updateSettings(newSettings: AppSettings | Partial<AppSettings>) {
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
    this.saveSettings();
    this.settingsSubject.next(this.settings);
  }

  private loadSettings(): AppSettings {
    const savedSettings = localStorage.getItem('lemonBrainsSettings');
    if (!savedSettings) {
      return structuredClone(DEFAULT_APP_SETTINGS);
    }

    try {
      return migrateSettings(JSON.parse(savedSettings));
    } catch (e) {
      console.warn('Failed to parse settings from localStorage:', e);
      return structuredClone(DEFAULT_APP_SETTINGS);
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(
        'lemonBrainsSettings',
        JSON.stringify(this.settings)
      );
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }
}

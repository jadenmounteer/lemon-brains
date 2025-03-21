import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface GameSettings {
  questionTypes: {
    addition: boolean;
    subtraction: boolean;
    multiplication: boolean;
    division: boolean;
  };
  numberRanges: {
    range0to5: boolean;
    range5to10: boolean;
    range10to20: boolean;
  };
}

const DEFAULT_SETTINGS: GameSettings = {
  questionTypes: {
    addition: true,
    subtraction: true,
    multiplication: true,
    division: true,
  },
  numberRanges: {
    range0to5: true,
    range5to10: false,
    range10to20: false,
  },
};

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private settings: GameSettings;
  private settingsSubject = new BehaviorSubject<GameSettings>(DEFAULT_SETTINGS);

  constructor() {
    this.settings = this.loadSettings();
    this.settingsSubject.next(this.settings);
  }

  getSettings() {
    return this.settingsSubject.asObservable();
  }

  getCurrentSettings(): GameSettings {
    return this.settings;
  }

  updateSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.settingsSubject.next(this.settings);
  }

  private loadSettings(): GameSettings {
    const savedSettings = localStorage.getItem('lemonBrainsSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Ensure all required properties exist
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          questionTypes: {
            ...DEFAULT_SETTINGS.questionTypes,
            ...parsed.questionTypes,
          },
        };
      } catch (e) {
        console.warn('Failed to parse settings from localStorage:', e);
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
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

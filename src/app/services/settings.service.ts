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
  gameDifficulty: 'easy' | 'normal' | 'hard';

  /** 
 * 
 *   Easy Mode:
Initial spawn rate: 6 seconds
Minimum spawn rate: 2 seconds
Spawn rate decrease: 100ms every 20 seconds
King zombie health: 10 hits
Fat zombie health: 3-4 hits
Speed multiplier: 0.8x (20% slower)
Normal Mode:
Initial spawn rate: 5 seconds
Minimum spawn rate: 1.5 seconds
Spawn rate decrease: 150ms every 15 seconds
King zombie health: 8 hits
Fat zombie health: 2-3 hits
Speed multiplier: 1x (normal speed)
Hard Mode:
Initial spawn rate: 4 seconds
Minimum spawn rate: 1 second
Spawn rate decrease: 200ms every 10 seconds
King zombie health: 6 hits (dies faster but spawns more frequently)
Fat zombie health: 2 hits
Speed multiplier: 1.2x (20% faster)
The difficulty settings create distinct experiences:
Easy mode is more forgiving with slower zombies and more time between spawns
Normal mode provides a balanced challenge
Hard mode creates intense gameplay with faster, more frequent zombies

 */
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
  gameDifficulty: 'normal',
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

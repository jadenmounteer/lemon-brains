import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  migrateSettings,
} from '@knowledge-quest/learning';
import { StoragePort } from './storage-port';

export const SETTINGS_STORAGE_KEY = 'knowledgeQuest.settings';
const LEGACY_SETTINGS_KEY = 'lemonBrainsSettings';

export class SettingsRepository {
  constructor(
    private readonly storage: StoragePort,
    private readonly key: string = SETTINGS_STORAGE_KEY
  ) {}

  async load(): Promise<AppSettings> {
    const raw = await this.storage.getItem(this.key);
    if (raw) {
      try {
        return migrateSettings(JSON.parse(raw));
      } catch (error) {
        console.warn('Failed to parse settings:', error);
      }
    }

    const legacy = await this.storage.getItem(LEGACY_SETTINGS_KEY);
    if (legacy) {
      try {
        const migrated = migrateSettings(JSON.parse(legacy));
        await this.save(migrated);
        return migrated;
      } catch (error) {
        console.warn('Failed to migrate legacy settings:', error);
      }
    }

    return structuredClone(DEFAULT_APP_SETTINGS);
  }

  async save(settings: AppSettings): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(settings));
  }
}

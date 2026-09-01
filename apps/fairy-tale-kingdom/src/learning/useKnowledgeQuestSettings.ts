import { useCallback, useEffect, useState } from 'react';
import type { AppSettings } from '@knowledge-quest/learning';
import { DEFAULT_APP_SETTINGS } from '@knowledge-quest/learning';
import {
  LocalStorageAdapter,
  readLaunchSettingsFromUrl,
  SettingsRepository,
  SETTINGS_STORAGE_KEY,
} from '@knowledge-quest/storage';
import { READING_QUICK_START } from '../game/core/GameModeProfile';

const repository = new SettingsRepository(new LocalStorageAdapter());

/** One-click reading defaults for Learning Mode / onboarding. */
export function readingQuickStartSettings(): AppSettings {
  return {
    ...structuredClone(DEFAULT_APP_SETTINGS),
    curriculumId: 'reading',
    readQuestionsAloud: READING_QUICK_START.readAloud,
    gameDifficulty: READING_QUICK_START.gameDifficulty,
    reading: {
      letterRecognition: true,
      cvcWords: false,
      sightWords: false,
    },
  };
}

export function useKnowledgeQuestSettings() {
  const [settings, setSettings] = useState<AppSettings>(
    structuredClone(DEFAULT_APP_SETTINGS)
  );
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const fromLaunch = readLaunchSettingsFromUrl();
    if (fromLaunch) {
      await repository.save(fromLaunch);
      setSettings(fromLaunch);
      setReady(true);
      return fromLaunch;
    }
    const loaded = await repository.load();
    setSettings(loaded);
    setReady(true);
    return loaded;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload().then(() => {
      if (cancelled) return;
    });

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === SETTINGS_STORAGE_KEY ||
        event.key === 'lemonBrainsSettings'
      ) {
        void reload();
      }
    };
    const onFocus = () => {
      void reload();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload]);

  const save = useCallback(async (next: AppSettings) => {
    await repository.save(next);
    setSettings(next);
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = {
        ...settings,
        ...partial,
        math: { ...settings.math, ...(partial.math ?? {}) },
        portuguese: {
          ...settings.portuguese,
          ...(partial.portuguese ?? {}),
        },
        reading: { ...settings.reading, ...(partial.reading ?? {}) },
      };
      await save(next);
      return next;
    },
    [save, settings]
  );

  const applyReadingQuickStart = useCallback(async () => {
    const next = readingQuickStartSettings();
    await save(next);
    return next;
  }, [save]);

  return {
    settings,
    ready,
    reload,
    save,
    updateSettings,
    applyReadingQuickStart,
  };
}

/** @deprecated Use useKnowledgeQuestSettings */
export const useSettings = useKnowledgeQuestSettings;

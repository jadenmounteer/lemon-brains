import { useEffect, useState } from 'react';
import type { AppSettings } from '@knowledge-quest/learning';
import { DEFAULT_APP_SETTINGS } from '@knowledge-quest/learning';
import {
  LocalStorageAdapter,
  SettingsRepository,
} from '@knowledge-quest/storage';

const repository = new SettingsRepository(new LocalStorageAdapter());

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(
    structuredClone(DEFAULT_APP_SETTINGS)
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, ready };
}

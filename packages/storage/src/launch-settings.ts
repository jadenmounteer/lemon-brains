import { AppSettings, migrateSettings } from '@knowledge-quest/learning';

export const LAUNCH_SETTINGS_QUERY_KEY = 'kqSettings';

/** Serialize settings for a cross-app launch URL (host → game on another dev port). */
export function encodeLaunchSettings(settings: AppSettings): string {
  return encodeURIComponent(btoa(JSON.stringify(settings)));
}

export function decodeLaunchSettings(encoded: string): AppSettings | null {
  try {
    return migrateSettings(JSON.parse(atob(decodeURIComponent(encoded))));
  } catch {
    return null;
  }
}

/** Read settings passed on launch, strip the query param, and return them. */
export function readLaunchSettingsFromUrl(): AppSettings | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(LAUNCH_SETTINGS_QUERY_KEY);
  if (!encoded) {
    return null;
  }

  const settings = decodeLaunchSettings(encoded);
  if (!settings) {
    return null;
  }

  params.delete(LAUNCH_SETTINGS_QUERY_KEY);
  const clean =
    window.location.pathname +
    (params.toString() ? `?${params.toString()}` : '') +
    window.location.hash;
  window.history.replaceState({}, '', clean);
  return settings;
}

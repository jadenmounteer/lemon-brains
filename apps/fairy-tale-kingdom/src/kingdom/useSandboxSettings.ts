import { useCallback, useState } from 'react';
import {
  DEFAULT_SANDBOX_SETTINGS,
  loadSandboxSettings,
  normalizeSandboxSettings,
  resetSandboxSettings,
  saveSandboxSettings,
  type SandboxSettings,
} from './sandboxSettings';

export function useSandboxSettings() {
  const [settings, setSettings] = useState<SandboxSettings>(() =>
    loadSandboxSettings()
  );

  const updateSettings = useCallback((next: SandboxSettings) => {
    const normalized = normalizeSandboxSettings(next);
    setSettings(normalized);
    saveSandboxSettings(normalized);
  }, []);

  const patchSettings = useCallback(
    (patch: (prev: SandboxSettings) => SandboxSettings) => {
      setSettings((prev) => {
        const normalized = normalizeSandboxSettings(patch(prev));
        saveSandboxSettings(normalized);
        return normalized;
      });
    },
    []
  );

  const reset = useCallback(() => {
    const next = resetSandboxSettings();
    setSettings(next);
    return next;
  }, []);

  return {
    settings,
    updateSettings,
    patchSettings,
    reset,
    defaults: DEFAULT_SANDBOX_SETTINGS,
  };
}

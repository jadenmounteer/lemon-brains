import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SANDBOX_SETTINGS,
  normalizeSandboxSettings,
} from '../sandboxSettings';

describe('normalizeSandboxSettings', () => {
  it('returns defaults for invalid version', () => {
    const n = normalizeSandboxSettings({ version: 99 as 3 });
    expect(n.version).toBe(4);
    expect(n.war.intensity).toBe(DEFAULT_SANDBOX_SETTINGS.war.intensity);
  });

  it('migrates v1 sickness defaults', () => {
    const n = normalizeSandboxSettings({
      version: 1,
      sickness: { hungerRise: 1, sickAtHunger: 75, witchCurse: 1 },
    });
    expect(n.sickness.hungerRise).toBe(DEFAULT_SANDBOX_SETTINGS.sickness.hungerRise);
    expect(n.sickness.sickAtHunger).toBe(DEFAULT_SANDBOX_SETTINGS.sickness.sickAtHunger);
  });

  it('clamps war intensity to 0–2', () => {
    const n = normalizeSandboxSettings({
      version: 3,
      war: { ...DEFAULT_SANDBOX_SETTINGS.war, intensity: 5 },
    });
    expect(n.war.intensity).toBe(2);
  });

  it('defaults undead beta off', () => {
    expect(DEFAULT_SANDBOX_SETTINGS.undead.kinds.vampire).toBe(false);
    expect(DEFAULT_SANDBOX_SETTINGS.undead.vampire).toBe(0);
  });
});

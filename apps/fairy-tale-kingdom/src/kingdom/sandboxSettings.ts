import type { CampKind } from '../game/war/WarBalance';
import type { MonsterKind } from '../game/monsters/MonsterSystem';

export const SANDBOX_REGISTRY_KEY = 'sandboxSettings';

export type CampKindEnable = Record<CampKind, boolean>;
export type MonsterKindEnable = Record<MonsterKind, boolean>;

export interface SandboxSettings {
  version: 1 | 2;
  war: {
    /** 0–2 overall war intensity (1 = default). */
    intensity: number;
    campSpawnRate: number;
    raidPressure: number;
    siegeRate: number;
    garrisonGrowth: number;
    starterCampCount: number;
    kinds: CampKindEnable;
  };
  monsters: {
    spawnRate: number;
    hungerHunt: number;
    kinds: MonsterKindEnable;
  };
  sickness: {
    hungerRise: number;
    sickAtHunger: number;
    witchCurse: number;
  };
  undead: {
    vampire: number;
    necromancer: number;
    ghost: number;
  };
  buildings: {
    wallHpMult: number;
  };
}

const ALL_CAMPS_ON: CampKindEnable = {
  bandit: true,
  giant: true,
  goblin: true,
  thief: true,
  siege: true,
  gypsy: true,
  coven: true,
};

const ALL_MONSTERS_ON: MonsterKindEnable = {
  troll: true,
  ogre: true,
  dragon: true,
};

export const DEFAULT_SANDBOX_SETTINGS: SandboxSettings = {
  version: 2,
  war: {
    intensity: 1,
    campSpawnRate: 1,
    raidPressure: 1,
    siegeRate: 1,
    garrisonGrowth: 1,
    starterCampCount: 1,
    kinds: { ...ALL_CAMPS_ON },
  },
  monsters: {
    spawnRate: 1,
    hungerHunt: 1,
    kinds: { ...ALL_MONSTERS_ON },
  },
  sickness: {
    hungerRise: 0.25,
    sickAtHunger: 90,
    witchCurse: 1,
  },
  undead: {
    vampire: 1,
    necromancer: 1,
    ghost: 1,
  },
  buildings: {
    wallHpMult: 1,
  },
};

const STORAGE_KEY = 'ftk-sandbox-settings';

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampMult(n: number): number {
  return clamp(n, 0, 2);
}

export function normalizeSandboxSettings(
  raw: Partial<SandboxSettings> | null | undefined
): SandboxSettings {
  const d = DEFAULT_SANDBOX_SETTINGS;
  if (!raw || (raw.version !== 1 && raw.version !== 2)) {
    return structuredClone(d);
  }

  // v1 → v2: adopt calmer sickness defaults when the player still had stock values
  let hungerRise = raw.sickness?.hungerRise ?? d.sickness.hungerRise;
  let sickAtHunger = raw.sickness?.sickAtHunger ?? d.sickness.sickAtHunger;
  if (raw.version === 1) {
    if (hungerRise === 1) hungerRise = d.sickness.hungerRise;
    if (sickAtHunger === 75) sickAtHunger = d.sickness.sickAtHunger;
  }

  return {
    version: 2,
    war: {
      intensity: clampMult(raw.war?.intensity ?? d.war.intensity),
      campSpawnRate: clampMult(raw.war?.campSpawnRate ?? d.war.campSpawnRate),
      raidPressure: clampMult(raw.war?.raidPressure ?? d.war.raidPressure),
      siegeRate: clampMult(raw.war?.siegeRate ?? d.war.siegeRate),
      garrisonGrowth: clampMult(raw.war?.garrisonGrowth ?? d.war.garrisonGrowth),
      starterCampCount: clamp(
        Math.round(raw.war?.starterCampCount ?? d.war.starterCampCount),
        0,
        4
      ),
      kinds: {
        ...ALL_CAMPS_ON,
        ...(raw.war?.kinds ?? {}),
      },
    },
    monsters: {
      spawnRate: clampMult(raw.monsters?.spawnRate ?? d.monsters.spawnRate),
      hungerHunt: clampMult(raw.monsters?.hungerHunt ?? d.monsters.hungerHunt),
      kinds: {
        ...ALL_MONSTERS_ON,
        ...(raw.monsters?.kinds ?? {}),
      },
    },
    sickness: {
      hungerRise: clampMult(hungerRise),
      sickAtHunger: clamp(Math.round(sickAtHunger), 40, 100),
      witchCurse: clampMult(raw.sickness?.witchCurse ?? d.sickness.witchCurse),
    },
    undead: {
      vampire: clampMult(raw.undead?.vampire ?? d.undead.vampire),
      necromancer: clampMult(raw.undead?.necromancer ?? d.undead.necromancer),
      ghost: clampMult(raw.undead?.ghost ?? d.undead.ghost),
    },
    buildings: {
      wallHpMult: clamp(
        raw.buildings?.wallHpMult ?? d.buildings.wallHpMult,
        0.25,
        4
      ),
    },
  };
}

export function loadSandboxSettings(): SandboxSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SANDBOX_SETTINGS);
    return normalizeSandboxSettings(JSON.parse(raw) as Partial<SandboxSettings>);
  } catch {
    return structuredClone(DEFAULT_SANDBOX_SETTINGS);
  }
}

export function saveSandboxSettings(settings: SandboxSettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeSandboxSettings(settings))
    );
  } catch {
    /* ignore */
  }
}

export function resetSandboxSettings(): SandboxSettings {
  const next = structuredClone(DEFAULT_SANDBOX_SETTINGS);
  saveSandboxSettings(next);
  return next;
}

/** Safe read from a Phaser registry (or fall back to defaults). */
export function readSandboxFromRegistry(
  registry: { get: (key: string) => unknown } | null | undefined
): SandboxSettings {
  if (!registry) return structuredClone(DEFAULT_SANDBOX_SETTINGS);
  try {
    return normalizeSandboxSettings(
      registry.get(SANDBOX_REGISTRY_KEY) as Partial<SandboxSettings> | undefined
    );
  } catch {
    return structuredClone(DEFAULT_SANDBOX_SETTINGS);
  }
}

import type { UnitRole } from '../game/art/assetManifest';
import type { CampKind } from '../game/war/WarBalance';
import type { MonsterKind } from '../game/monsters/MonsterSystem';
import { HIRE_CATALOG } from '../marketplace/catalog';

export const SANDBOX_REGISTRY_KEY = 'sandboxSettings';

export type CampKindEnable = Record<CampKind, boolean>;
export type MonsterKindEnable = Record<MonsterKind, boolean>;
export type UndeadKindEnable = {
  vampire: boolean;
  necromancer: boolean;
  ghost: boolean;
};
/** Hireable kingdom roles — toggles gate marketplace hiring. */
export type UnitKindEnable = Record<UnitRole, boolean>;

export interface SandboxSettings {
  version: 1 | 2 | 3 | 4 | 5;
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
  units: {
    kinds: UnitKindEnable;
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
    kinds: UndeadKindEnable;
  };
  buildings: {
    wallHpMult: number;
  };
  life: {
    /** Fairy Godmother auto-grants career wishes when criteria are met. */
    fgmAutoGrant: boolean;
  };
}

/** Roles shown as sandbox unit toggles (marketplace hire list). */
export const SANDBOX_UNIT_ROLES: UnitRole[] = HIRE_CATALOG.map((h) => h.role);

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

const ALL_UNDEAD_OFF: UndeadKindEnable = {
  vampire: false,
  necromancer: false,
  ghost: false,
};

function allUnitsOn(): UnitKindEnable {
  const kinds = {} as UnitKindEnable;
  for (const role of SANDBOX_UNIT_ROLES) kinds[role] = true;
  // Ensure every UnitRole key exists for Record typing / hire checks
  const extras: UnitRole[] = [
    'child',
    'prince',
    'princess',
    'witch',
    'necromancer',
    'zombie',
    'vampire_wife',
    'bandit',
    'thief',
    'gypsy',
  ];
  for (const role of extras) kinds[role] = true;
  return kinds;
}

export const DEFAULT_SANDBOX_SETTINGS: SandboxSettings = {
  version: 4,
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
  units: {
    kinds: allUnitsOn(),
  },
  sickness: {
    hungerRise: 0.25,
    sickAtHunger: 90,
    witchCurse: 1,
  },
  undead: {
    vampire: 0,
    necromancer: 0,
    ghost: 0,
    kinds: { ...ALL_UNDEAD_OFF },
  },
  buildings: {
    wallHpMult: 1,
  },
  life: {
    fgmAutoGrant: true,
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
  if (!raw || (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4 && raw.version !== 5)) {
    return structuredClone(d);
  }

  const hadUndeadKinds =
    raw.undead?.kinds &&
    typeof raw.undead.kinds === 'object' &&
    ('vampire' in raw.undead.kinds ||
      'necromancer' in raw.undead.kinds ||
      'ghost' in raw.undead.kinds);

  // v1 → v2: adopt calmer sickness defaults when the player still had stock values
  let hungerRise = raw.sickness?.hungerRise ?? d.sickness.hungerRise;
  let sickAtHunger = raw.sickness?.sickAtHunger ?? d.sickness.sickAtHunger;
  if (raw.version === 1) {
    if (hungerRise === 1) hungerRise = d.sickness.hungerRise;
    if (sickAtHunger === 75) sickAtHunger = d.sickness.sickAtHunger;
  }

  const undeadKinds = hadUndeadKinds
    ? {
        ...ALL_UNDEAD_OFF,
        ...(raw.undead?.kinds ?? {}),
      }
    : { ...ALL_UNDEAD_OFF };

  const undeadRates = hadUndeadKinds
    ? {
        vampire: clampMult(raw.undead?.vampire ?? d.undead.vampire),
        necromancer: clampMult(raw.undead?.necromancer ?? d.undead.necromancer),
        ghost: clampMult(raw.undead?.ghost ?? d.undead.ghost),
      }
    : { vampire: 0, necromancer: 0, ghost: 0 };

  return {
    version: 5,
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
    units: {
      kinds: {
        ...allUnitsOn(),
        ...(raw.units?.kinds ?? {}),
      },
    },
    sickness: {
      hungerRise: clampMult(hungerRise),
      sickAtHunger: clamp(Math.round(sickAtHunger), 40, 100),
      witchCurse: clampMult(raw.sickness?.witchCurse ?? d.sickness.witchCurse),
    },
    undead: {
      ...undeadRates,
      kinds: undeadKinds,
    },
    buildings: {
      wallHpMult: clamp(
        raw.buildings?.wallHpMult ?? d.buildings.wallHpMult,
        0.25,
        4
      ),
    },
    life: {
      fgmAutoGrant: raw.life?.fgmAutoGrant ?? d.life.fgmAutoGrant,
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

/** Instant spawn actions from the sandbox panel (for funsies). */
export type SandboxSpawnAction =
  | { type: 'camp'; campKind: CampKind }
  | { type: 'monster'; monsterKind: MonsterKind }
  | { type: 'undead'; undeadKind: 'vampire' | 'necromancer' | 'ghost' }
  | { type: 'witch' }
  | { type: 'raid'; raidKind: 'bandit' | 'giant' | 'goblin' | 'enemy_army' | 'gypsy' }
  | { type: 'unit'; role: UnitRole };

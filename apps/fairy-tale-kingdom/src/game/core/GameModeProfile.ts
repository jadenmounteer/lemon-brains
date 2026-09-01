/** Kingdom-wide pacing profile derived from sandbox difficulty + kingdom mode. */

export type KingdomGameMode = 'learning' | 'normal';

export type GameDifficulty = 'easy' | 'normal' | 'hard';

export interface GameModeProfile {
  /** Multiplier on raid/siege early pressure (0–1 base scaled). */
  raidPressureMult: number;
  /** Extra ms before first raid attempt in a new kingdom. */
  raidGraceMs: number;
  /** Global gap between major celebrations. */
  celebrationGapMult: number;
  /** Gold per correct reading answer. */
  goldPerCorrect: number;
  /** Whether undead spawns are allowed (sandbox can still override). */
  undeadEnabled: boolean;
  /** Scatter celebrations on raid start vs pause timer. */
  scatterOnRaid: boolean;
  /** Monster seed count at kingdom start. */
  starterMonsterCount: number;
  /** Camp spawn interval multiplier (>1 = slower). */
  campSpawnMult: number;
}

const LEARNING: GameModeProfile = {
  raidPressureMult: 0.65,
  raidGraceMs: 120_000,
  celebrationGapMult: 1.5,
  goldPerCorrect: 8,
  undeadEnabled: false,
  scatterOnRaid: true,
  starterMonsterCount: 0,
  campSpawnMult: 1.35,
};

const NORMAL: GameModeProfile = {
  raidPressureMult: 1,
  raidGraceMs: 45_000,
  celebrationGapMult: 1,
  goldPerCorrect: 5,
  undeadEnabled: false,
  scatterOnRaid: false,
  starterMonsterCount: 1,
  campSpawnMult: 1,
};

const DIFFICULTY_MULT: Record<GameDifficulty, Partial<GameModeProfile>> = {
  easy: { raidPressureMult: 0.75, campSpawnMult: 1.25 },
  normal: {},
  hard: { raidPressureMult: 1.25, campSpawnMult: 0.85, starterMonsterCount: 2 },
};

function merge(base: GameModeProfile, patch: Partial<GameModeProfile>): GameModeProfile {
  return { ...base, ...patch };
}

export function resolveGameModeProfile(
  difficulty: GameDifficulty | undefined,
  kingdomMode: KingdomGameMode | undefined
): GameModeProfile {
  const base = kingdomMode === 'learning' ? LEARNING : NORMAL;
  const diff = DIFFICULTY_MULT[difficulty ?? 'normal'] ?? {};
  return merge(base, diff);
}

/** Reading Quick Start defaults when curriculum is not configured. */
export const READING_QUICK_START = {
  gameDifficulty: 'easy' as GameDifficulty,
  topics: ['hear-letter', 'see-letter'] as const,
  readAloud: true,
};

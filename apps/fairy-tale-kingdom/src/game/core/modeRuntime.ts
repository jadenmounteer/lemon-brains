import {
  resolveGameModeProfile,
  type GameDifficulty,
  type GameModeProfile,
  type KingdomGameMode,
} from './GameModeProfile';

/** Module cache so balance helpers without Scene can read live mode profile. */
let runtime: GameModeProfile = resolveGameModeProfile('normal', 'normal');

export function setModeRuntime(
  kingdomMode: KingdomGameMode,
  difficulty?: GameDifficulty
): void {
  runtime = resolveGameModeProfile(difficulty, kingdomMode);
}

export function getModeProfile(): GameModeProfile {
  return runtime;
}

export function resetModeRuntimeDefaults(): void {
  runtime = resolveGameModeProfile('normal', 'normal');
}

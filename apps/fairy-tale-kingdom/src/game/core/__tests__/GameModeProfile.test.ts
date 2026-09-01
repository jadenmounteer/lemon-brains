import { describe, expect, it } from 'vitest';
import {
  resolveGameModeProfile,
  READING_QUICK_START,
} from '../GameModeProfile';

describe('resolveGameModeProfile', () => {
  it('learning mode is calmer than normal', () => {
    const learning = resolveGameModeProfile('normal', 'learning');
    const normal = resolveGameModeProfile('normal', 'normal');
    expect(learning.raidPressureMult).toBeLessThan(normal.raidPressureMult);
    expect(learning.raidGraceMs).toBeGreaterThan(normal.raidGraceMs);
    expect(learning.goldPerCorrect).toBeGreaterThan(normal.goldPerCorrect);
    expect(learning.scatterOnRaid).toBe(true);
    expect(normal.scatterOnRaid).toBe(false);
  });

  it('hard difficulty increases pressure', () => {
    const hard = resolveGameModeProfile('hard', 'normal');
    const easy = resolveGameModeProfile('easy', 'normal');
    expect(hard.raidPressureMult).toBeGreaterThan(easy.raidPressureMult!);
    expect(hard.starterMonsterCount).toBeGreaterThan(easy.starterMonsterCount!);
  });

  it('undead disabled by default in both modes', () => {
    expect(resolveGameModeProfile('normal', 'learning').undeadEnabled).toBe(false);
    expect(resolveGameModeProfile('normal', 'normal').undeadEnabled).toBe(false);
  });
});

describe('READING_QUICK_START', () => {
  it('uses easy difficulty with hear/see letter topics', () => {
    expect(READING_QUICK_START.gameDifficulty).toBe('easy');
    expect(READING_QUICK_START.readAloud).toBe(true);
    expect(READING_QUICK_START.topics).toContain('hear-letter');
  });
});

import { describe, expect, it } from 'vitest';
import {
  challengeAction,
  earlyChainComplete,
  getNextEarlyChallenge,
  isChallengeComplete,
  pickOccasionalChallenge,
} from '../challenges';
import type { KingdomStats } from '../../game/subjects/types';

const baseStats: KingdomStats = {
  population: 8,
  capacity: 12,
  freeBeds: 4,
  houseCount: 3,
  wallCount: 0,
  tavernCount: 0,
  fieldCount: 0,
  granaryCount: 0,
  keepCount: 1,
  hasCathedral: false,
  hasInfirmary: false,
  hasDungeon: false,
  hasBarracks: false,
  hasGallows: false,
  hasCemetery: false,
  hasDock: false,
  dockCount: 0,
  fishingBoatCount: 0,
  fishingBoatCapacity: 0,
  warshipCount: 0,
  warshipCapacity: 0,
  hasKing: false,
  hasQueen: false,
  hasPrince: false,
  hasPrincess: false,
  hasFairyGodmother: false,
  hasBishop: false,
  hasGeneral: false,
  hasKnight: false,
  hasExecutioner: false,
  royaltyUnlocked: false,
  inspired: false,
  food: 20,
  captiveCount: 0,
  kingCount: 0,
  queenCount: 0,
  fieldSlots: 0,
  militaryAvailable: 0,
};

describe('challenges', () => {
  it('walks the early chain in order', () => {
    expect(getNextEarlyChallenge([])?.id).toBe('ch-earn-gold');
    expect(getNextEarlyChallenge(['ch-earn-gold'])?.id).toBe('ch-build-granary');
    expect(
      getNextEarlyChallenge([
        'ch-earn-gold',
        'ch-build-granary',
        'ch-build-field',
        'ch-build-walls',
      ])?.id
    ).toBe('ch-hire-knight');
    expect(
      earlyChainComplete([
        'ch-earn-gold',
        'ch-build-granary',
        'ch-build-field',
        'ch-build-walls',
        'ch-hire-knight',
      ])
    ).toBe(true);
  });

  it('detects build and hire completion', () => {
    const granary = getNextEarlyChallenge(['ch-earn-gold'])!;
    expect(
      isChallengeComplete(granary, {
        gold: 50,
        stats: { ...baseStats, granaryCount: 1 },
      })
    ).toBe(true);

    const knight = getNextEarlyChallenge([
      'ch-earn-gold',
      'ch-build-granary',
      'ch-build-field',
      'ch-build-walls',
    ])!;
    expect(
      isChallengeComplete(knight, {
        gold: 50,
        stats: { ...baseStats, hasKnight: true },
      })
    ).toBe(true);
  });

  it('completes monster and wedding challenges from events', () => {
    expect(
      isChallengeComplete(
        {
          id: 'ch-slay-troll',
          kind: 'knight_slay_monster',
          title: 't',
          detail: 'd',
          rewardGold: 40,
          payload: { monsterKind: 'troll' },
        },
        { gold: 10, stats: baseStats, slainMonsterKind: 'troll' }
      )
    ).toBe(true);

    expect(
      isChallengeComplete(
        {
          id: 'ch-royal-wedding',
          kind: 'royal_marriage_ball',
          title: 't',
          detail: 'd',
          rewardGold: 50,
        },
        { gold: 10, stats: baseStats, royalWeddingJustCompleted: true }
      )
    ).toBe(true);
  });

  it('does not offer occasional before early chain completes', () => {
    expect(
      pickOccasionalChallenge({
        claimedIds: ['ch-earn-gold'],
        stats: baseStats,
        monstersPresent: ['troll'],
        nextOfferAt: 0,
      })
    ).toBeNull();
  });

  it('maps actions for CTAs', () => {
    expect(challengeAction(getNextEarlyChallenge([])!)).toBe('questions');
    expect(challengeAction(getNextEarlyChallenge(['ch-earn-gold'])!)).toBe(
      'market-granary'
    );
  });
});

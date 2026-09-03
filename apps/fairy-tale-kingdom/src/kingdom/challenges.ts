import type { UnitRole } from '../game/art/assetManifest';
import type { KingdomStats } from '../game/subjects/types';

export type ChallengeKind =
  | 'earn_gold'
  | 'build_granary'
  | 'build_field'
  | 'build_walls'
  | 'hire_role'
  | 'royal_marriage_ball'
  | 'knight_slay_monster';

export type MonsterChallengeKind = 'troll' | 'ogre' | 'dragon';

export interface RealmChallenge {
  id: string;
  kind: ChallengeKind;
  title: string;
  detail: string;
  rewardGold: number;
  payload?: { role?: UnitRole; monsterKind?: MonsterChallengeKind };
}

export type ChallengeAction =
  | 'questions'
  | 'market'
  | 'market-granary'
  | 'market-field'
  | 'market-wall'
  | 'hire-hint'
  | 'royal-hint'
  | 'hunt-hint';

const EARLY_CHAIN: RealmChallenge[] = [
  {
    id: 'ch-earn-gold',
    kind: 'earn_gold',
    title: 'Fill the treasury',
    detail: 'Open Questions and answer reading problems to earn gold.',
    rewardGold: 15,
  },
  {
    id: 'ch-build-granary',
    kind: 'build_granary',
    title: 'Build a granary',
    detail: 'Open the Marketplace and place a granary so fields can store food.',
    rewardGold: 20,
  },
  {
    id: 'ch-build-field',
    kind: 'build_field',
    title: 'Plant a field',
    detail: 'With a granary ready, buy and place a field so farmers can grow food.',
    rewardGold: 20,
  },
  {
    id: 'ch-build-walls',
    kind: 'build_walls',
    title: 'Raise the walls',
    detail: 'Buy walls in the Marketplace and drag them around the keep before raids grow.',
    rewardGold: 25,
  },
  {
    id: 'ch-hire-knight',
    kind: 'hire_role',
    title: 'Hire a knight',
    detail: 'Train a knight at the barracks (or hire one) to hunt monsters and defend the realm.',
    rewardGold: 30,
    payload: { role: 'knight' },
  },
];

const OCCASIONAL: RealmChallenge[] = [
  {
    id: 'ch-hire-general',
    kind: 'hire_role',
    title: 'Appoint a general',
    detail: 'Train a general at the barracks. Only a general can command troops against encampments.',
    rewardGold: 35,
    payload: { role: 'general' },
  },
  {
    id: 'ch-royal-wedding',
    kind: 'royal_marriage_ball',
    title: 'A royal wedding',
    detail:
      'Need a cathedral and bishop, then a royal ball (king + queen + prince). Use the fairy godmother to bless a peasant into a temporary princess, and wed them before morning.',
    rewardGold: 50,
  },
  {
    id: 'ch-slay-troll',
    kind: 'knight_slay_monster',
    title: 'Slay a troll',
    detail: 'Select a knight (or a troll) and send them on a hunt. Knights deal strong melee damage.',
    rewardGold: 40,
    payload: { monsterKind: 'troll' },
  },
  {
    id: 'ch-slay-ogre',
    kind: 'knight_slay_monster',
    title: 'Slay an ogre',
    detail: 'Send a knight to hunt an ogre in the wilds. Watch them ride out and clash.',
    rewardGold: 45,
    payload: { monsterKind: 'ogre' },
  },
  {
    id: 'ch-slay-dragon',
    kind: 'knight_slay_monster',
    title: 'Slay a dragon',
    detail: 'Dragons sleep in caves at night — send a knight to strike while they rest for a bonus.',
    rewardGold: 60,
    payload: { monsterKind: 'dragon' },
  },
];

/** Cooldown after completing an occasional challenge (ms). */
export const CHALLENGE_COOLDOWN_MS = 90_000;

export function getEarlyChain(): readonly RealmChallenge[] {
  return EARLY_CHAIN;
}

export function getNextEarlyChallenge(
  claimedIds: readonly string[]
): RealmChallenge | null {
  const claimed = new Set(claimedIds);
  return EARLY_CHAIN.find((c) => !claimed.has(c.id)) ?? null;
}

export function earlyChainComplete(claimedIds: readonly string[]): boolean {
  return EARLY_CHAIN.every((c) => claimedIds.includes(c.id));
}

export function pickOccasionalChallenge(input: {
  claimedIds: readonly string[];
  stats: KingdomStats;
  monstersPresent: MonsterChallengeKind[];
  enabledMonsterKinds?: MonsterChallengeKind[];
  now?: number;
  nextOfferAt?: number;
}): RealmChallenge | null {
  const {
    claimedIds,
    stats,
    monstersPresent,
    enabledMonsterKinds,
    now = Date.now(),
    nextOfferAt = 0,
  } = input;
  if (now < nextOfferAt) return null;
  if (!earlyChainComplete(claimedIds)) return null;

  const claimed = new Set(claimedIds);
  const enabled = new Set(enabledMonsterKinds ?? ['troll', 'ogre', 'dragon']);
  const present = new Set(monstersPresent);

  const pool = OCCASIONAL.filter((c) => {
    if (claimed.has(c.id)) return false;
    if (c.kind === 'hire_role' && c.payload?.role === 'general') {
      return !stats.hasGeneral;
    }
    if (c.kind === 'royal_marriage_ball') {
      return stats.hasCathedral || stats.hasBishop || stats.hasFairyGodmother;
    }
    if (c.kind === 'knight_slay_monster') {
      const kind = c.payload?.monsterKind;
      if (!kind || !enabled.has(kind)) return false;
      return present.has(kind) || stats.hasKnight;
    }
    return true;
  });

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function challengeById(id: string): RealmChallenge | null {
  return (
    EARLY_CHAIN.find((c) => c.id === id) ??
    OCCASIONAL.find((c) => c.id === id) ??
    null
  );
}

export interface ChallengeCompleteContext {
  gold: number;
  stats: KingdomStats;
  /** Set when a matching monster was just slain. */
  slainMonsterKind?: MonsterChallengeKind | null;
  /** Set when a royal wedding just completed. */
  royalWeddingJustCompleted?: boolean;
}

export function isChallengeComplete(
  challenge: RealmChallenge,
  ctx: ChallengeCompleteContext
): boolean {
  switch (challenge.kind) {
    case 'earn_gold':
      return ctx.gold > 0;
    case 'build_granary':
      return ctx.stats.granaryCount > 0;
    case 'build_field':
      return ctx.stats.fieldCount > 0;
    case 'build_walls':
      return ctx.stats.wallCount > 0;
    case 'hire_role': {
      const role = challenge.payload?.role;
      if (role === 'knight') return ctx.stats.hasKnight;
      if (role === 'general') return ctx.stats.hasGeneral;
      return false;
    }
    case 'royal_marriage_ball':
      return Boolean(ctx.royalWeddingJustCompleted);
    case 'knight_slay_monster':
      return (
        !!challenge.payload?.monsterKind &&
        ctx.slainMonsterKind === challenge.payload.monsterKind
      );
    default:
      return false;
  }
}

export function challengeAction(challenge: RealmChallenge): ChallengeAction {
  switch (challenge.kind) {
    case 'earn_gold':
      return 'questions';
    case 'build_granary':
      return 'market-granary';
    case 'build_field':
      return 'market-field';
    case 'build_walls':
      return 'market-wall';
    case 'hire_role':
      return 'hire-hint';
    case 'royal_marriage_ball':
      return 'royal-hint';
    case 'knight_slay_monster':
      return 'hunt-hint';
    default:
      return 'market';
  }
}

/** Map active challenge into Next-strip display fields. */
export function challengeToStripGoal(challenge: RealmChallenge): {
  id: string;
  label: string;
  action: ChallengeAction;
  rewardGold: number;
} {
  return {
    id: challenge.id,
    label: `${challenge.title} · +${challenge.rewardGold}g`,
    action: challengeAction(challenge),
    rewardGold: challenge.rewardGold,
  };
}

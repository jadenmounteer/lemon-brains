import Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { CampKind } from './WarBalance';

export type StrategyFocus = 'raid_fields' | 'weak_keep' | 'soft_breach';

export interface SiegePlan {
  focus: StrategyFocus;
  keepId: string;
  keepX: number;
  keepY: number;
  /** Human-readable order for toasts */
  orderLabel: string;
  /** Priority field ids for scorched-earth detachments */
  fieldIds: string[];
  /** Soft approach point for invest / breach */
  breachX: number;
  breachY: number;
}

export interface PlanSiegeOpts {
  /** Skip keeps already taken this siege */
  excludeKeepIds?: string[];
  /** After fields burn / a keep falls — press remaining keeps, skip food raids */
  preferKeepAssault?: boolean;
  reason?: 'keep_fallen' | 'fields_cleared' | 'retarget';
}

/**
 * Smart enemy-general battlefield assessment.
 * Prefers burning exposed food, then the weakest keep, then the softest approach.
 * Returns null when no keeps remain (kingdom already fallen).
 */
export function planSiege(
  buildings: BuildingSystem,
  camp: { x: number; y: number },
  generalName?: string,
  opts?: PlanSiegeOpts
): SiegePlan | null {
  const excluded = new Set(opts?.excludeKeepIds ?? []);
  const keeps = buildings
    .listKeepTargets()
    .filter((k) => !excluded.has(k.id))
    .map((k) => ({
      ...k,
      defenseScore: buildings.defenseScoreNear(k.x, k.y),
    }));

  if (keeps.length === 0) return null;

  const fields = opts?.preferKeepAssault
    ? []
    : buildings.fieldsOutsideWalls();
  const who = generalName ?? 'The enemy general';
  const reason = opts?.reason;

  const ranked = [...keeps].sort((a, b) => {
    const ra = a.hp / Math.max(1, a.maxHp);
    const rb = b.hp / Math.max(1, b.maxHp);
    if (Math.abs(ra - rb) > 0.05) return ra - rb;
    return a.defenseScore - b.defenseScore;
  });

  const target = ranked[0]!;
  const soft = softestApproach(buildings, target, camp);

  if (fields.length >= 1) {
    return {
      focus: 'raid_fields',
      keepId: target.id,
      keepX: target.x,
      keepY: target.y,
      orderLabel: `${who} orders a raid on the outer fields!`,
      fieldIds: fields.slice(0, 4).map((f) => f.id),
      breachX: soft.x,
      breachY: soft.y,
    };
  }

  const multiKeep = keeps.length > 1;
  const weakRatio = target.hp / Math.max(1, target.maxHp);
  const assaultKeep =
    multiKeep ||
    weakRatio < 0.85 ||
    target.defenseScore < 8 ||
    Boolean(opts?.preferKeepAssault);

  if (assaultKeep) {
    const orderLabel =
      reason === 'keep_fallen'
        ? `${who} redirects to the next keep!`
        : reason === 'fields_cleared'
          ? `${who} turns from the fields to the next keep!`
          : `${who} marches on the weakest keep!`;
    return {
      focus: 'weak_keep',
      keepId: target.id,
      keepX: target.x,
      keepY: target.y,
      orderLabel,
      fieldIds: [],
      breachX: soft.x,
      breachY: soft.y,
    };
  }

  return {
    focus: 'soft_breach',
    keepId: target.id,
    keepX: target.x,
    keepY: target.y,
    orderLabel:
      reason === 'keep_fallen'
        ? `${who} finds a new approach on the remaining keep!`
        : `${who} strikes the least-defended approach!`,
    fieldIds: [],
    breachX: soft.x,
    breachY: soft.y,
  };
}

const CAMP_RAID_LINES: Record<CampKind, string[]> = {
  goblin: [
    'Tonight we strike the granary!',
    'Burn their fields before dawn!',
    'The keep sleeps — take what we can carry!',
  ],
  bandit: [
    'Gold before sunrise, lads!',
    'Hit the road and run!',
    'Strike fast, strike rich!',
  ],
  giant: [
    'Smash what stands in our way!',
    'Time to remind them who is bigger!',
  ],
  thief: [
    'In and out before the watch stirs.',
    'Shadows favor us tonight.',
  ],
  gypsy: [
    'A little "borrowing" tonight, friends.',
    'Charm first, pockets after!',
  ],
  coven: ['The stars favor mischief tonight.'],
  siege: ['For the crown! Take the keep!'],
};

/** Flavor order a camp's leader gives before sending a raiding party. */
export function pickCampRaidLine(kind: CampKind): string {
  const lines = CAMP_RAID_LINES[kind] ?? CAMP_RAID_LINES.bandit;
  return lines[Math.floor(Math.random() * lines.length)]!;
}

/** Softest approach: from camp toward keep, prefer the side with fewer/weaker forts. */
function softestApproach(
  buildings: BuildingSystem,
  keep: { x: number; y: number },
  camp: { x: number; y: number }
): { x: number; y: number } {
  const dx = keep.x - camp.x;
  const dy = keep.y - camp.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny;
  const py = nx;

  let best = {
    x: camp.x + nx * Math.min(len * 0.45, 160),
    y: camp.y + ny * Math.min(len * 0.45, 160),
  };
  let bestScore = Infinity;

  for (const side of [-1, 0, 1] as const) {
    const ax = camp.x + nx * Math.min(len * 0.4, 150) + px * side * 70;
    const ay = camp.y + ny * Math.min(len * 0.4, 150) + py * side * 70;
    let score = 0;
    for (const b of buildings.list()) {
      if (b.kind !== 'wall' && b.kind !== 'drawbridge' && b.kind !== 'ballista') {
        continue;
      }
      const d = Phaser.Math.Distance.Between(ax, ay, b.x, b.y);
      if (d < 90) {
        score += b.kind === 'ballista' ? 5 : 2;
        score += (b.hp / Math.max(1, b.maxHp)) * 2;
      }
    }
    if (score < bestScore) {
      bestScore = score;
      best = { x: ax, y: ay };
    }
  }
  return best;
}

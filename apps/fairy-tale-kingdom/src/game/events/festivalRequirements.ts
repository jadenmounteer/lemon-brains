import type { BuildKind } from '../../marketplace/catalog';
import type { UnitRole } from '../art/assetManifest';
import type { CivilianJob } from '../jobs/capacities';

export type FestivalKind =
  | 'peasant'
  | 'market'
  | 'harvest'
  | 'tavern'
  | 'cathedral'
  | 'harbor'
  | 'joust';

export interface FestivalRequirement {
  kind: FestivalKind;
  title: string;
  blurb: string;
  buildings: string;
  units: string;
}

export const FESTIVAL_REQUIREMENTS: FestivalRequirement[] = [
  {
    kind: 'peasant',
    title: 'Peasant hamlet festival',
    blurb: 'Neighbors dance between clustered cottages.',
    buildings: '≥3 houses/manors with a pair within ~120px',
    units: '≥5 peasants',
  },
  {
    kind: 'market',
    title: 'Market festival',
    blurb: 'Stalls, song, and trade fill the square.',
    buildings: '≥1 market',
    units: '≥1 merchant and ≥4 peasants',
  },
  {
    kind: 'harvest',
    title: 'Harvest festival',
    blurb: 'Fields celebrate a good yield.',
    buildings: '≥1 field (granary preferred)',
    units: '≥3 farmers',
  },
  {
    kind: 'tavern',
    title: 'Tavern revel',
    blurb: 'Cups rise and jesters juggle.',
    buildings: '≥1 tavern',
    units: '≥1 jester and ≥4 commoners',
  },
  {
    kind: 'cathedral',
    title: 'Cathedral feast day',
    blurb: 'Bells and banners under royal blessing.',
    buildings: '≥1 cathedral',
    units: '≥1 bishop and ≥1 king or queen',
  },
  {
    kind: 'harbor',
    title: 'Harbor festival',
    blurb: 'Nets dry and songs rise from the dock.',
    buildings: '≥1 dock',
    units: '≥2 fishermen',
  },
  {
    kind: 'joust',
    title: 'Royal joust',
    blurb: 'Knights clash while the crown and crowd watch.',
    buildings: '≥1 barracks',
    units: 'King and queen, ≥2 knights, ≥5 peasants',
  },
];

export function festivalManualEntries(): FestivalRequirement[] {
  return FESTIVAL_REQUIREMENTS;
}

export interface FestivalContext {
  buildings: Array<{ kind: BuildKind; x: number; y: number; hp: number }>;
  countRole: (role: UnitRole) => number;
  countJob: (job: CivilianJob) => number;
  hasKingOrQueen: boolean;
  hasKingAndQueen: boolean;
}

function houseClusterOk(
  buildings: FestivalContext['buildings']
): { ok: boolean; x: number; y: number } {
  const homes = buildings.filter(
    (b) => (b.kind === 'house' || b.kind === 'manor') && b.hp > 0
  );
  if (homes.length < 3) return { ok: false, x: 0, y: 0 };
  let best = { ok: false, x: 0, y: 0, score: 0 };
  for (let i = 0; i < homes.length; i++) {
    const a = homes[i]!;
    let near = 0;
    let sx = a.x;
    let sy = a.y;
    for (let j = 0; j < homes.length; j++) {
      if (i === j) continue;
      const b = homes[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d <= 120) {
        near += 1;
        sx += b.x;
        sy += b.y;
      }
    }
    if (near >= 1 && near + 1 > best.score) {
      const n = near + 1;
      best = { ok: true, x: sx / n, y: sy / n, score: near + 1 };
    }
  }
  return { ok: best.ok, x: best.x, y: best.y };
}

function firstOf(
  buildings: FestivalContext['buildings'],
  kind: BuildKind
): { x: number; y: number } | null {
  const b = buildings.find((x) => x.kind === kind && x.hp > 0);
  return b ? { x: b.x, y: b.y } : null;
}

export function listEligibleFestivals(
  ctx: FestivalContext
): Array<{ kind: FestivalKind; x: number; y: number }> {
  const out: Array<{ kind: FestivalKind; x: number; y: number }> = [];
  const cluster = houseClusterOk(ctx.buildings);
  if (cluster.ok && ctx.countRole('peasant') >= 5) {
    out.push({ kind: 'peasant', x: cluster.x, y: cluster.y });
  }
  const market = firstOf(ctx.buildings, 'market');
  if (
    market &&
    ctx.countJob('merchant') >= 1 &&
    ctx.countRole('peasant') >= 4
  ) {
    out.push({ kind: 'market', ...market });
  }
  const field = firstOf(ctx.buildings, 'field');
  if (field && ctx.countJob('farmer') >= 3) {
    out.push({ kind: 'harvest', ...field });
  }
  const tavern = firstOf(ctx.buildings, 'tavern');
  if (
    tavern &&
    ctx.countRole('jester') >= 1 &&
    ctx.countRole('peasant') + ctx.countRole('jester') >= 4
  ) {
    out.push({ kind: 'tavern', ...tavern });
  }
  const cathedral = firstOf(ctx.buildings, 'cathedral');
  if (cathedral && ctx.countRole('bishop') >= 1 && ctx.hasKingOrQueen) {
    out.push({ kind: 'cathedral', ...cathedral });
  }
  const dock = firstOf(ctx.buildings, 'dock');
  if (dock && ctx.countJob('fisherman') >= 2) {
    out.push({ kind: 'harbor', ...dock });
  }
  const barracks = firstOf(ctx.buildings, 'barracks');
  if (
    barracks &&
    ctx.hasKingAndQueen &&
    ctx.countRole('knight') >= 2 &&
    ctx.countRole('peasant') >= 5
  ) {
    out.push({ kind: 'joust', ...barracks });
  }
  return out;
}

export function toastForFestival(kind: FestivalKind): string {
  switch (kind) {
    case 'peasant':
      return 'Peasants dance in the hamlet!';
    case 'market':
      return 'A market festival fills the square!';
    case 'harvest':
      return 'A harvest festival cheers the fields!';
    case 'tavern':
      return 'A tavern revel spills into the street!';
    case 'cathedral':
      return 'A feast day gathers at the cathedral!';
    case 'harbor':
      return 'A harbor festival sings on the dock!';
    case 'joust':
      return 'The joust begins under royal banners!';
  }
}

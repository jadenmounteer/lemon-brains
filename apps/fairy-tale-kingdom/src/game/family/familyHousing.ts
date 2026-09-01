import { BEDS_PER_HOUSE, type BuildKind } from '../../marketplace/catalog';
import { BEDS_PER_MANOR } from '../economy/economy';
import { isDwelling } from '../combat/stats';

export interface DwellingRef {
  id: string;
  kind: BuildKind;
}

export interface MarriagePartner {
  id: string;
  houseId: string;
}

export type MarriageHomeResult =
  | { ok: true; houseId: string; moverId: string; needsNewHouse?: false }
  | { ok: true; needsNewHouse: true }
  | { ok: false; reason: string };

export type ChildHomeResult =
  | { ok: true; houseId: string }
  | { ok: false; reason: string };

export function bedsForDwelling(kind: BuildKind): number {
  if (kind === 'house') return BEDS_PER_HOUSE;
  if (kind === 'manor') return BEDS_PER_MANOR;
  return 0;
}

export function freeBedsIn(
  houseId: string,
  kind: BuildKind,
  occupantCounts: Map<string, number>
): number {
  const used = occupantCounts.get(houseId) ?? 0;
  return Math.max(0, bedsForDwelling(kind) - used);
}

/** Where a newlywed couple will live (cross-household marriage). */
export function findMarriageHome(
  male: MarriagePartner,
  female: MarriagePartner,
  dwellings: DwellingRef[],
  occupantCounts: Map<string, number>,
  opts?: { houseBuildCost?: number; gold?: number; infiniteGold?: boolean }
): MarriageHomeResult {
  const maleDwelling = dwellings.find((d) => d.id === male.houseId);
  const femaleDwelling = dwellings.find((d) => d.id === female.houseId);

  if (maleDwelling) {
    const free = freeBedsIn(male.houseId, maleDwelling.kind, occupantCounts);
    if (free >= 1) {
      return { ok: true, houseId: male.houseId, moverId: female.id };
    }
  }
  if (femaleDwelling) {
    const free = freeBedsIn(female.houseId, femaleDwelling.kind, occupantCounts);
    if (free >= 1) {
      return { ok: true, houseId: female.houseId, moverId: male.id };
    }
  }

  let best: { id: string; free: number } | null = null;
  for (const d of dwellings) {
    if (!isDwelling(d.kind)) continue;
    const free = freeBedsIn(d.id, d.kind, occupantCounts);
    if (free >= 2 && (!best || free > best.free)) {
      best = { id: d.id, free };
    }
  }
  if (best) {
    const moverId =
      male.houseId !== best.id
        ? male.id
        : female.houseId !== best.id
          ? female.id
          : male.id;
    return { ok: true, houseId: best.id, moverId };
  }

  const cost = opts?.houseBuildCost ?? 30;
  if (opts?.infiniteGold || (opts?.gold ?? 0) >= cost) {
    return { ok: true, needsNewHouse: true };
  }

  return {
    ok: false,
    reason: 'Need a home with a free bed (or gold for a new house)',
  };
}

/** Where a newborn should be assigned. */
export function findChildHome(
  motherHouseId: string,
  fatherHouseId: string | undefined,
  dwellings: DwellingRef[],
  occupantCounts: Map<string, number>
): ChildHomeResult {
  const tryHouse = (houseId: string): string | null => {
    const d = dwellings.find((x) => x.id === houseId);
    if (!d || !isDwelling(d.kind)) return null;
    return freeBedsIn(houseId, d.kind, occupantCounts) >= 1 ? houseId : null;
  };

  const mother = tryHouse(motherHouseId);
  if (mother) return { ok: true, houseId: mother };
  if (fatherHouseId) {
    const father = tryHouse(fatherHouseId);
    if (father) return { ok: true, houseId: father };
  }

  for (const d of dwellings) {
    if (!isDwelling(d.kind)) continue;
    if (freeBedsIn(d.id, d.kind, occupantCounts) >= 1) {
      return { ok: true, houseId: d.id };
    }
  }

  return { ok: false, reason: 'Need a house with a free bed for the child' };
}

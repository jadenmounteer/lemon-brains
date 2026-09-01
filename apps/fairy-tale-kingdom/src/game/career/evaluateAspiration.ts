import type { UnitRole } from '../art/assetManifest';
import {
  BUILDING_ROLE_CAPACITY,
  roleFromCareerGoal,
} from '../jobs/capacities';
import type { BuildKind } from '../../marketplace/catalog';
import { Phase12Balance } from '../economy/phase12Balance';
import type { SubjectGoal } from '../subjects/types';
import type { KingdomStats } from '../subjects/types';
import { roleLabel } from '../subjects/schedules';

export interface AspirationCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface CareerAspirationView {
  targetRole: UnitRole;
  targetLabel: string;
  cost: number;
  criteria: AspirationCriterion[];
  canPromote: boolean;
  blockReason?: string;
}

export interface AspirationSubjectInput {
  role: UnitRole;
  goal?: SubjectGoal | null;
}

export interface AspirationBuildingInput {
  hasDungeon: boolean;
  hasBarracks: boolean;
  hasCathedral: boolean;
  hasInfirmary: boolean;
  hasGallows: boolean;
  tavernCount: number;
  /** Per-role headcount for capacity checks. */
  roleCounts: Partial<Record<UnitRole, number>>;
}

function openCapacity(
  buildings: AspirationBuildingInput,
  role: UnitRole
): { met: boolean; label: string; cap: number; count: number } {
  let totalCap = 0;
  let found = false;
  for (const [kind, caps] of Object.entries(BUILDING_ROLE_CAPACITY)) {
    const cap = caps?.[role];
    if (cap == null) continue;
    found = true;
    totalCap += cap;
    void kind;
  }
  const count = buildings.roleCounts[role] ?? 0;
  if (!found) {
    return { met: false, label: `${roleLabel(role)} post unavailable`, cap: 0, count };
  }
  return {
    met: count < totalCap,
    label: `${roleLabel(role)} post open (${count}/${totalCap})`,
    cap: totalCap,
    count,
  };
}

function promoteAllowedFromRole(from: UnitRole): boolean {
  return (
    from === 'peasant' ||
    from === 'guard' ||
    from === 'elite_guard' ||
    from === 'soldier'
  );
}

/** Pure career aspiration evaluation for inspector UI. */
export function evaluateCareerAspiration(
  subject: AspirationSubjectInput,
  buildings: AspirationBuildingInput,
  _stats: Pick<KingdomStats, 'royaltyUnlocked'>,
  gold: number,
  infiniteGold = false
): CareerAspirationView | null {
  if (!subject.goal) return null;
  const targetRole =
    subject.goal.targetRole ?? roleFromCareerGoal(subject.goal.kind);
  if (!targetRole) return null;

  const cost = Phase12Balance.careerCosts[targetRole] ?? 20;
  const criteria: AspirationCriterion[] = [];

  const fromOk = promoteAllowedFromRole(subject.role);
  criteria.push({
    id: 'eligible_role',
    label: 'Eligible current role (peasant or soldier track)',
    met: fromOk,
  });

  if (targetRole === 'guard') {
    criteria.push({
      id: 'dungeon',
      label: 'Dungeon built',
      met: buildings.hasDungeon,
    });
  }

  if (
    targetRole === 'soldier' ||
    targetRole === 'archer' ||
    targetRole === 'knight' ||
    targetRole === 'general' ||
    targetRole === 'elite_guard' ||
    targetRole === 'elite_archer'
  ) {
    criteria.push({
      id: 'barracks',
      label: 'Barracks built',
      met: buildings.hasBarracks,
    });
  }

  if (targetRole === 'bishop') {
    criteria.push({
      id: 'cathedral',
      label: 'Cathedral built',
      met: buildings.hasCathedral,
    });
    criteria.push({
      id: 'bishop_unique',
      label: 'No bishop yet',
      met: (buildings.roleCounts.bishop ?? 0) === 0,
    });
  }

  if (targetRole === 'witch_hunter') {
    criteria.push({
      id: 'cathedral',
      label: 'Cathedral built',
      met: buildings.hasCathedral,
    });
  }

  if (targetRole === 'dungeon_keeper') {
    criteria.push({
      id: 'dungeon',
      label: 'Dungeon built',
      met: buildings.hasDungeon,
    });
  }

  if (targetRole === 'executioner') {
    criteria.push({
      id: 'gallows',
      label: 'Gallows built',
      met: buildings.hasGallows,
    });
    criteria.push({
      id: 'dungeon',
      label: 'Dungeon built',
      met: buildings.hasDungeon,
    });
  }

  if (targetRole === 'jester') {
    criteria.push({
      id: 'tavern',
      label: 'Tavern built',
      met: buildings.tavernCount > 0,
    });
  }

  if (targetRole === 'physician') {
    criteria.push({
      id: 'infirmary',
      label: 'Infirmary built',
      met: buildings.hasInfirmary,
    });
  }

  const cap = openCapacity(buildings, targetRole);
  criteria.push({
    id: 'capacity',
    label: cap.label,
    met: cap.met,
  });

  const goldOk = infiniteGold || gold >= cost;
  criteria.push({
    id: 'gold',
    label: `${cost} gold available`,
    met: goldOk,
  });

  const unmet = criteria.filter((c) => !c.met);
  const canPromote = unmet.length === 0;
  let blockReason: string | undefined;
  if (!canPromote) {
    blockReason = unmet[0]?.label ?? 'Requirements not met';
  }

  return {
    targetRole,
    targetLabel: roleLabel(targetRole),
    cost,
    criteria,
    canPromote,
    blockReason,
  };
}

/** Sum building caps for a role (test helper). */
export function totalRoleCapacity(role: UnitRole): number {
  let total = 0;
  for (const caps of Object.values(BUILDING_ROLE_CAPACITY)) {
    const cap = (caps as Partial<Record<UnitRole, number>> | undefined)?.[role];
    if (cap != null) total += cap;
  }
  return total;
}

export type { BuildKind };

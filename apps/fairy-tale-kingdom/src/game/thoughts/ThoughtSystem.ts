import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';
import {
  BUILDING_ROLE_CAPACITY,
  careerGoalKind,
  careerTargetsFor,
  CAREER_ASPIRANT_ROLES,
} from '../jobs/capacities';
import { Phase12Balance } from '../economy/phase12Balance';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { roleLabel } from '../subjects/schedules';

const IDLE_THOUGHTS = [
  'What a nice night.',
  'The roads feel quiet.',
  'I wonder what’s for supper.',
  'May the keep stand forever.',
  'Ahh—work never ends.',
];

/** Soft goals + idle thoughts on top of schedules. */
export class ThoughtSystem {
  private accumMs = 0;

  constructor(
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  update(deltaMs: number): void {
    this.accumMs += deltaMs;
    if (this.accumMs < 4000) return;
    this.accumMs = 0;
    this.tick();
  }

  tick(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.role === 'witch') continue;
      this.refreshGoal(s.data.id);
      if (!s.data.thought || Math.random() < 0.15) {
        if (s.data.goal?.text) {
          s.data.thought = s.data.goal.text;
        } else {
          const slot = s.data.activityLabel;
          s.data.thought =
            Math.random() < 0.5
              ? IDLE_THOUGHTS[Math.floor(Math.random() * IDLE_THOUGHTS.length)]!
              : `Focusing on: ${slot}`;
        }
      }
    }
  }

  private refreshGoal(id: string): void {
    const s = this.subjects.getById(id);
    if (!s) return;

    const aspirant = CAREER_ASPIRANT_ROLES.includes(s.data.role);
    const goal = s.data.goal;

    if (goal?.kind.startsWith('become_')) {
      const target = goal.kind.slice('become_'.length) as UnitRole;
      const allowed = careerTargetsFor(s.data.role);
      if (!allowed.includes(target) || !this.careerFeasible(target)) {
        s.data.goal = null;
        s.data.thought = 'Maybe another day…';
      }
      return;
    }

    if (!aspirant) {
      if (goal?.kind.startsWith('become_')) s.data.goal = null;
      return;
    }
    if (goal) return;

    // Peasants roll more often; guards/soldiers aspire occasionally
    const chance = s.data.role === 'peasant' ? 0.35 : 0.18;
    if (Math.random() > chance) return;

    const options = careerTargetsFor(s.data.role).filter((r) =>
      this.careerFeasible(r)
    );
    if (!options.length) return;

    // Prefer general slightly when a soldier has open general capacity
    let role = options[Math.floor(Math.random() * options.length)]!;
    if (
      s.data.role === 'soldier' &&
      options.includes('general') &&
      Math.random() < 0.4
    ) {
      role = 'general';
    } else if (
      (s.data.role === 'guard' ||
        s.data.role === 'elite_guard' ||
        s.data.role === 'soldier') &&
      options.includes('knight') &&
      Math.random() < 0.55
    ) {
      role = 'knight';
    }

    const cost = Phase12Balance.careerCosts[role] ?? 20;
    s.data.goal = {
      kind: careerGoalKind(role),
      targetRole: role,
      text: `I want to become a ${roleLabel(role)}.`,
    };
    this.subjects.appendLifeLog(
      id,
      `Dreams of becoming a ${roleLabel(role)} (${cost} gold to hire)`,
      'career'
    );
  }

  private careerFeasible(role: UnitRole): boolean {
    const b = this.buildings;
    if (role === 'guard') {
      return b.hasDungeon() && this.hasOpenCapacity(role);
    }
    if (
      role === 'soldier' ||
      role === 'archer' ||
      role === 'knight' ||
      role === 'general' ||
      role === 'elite_guard' ||
      role === 'elite_archer'
    ) {
      return b.hasBarracks() && this.hasOpenCapacity(role);
    }
    if (role === 'bishop') {
      return b.hasCathedral() && !this.subjects.hasRole('bishop');
    }
    if (role === 'witch_hunter') {
      return b.hasCathedral() && this.hasOpenCapacity(role);
    }
    if (role === 'dungeon_keeper') {
      return b.hasDungeon() && this.hasOpenCapacity(role);
    }
    if (role === 'executioner') {
      return b.hasGallows() && this.hasOpenCapacity(role);
    }
    if (role === 'jester') {
      return b.tavernCount() > 0 && this.hasOpenCapacity(role);
    }
    if (role === 'physician') {
      return b.hasInfirmary() && this.hasOpenCapacity(role);
    }
    return false;
  }

  /** Sum per-building caps (e.g. general 1 × each barracks). */
  private hasOpenCapacity(role: UnitRole): boolean {
    let totalCap = 0;
    let found = false;
    for (const b of this.buildings.list()) {
      if (b.hp <= 0) continue;
      const caps = BUILDING_ROLE_CAPACITY[b.kind as BuildKind];
      const cap = caps?.[role];
      if (cap == null) continue;
      found = true;
      totalCap += cap;
    }
    if (!found) return false;
    return this.subjects.countRole(role) < totalCap;
  }
}

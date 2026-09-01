import type { BuildingSystem } from '../buildings/BuildingSystem';
import { isDwelling } from '../combat/stats';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import {
  FAMILY_GOAL_HAVE_CHILD,
  FAMILY_GOAL_MARRY,
} from './familyGoals';

const ELDER_AGE = 55;

function peasantEligible(s: {
  data: {
    role: string;
    married: boolean;
    ageYears: number;
    happiness: number;
    sick: boolean;
    hunger: number;
    gender: string;
    houseId: string;
    goal?: { kind: string } | null;
    spouseId?: string;
    pregnant?: boolean;
  };
}): boolean {
  const d = s.data;
  return (
    d.role === 'peasant' &&
    !d.married &&
    d.ageYears >= 18 &&
    d.happiness >= 55 &&
    !d.sick &&
    d.hunger < 70 &&
    !d.goal?.kind.startsWith('become_')
  );
}

/** Assigns marry / have_child goals to eligible peasants. */
export class FamilyAspirationService {
  constructor(
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  onDayRolled(): void {
    this.assignMarriageGoals();
    this.assignChildGoals();
  }

  private assignMarriageGoals(): void {
    const peasants = this.subjects
      .listManaged()
      .filter(peasantEligible)
      .filter((s) => !s.data.goal || s.data.goal.kind === FAMILY_GOAL_MARRY);

    const males = peasants.filter((s) => s.data.gender === 'male');
    const females = peasants.filter((s) => s.data.gender === 'female');
    if (!males.length || !females.length) return;

    for (const m of males) {
      if (m.data.goal?.kind === FAMILY_GOAL_MARRY && m.data.goal.targetId) {
        continue;
      }
      let best: (typeof females)[0] | null = null;
      let bestScore = -1;
      for (const f of females) {
        if (f.data.houseId === m.data.houseId) continue;
        if (f.data.goal?.kind === FAMILY_GOAL_MARRY && f.data.goal.targetId) {
          continue;
        }
        const score = m.data.happiness + f.data.happiness;
        if (score > bestScore) {
          bestScore = score;
          best = f;
        }
      }
      if (!best || Math.random() > 0.4) continue;
      const mName = m.data.name.split(',')[0]!;
      const fName = best.data.name.split(',')[0]!;
      m.data.goal = {
        kind: FAMILY_GOAL_MARRY,
        targetId: best.data.id,
        text: `I wish to marry ${fName}.`,
      };
      best.data.goal = {
        kind: FAMILY_GOAL_MARRY,
        targetId: m.data.id,
        text: `I wish to marry ${mName}.`,
      };
      this.subjects.appendLifeLog(
        m.data.id,
        `Hopes to marry ${fName}`,
        'family'
      );
      this.subjects.appendLifeLog(
        best.data.id,
        `Hopes to marry ${mName}`,
        'family'
      );
    }
    this.subjects.notifyChanged();
  }

  private assignChildGoals(): void {
    for (const s of this.subjects.listManaged()) {
      const d = s.data;
      if (d.role !== 'peasant' || !d.married || !d.spouseId) continue;
      if (d.pregnant) continue;
      if (d.goal?.kind.startsWith('become_')) continue;
      if (d.goal?.kind === FAMILY_GOAL_HAVE_CHILD) continue;
      if (d.ageYears < 18) continue;
      if (d.happiness < 50 || d.sick || d.hunger >= 75) continue;

      const spouse = this.subjects.getById(d.spouseId);
      if (!spouse || spouse.data.pregnant) continue;
      if (Math.random() > 0.25) continue;

      const text = 'We wish for a child.';
      s.data.goal = {
        kind: FAMILY_GOAL_HAVE_CHILD,
        targetId: d.spouseId,
        text,
      };
      spouse.data.goal = {
        kind: FAMILY_GOAL_HAVE_CHILD,
        targetId: d.id,
        text,
      };
      this.subjects.appendLifeLog(d.id, 'Longs for a child', 'family');
      this.subjects.appendLifeLog(spouse.data.id, 'Longs for a child', 'family');
    }
    this.subjects.notifyChanged();
  }

  listDwellings(): { id: string; kind: import('../../marketplace/catalog').BuildKind }[] {
    return this.buildings
      .list()
      .filter((b) => isDwelling(b.kind))
      .map((b) => ({ id: b.id, kind: b.kind }));
  }
}

export { ELDER_AGE };

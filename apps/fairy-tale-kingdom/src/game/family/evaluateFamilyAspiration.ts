import { BUILD_CATALOG } from '../../marketplace/catalog';
import type { SubjectGoal } from '../subjects/types';
import {
  findChildHome,
  findMarriageHome,
  type DwellingRef,
} from './familyHousing';
import {
  FAMILY_GOAL_HAVE_CHILD,
  FAMILY_GOAL_MARRY,
  isFamilyGoalKind,
} from './familyGoals';

export interface FamilyCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface FamilyAspirationView {
  kind: typeof FAMILY_GOAL_MARRY | typeof FAMILY_GOAL_HAVE_CHILD;
  title: string;
  partnerName?: string;
  criteria: FamilyCriterion[];
  canGrant: boolean;
  blockReason?: string;
  cost: number;
}

export interface FamilySubjectInput {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  married: boolean;
  spouseId?: string;
  houseId: string;
  ageYears: number;
  pregnant?: boolean;
  goal?: SubjectGoal | null;
}

export interface FamilyAspirationContext {
  subjects: FamilySubjectInput[];
  dwellings: DwellingRef[];
  occupantCounts: Map<string, number>;
  hasCathedral: boolean;
  hasBishop: boolean;
  weddingActive: boolean;
  gold: number;
  infiniteGold?: boolean;
}

function houseCost(): number {
  return BUILD_CATALOG.find((c) => c.kind === 'house')?.cost ?? 30;
}

function partnerOf(
  subject: FamilySubjectInput,
  ctx: FamilyAspirationContext
): FamilySubjectInput | null {
  const targetId = subject.goal?.targetId ?? subject.spouseId;
  if (!targetId) return null;
  return ctx.subjects.find((s) => s.id === targetId) ?? null;
}

function evaluateMarry(
  subject: FamilySubjectInput,
  ctx: FamilyAspirationContext
): FamilyAspirationView | null {
  const partner = partnerOf(subject, ctx);
  const criteria: FamilyCriterion[] = [];

  criteria.push({
    id: 'unmarried',
    label: 'Both are unmarried',
    met:
      !subject.married &&
      (!partner || !partner.married),
  });

  criteria.push({
    id: 'partner',
    label: partner
      ? `Partner: ${partner.name}`
      : 'Has a partner in mind',
    met: Boolean(partner && partner.goal?.kind === FAMILY_GOAL_MARRY),
  });

  criteria.push({
    id: 'cathedral',
    label: 'Cathedral built',
    met: ctx.hasCathedral,
  });

  criteria.push({
    id: 'bishop',
    label: 'Bishop in the realm',
    met: ctx.hasBishop,
  });

  criteria.push({
    id: 'ceremony',
    label: 'No wedding in progress',
    met: !ctx.weddingActive,
  });

  let housingMet = false;
  let housingLabel = 'A home with a free bed';
  if (partner && subject.gender !== partner.gender) {
    const male = subject.gender === 'male' ? subject : partner;
    const female = subject.gender === 'female' ? subject : partner;
    const home = findMarriageHome(
      { id: male.id, houseId: male.houseId },
      { id: female.id, houseId: female.houseId },
      ctx.dwellings,
      ctx.occupantCounts,
      {
        houseBuildCost: houseCost(),
        gold: ctx.gold,
        infiniteGold: ctx.infiniteGold,
      }
    );
    if (home.ok && !home.needsNewHouse) {
      housingMet = true;
      housingLabel = `Home ready (${home.houseId})`;
    } else if (home.ok && home.needsNewHouse) {
      housingMet = true;
      housingLabel = `Gold for a new house (${houseCost()}g)`;
    } else {
      housingLabel = home.reason;
    }
  }

  criteria.push({
    id: 'housing',
    label: housingLabel,
    met: housingMet,
  });

  const unmet = criteria.filter((c) => !c.met);
  return {
    kind: FAMILY_GOAL_MARRY,
    title: partner ? `Marry ${partner.name}` : 'Marry',
    partnerName: partner?.name,
    criteria,
    canGrant: unmet.length === 0,
    blockReason: unmet[0]?.label,
    cost: 0,
  };
}

function evaluateHaveChild(
  subject: FamilySubjectInput,
  ctx: FamilyAspirationContext
): FamilyAspirationView | null {
  const spouse = partnerOf(subject, ctx);
  const criteria: FamilyCriterion[] = [];

  criteria.push({
    id: 'married',
    label: 'Married',
    met: subject.married && Boolean(subject.spouseId),
  });

  criteria.push({
    id: 'not_pregnant',
    label: 'Not already expecting',
    met: !subject.pregnant,
  });

  criteria.push({
    id: 'adult',
    label: 'Adult (18+)',
    met: subject.ageYears >= 18,
  });

  let housingMet = false;
  let housingLabel = 'A free bed for the child';
  if (subject.spouseId) {
    const father =
      subject.gender === 'male'
        ? subject
        : spouse ?? ctx.subjects.find((s) => s.id === subject.spouseId);
    const mother =
      subject.gender === 'female'
        ? subject
        : spouse ?? ctx.subjects.find((s) => s.id === subject.spouseId);
    if (mother) {
      const home = findChildHome(
        mother.houseId,
        father?.houseId,
        ctx.dwellings,
        ctx.occupantCounts
      );
      housingMet = home.ok;
      housingLabel = home.ok
        ? `Room for baby (${home.houseId})`
        : home.reason;
    }
  }

  criteria.push({
    id: 'child_home',
    label: housingLabel,
    met: housingMet,
  });

  const unmet = criteria.filter((c) => !c.met);
  return {
    kind: FAMILY_GOAL_HAVE_CHILD,
    title: 'Have a child',
    partnerName: spouse?.name,
    criteria,
    canGrant: unmet.length === 0,
    blockReason: unmet[0]?.label,
    cost: 0,
  };
}

/** Pure family aspiration evaluation for inspector UI. */
export function evaluateFamilyAspiration(
  subject: FamilySubjectInput,
  ctx: FamilyAspirationContext
): FamilyAspirationView | null {
  const kind = subject.goal?.kind;
  if (!kind || !isFamilyGoalKind(kind)) return null;
  if (kind === FAMILY_GOAL_MARRY) return evaluateMarry(subject, ctx);
  if (kind === FAMILY_GOAL_HAVE_CHILD) return evaluateHaveChild(subject, ctx);
  return null;
}

export function resolveMarriageHomeForGrant(
  subject: FamilySubjectInput,
  ctx: FamilyAspirationContext
): ReturnType<typeof findMarriageHome> | null {
  const partner = partnerOf(subject, ctx);
  if (!partner || subject.gender === partner.gender) return null;
  const male = subject.gender === 'male' ? subject : partner;
  const female = subject.gender === 'female' ? subject : partner;
  return findMarriageHome(
    { id: male.id, houseId: male.houseId },
    { id: female.id, houseId: female.houseId },
    ctx.dwellings,
    ctx.occupantCounts,
    {
      houseBuildCost: houseCost(),
      gold: ctx.gold,
      infiniteGold: ctx.infiniteGold,
    }
  );
}

export function resolveChildHomeForGrant(
  subject: FamilySubjectInput,
  ctx: FamilyAspirationContext
): ReturnType<typeof findChildHome> | null {
  const spouse = partnerOf(subject, ctx);
  const mother =
    subject.gender === 'female'
      ? subject
      : spouse ?? ctx.subjects.find((s) => s.id === subject.spouseId);
  if (!mother) return null;
  const father =
    subject.gender === 'male'
      ? subject
      : spouse ?? ctx.subjects.find((s) => s.id === subject.spouseId);
  return findChildHome(
    mother.houseId,
    father?.houseId,
    ctx.dwellings,
    ctx.occupantCounts
  );
}

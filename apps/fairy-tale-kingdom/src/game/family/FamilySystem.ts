import Phaser from 'phaser';
import { Phase12Balance } from '../economy/phase12Balance';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { KingdomEvents } from '../subjects/events';
import { pickName } from '../subjects/names';
import { FAMILY_GOAL_HAVE_CHILD, FAMILY_GOAL_MARRY } from './familyGoals';
import {
  evaluateFamilyAspiration,
  resolveChildHomeForGrant,
  resolveMarriageHomeForGrant,
  type FamilyAspirationContext,
  type FamilySubjectInput,
} from './evaluateFamilyAspiration';
import type { FamilyAspirationService } from './FamilyAspirationService';

export interface PendingMarriage {
  maleId: string;
  femaleId: string;
  sharedHouseId: string;
  moverId: string;
  houseCost?: number;
}

/** Pregnancy, birth, child play aura — grants only (no auto RNG). */
export class FamilySystem {
  private pendingMarriage: PendingMarriage | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly aspirations: FamilyAspirationService
  ) {}

  setPendingMarriage(pending: PendingMarriage | null): void {
    this.pendingMarriage = pending;
  }

  consumePendingMarriage(): PendingMarriage | null {
    const p = this.pendingMarriage;
    this.pendingMarriage = null;
    return p;
  }

  buildContext(
    gold: number,
    infiniteGold: boolean,
    weddingActive: boolean
  ): FamilyAspirationContext {
    const subjects: FamilySubjectInput[] = this.subjects
      .listManaged()
      .map((s) => ({
        id: s.data.id,
        name: s.data.name,
        role: s.data.role,
        gender: s.data.gender,
        married: s.data.married,
        spouseId: s.data.spouseId,
        houseId: s.data.houseId,
        ageYears: s.data.ageYears,
        pregnant: s.data.pregnant,
        goal: s.data.goal,
      }));
    return {
      subjects,
      dwellings: this.aspirations.listDwellings(),
      occupantCounts: this.subjects.occupantCounts(),
      hasCathedral: this.buildings.hasCathedral(),
      hasBishop: this.subjects
        .listManaged()
        .some((s) => s.data.role === 'bishop'),
      weddingActive,
      gold,
      infiniteGold,
    };
  }

  evaluateFor(
    subjectId: string,
    gold: number,
    infiniteGold: boolean,
    weddingActive: boolean
  ) {
    const managed = this.subjects.getById(subjectId);
    if (!managed) return null;
    const ctx = this.buildContext(gold, infiniteGold, weddingActive);
    const input = ctx.subjects.find((s) => s.id === subjectId);
    if (!input) return null;
    return evaluateFamilyAspiration(input, ctx);
  }

  tryGrantMarriage(
    subjectId: string,
    gold: number,
    infiniteGold: boolean,
    weddingActive: boolean
  ): PendingMarriage | { error: string } | null {
    const managed = this.subjects.getById(subjectId);
    if (!managed) return { error: 'Subject not found' };
    const ctx = this.buildContext(gold, infiniteGold, weddingActive);
    const input = ctx.subjects.find((s) => s.id === subjectId);
    if (!input) return { error: 'Subject not found' };
    const view = evaluateFamilyAspiration(input, ctx);
    if (!view || view.kind !== FAMILY_GOAL_MARRY || !view.canGrant) {
      return { error: view?.blockReason ?? 'Cannot grant marriage' };
    }

    const partner = ctx.subjects.find((s) => s.id === managed.data.goal?.targetId);
    if (!partner) return { error: 'Partner not found' };

    const male = managed.data.gender === 'male' ? input : partner;
    const female = managed.data.gender === 'female' ? input : partner;
    const home = resolveMarriageHomeForGrant(input, ctx);
    if (!home?.ok) return { error: 'No home for the couple' };

    let sharedHouseId: string;
    let moverId: string;
    let houseCost: number | undefined;
    if (home.needsNewHouse) {
      const pt = this.buildings.spawnPointNearKeep('house');
      if (!pt) return { error: 'Cannot place a new house' };
      const rec = this.buildings.addPlayerHouse(pt.x, pt.y);
      if (!rec) return { error: 'Cannot place a new house' };
      sharedHouseId = rec.id;
      houseCost = 30;
      moverId =
        male.houseId !== sharedHouseId
          ? male.id
          : female.houseId !== sharedHouseId
            ? female.id
            : female.id;
    } else {
      sharedHouseId = home.houseId;
      moverId = home.moverId;
    }

    managed.data.goal = null;
    const partnerManaged = this.subjects.getById(partner.id);
    if (partnerManaged) partnerManaged.data.goal = null;

    return {
      maleId: male.id,
      femaleId: female.id,
      sharedHouseId,
      moverId,
      houseCost,
    };
  }

  applyMarriageHome(pending: PendingMarriage): void {
    const mover = this.subjects.getById(pending.moverId);
    if (mover) {
      mover.data.houseId = pending.sharedHouseId;
    }
    this.subjects.linkSpouses(pending.maleId, pending.femaleId);
    const a = this.subjects.getById(pending.maleId);
    const b = this.subjects.getById(pending.femaleId);
    if (a) a.data.goal = null;
    if (b) b.data.goal = null;
    this.subjects.notifyChanged();
  }

  tryGrantChild(
    subjectId: string,
    gold: number,
    infiniteGold: boolean,
    weddingActive: boolean
  ): boolean {
    const managed = this.subjects.getById(subjectId);
    if (!managed) return false;
    const ctx = this.buildContext(gold, infiniteGold, weddingActive);
    const input = ctx.subjects.find((s) => s.id === subjectId);
    if (!input) return false;
    const view = evaluateFamilyAspiration(input, ctx);
    if (!view || view.kind !== FAMILY_GOAL_HAVE_CHILD || !view.canGrant) {
      return false;
    }

    const mother =
      managed.data.gender === 'female'
        ? managed
        : managed.data.spouseId
          ? this.subjects.getById(managed.data.spouseId)
          : null;
    if (!mother || mother.data.gender !== 'female') return false;

    const home = resolveChildHomeForGrant(input, ctx);
    if (!home?.ok) return false;

    return this.grantPregnancy(mother.data.id, home.houseId);
  }

  grantPregnancy(motherId: string, childHouseId: string): boolean {
    const mother = this.subjects.getById(motherId);
    if (!mother || mother.data.pregnant) return false;
    mother.data.pregnant = true;
    mother.data.pregnantDaysLeft = Phase12Balance.pregnancyDays;
    mother.data.pendingChildHouseId = childHouseId;
    mother.data.goal = null;
    if (mother.data.spouseId) {
      const spouse = this.subjects.getById(mother.data.spouseId);
      if (spouse) spouse.data.goal = null;
    }
    this.subjects.appendLifeLog(motherId, 'Became pregnant', 'pregnancy');
    mother.data.thought = 'A new life grows…';
    if (mother.data.spouseId) {
      this.subjects.appendLifeLog(
        mother.data.spouseId,
        `${mother.data.name} is expecting`,
        'pregnancy'
      );
    }
    this.subjects.notifyChanged();
    return true;
  }

  onDayRolled(): void {
    for (const s of this.subjects.listManaged()) {
      if (!s.data.pregnant) continue;
      s.data.pregnantDaysLeft = (s.data.pregnantDaysLeft ?? 1) - 1;
      s.data.thought = 'The baby kicked…';
      if ((s.data.pregnantDaysLeft ?? 0) <= 0) {
        this.birth(s.data.id);
      }
    }
    this.subjects.notifyChanged();
  }

  private birth(motherId: string): void {
    const mother = this.subjects.getById(motherId);
    if (!mother) return;
    mother.data.pregnant = false;
    mother.data.pregnantDaysLeft = undefined;
    const childHouseId =
      mother.data.pendingChildHouseId ?? mother.data.houseId;
    mother.data.pendingChildHouseId = undefined;

    const fatherId = mother.data.spouseId;
    const father = fatherId ? this.subjects.getById(fatherId) : null;
    const parentName = father?.data.name ?? mother.data.name;
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const given = pickName(Date.now() % 10000);
    const name =
      gender === 'male'
        ? `${given}, son of ${parentName}`
        : `${given}, daughter of ${parentName}`;
    const childId = this.subjects.spawnChild({
      name,
      houseId: childHouseId,
      gender,
      motherId,
      fatherId: fatherId ?? undefined,
    });
    if (childId) {
      this.subjects.appendLifeLog(motherId, `Gave birth to ${name}`, 'birth');
      if (fatherId) {
        this.subjects.appendLifeLog(fatherId, `Welcomed ${name}`, 'birth');
      }
      this.subjects.adjustHappiness(motherId, 12);
      if (fatherId) this.subjects.adjustHappiness(fatherId, 10);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${name} was born!`,
      });
    }
  }

  updatePlay(_deltaMs: number): void {
    const children = this.subjects
      .listManaged()
      .filter((s) => s.data.role === 'child' && !s.interrupt);
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const a = children[i]!;
        const b = children[j]!;
        const d = Phaser.Math.Distance.Between(
          a.sprite.x,
          a.sprite.y,
          b.sprite.x,
          b.sprite.y
        );
        if (d < 36) {
          a.interrupt = {
            kind: 'play',
            partnerId: b.data.id,
            remainingMs: 2500,
          };
          b.interrupt = {
            kind: 'play',
            partnerId: a.data.id,
            remainingMs: 2500,
          };
          a.data.activityLabel = 'Playing together';
          b.data.activityLabel = 'Playing together';
          for (const adult of this.subjects.listManaged()) {
            if (adult.data.role === 'child') continue;
            const ad = Phaser.Math.Distance.Between(
              adult.sprite.x,
              adult.sprite.y,
              a.sprite.x,
              a.sprite.y
            );
            if (ad < 48) this.subjects.adjustHappiness(adult.data.id, 1);
          }
        }
      }
    }
  }
}

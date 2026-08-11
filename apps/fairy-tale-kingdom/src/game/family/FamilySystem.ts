import Phaser from 'phaser';
import { Phase12Balance } from '../economy/phase12Balance';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { KingdomEvents } from '../subjects/events';
import { pickName } from '../subjects/names';

/** Pregnancy, birth, child play aura. */
export class FamilySystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  onDayRolled(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.pregnant) {
        s.data.pregnantDaysLeft = (s.data.pregnantDaysLeft ?? 1) - 1;
        s.data.thought = 'The baby kicked…';
        if ((s.data.pregnantDaysLeft ?? 0) <= 0) {
          this.birth(s.data.id);
        }
        continue;
      }
      if (
        s.data.married &&
        s.data.gender === 'female' &&
        s.data.role !== 'child' &&
        !s.data.sick &&
        s.data.hunger < 70 &&
        Math.random() < 0.12
      ) {
        const used = [...this.subjects.occupantCounts().values()].reduce(
          (a, b) => a + b,
          0
        );
        if (used >= this.buildings.bedCapacity()) continue;
        s.data.pregnant = true;
        s.data.pregnantDaysLeft = Phase12Balance.pregnancyDays;
        this.subjects.appendLifeLog(s.data.id, 'Became pregnant', 'pregnancy');
        s.data.thought = 'A new life grows…';
        if (s.data.spouseId) {
          this.subjects.appendLifeLog(
            s.data.spouseId,
            `${s.data.name} is expecting`,
            'pregnancy'
          );
        }
      }
    }
    this.subjects.notifyChanged();
  }

  private birth(motherId: string): void {
    const mother = this.subjects.getById(motherId);
    if (!mother) return;
    mother.data.pregnant = false;
    mother.data.pregnantDaysLeft = undefined;
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
      houseId: mother.data.houseId,
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

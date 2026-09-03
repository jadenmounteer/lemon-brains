import Phaser from 'phaser';
import { KEEP_ID, type BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import { EconomyBalance } from '../economy/economy';
import { Phase12Balance } from '../economy/phase12Balance';
import type { HungerSystem } from '../economy/HungerSystem';
import type { SubjectSystem } from './SubjectSystem';

/**
 * Peacetime interrupts: harvest, peasant repair + street chat + meals.
 * Flee / combat stay in SubjectSystem + CombatSystem (higher priority).
 */
export class TaskSystem {
  private repairAccumMs = 0;
  private harvestAccumMs = 0;
  private chatRollAccumMs = 0;
  private hunger: HungerSystem | null = null;
  private inspired = false;
  private festivalMult = 1;

  constructor(
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  setHunger(hunger: HungerSystem): void {
    this.hunger = hunger;
  }

  setInspired(active: boolean): void {
    this.inspired = active;
  }

  setFestivalMult(mult: number): void {
    this.festivalMult = mult;
  }

  update(deltaMs: number, raidActive: boolean): void {
    // Meals always run — raids used to cancel eating and people starved with full stores.
    this.assignHungryEaters();
    this.tickEats(deltaMs);

    if (raidActive) {
      this.subjects.cancelInterrupts(['repair', 'chat', 'harvest']);
      this.repairAccumMs = 0;
      this.harvestAccumMs = 0;
      this.chatRollAccumMs = 0;
      return;
    }

    this.subjects.clearFleeInterrupts();
    this.assignHarvest();
    this.assignRepairs();
    this.tickHarvest(deltaMs);
    this.tickRepairs(deltaMs);
    this.tickChats(deltaMs);
    this.maybeStartChat(deltaMs);
  }

  private assignHungryEaters(): void {
    if (!this.hunger) return;
    // Skip assign when the larder is empty — avoids interrupt spam / "Found no food" loops
    if (this.hunger.currentFood() < Phase12Balance.mealCost) return;
    for (const managed of this.subjects.listManaged()) {
      if (managed.data.allegiance === 'camp') continue;
      if (!this.subjects.needsMeals(managed.data.role)) continue;
      if (managed.data.hunger < Phase12Balance.hungerInterruptAt) continue;
      // Meals preempt peacetime chores so harvesters don't starve next to full stores
      if (
        managed.interrupt &&
        (managed.interrupt.kind === 'harvest' ||
          managed.interrupt.kind === 'repair' ||
          managed.interrupt.kind === 'chat')
      ) {
        this.subjects.clearInterrupt(managed.data.id);
      }
      if (managed.interrupt) continue;
      this.subjects.beginEat(managed.data.id);
    }
  }

  private tickEats(deltaMs: number): void {
    for (const managed of this.subjects.withInterrupt('eat')) {
      if (managed.interrupt?.remainingMs == null) continue;
      managed.interrupt.remainingMs -= deltaMs;
      // Finish when the meal timer ends (don't wait on pathing — that caused starvation
      // while walking across the map or hopping path segments).
      if (managed.interrupt.remainingMs > 0) continue;
      this.settleEat(managed.data.id);
    }
  }

  private settleEat(subjectId: string): void {
    const managed = this.subjects.getById(subjectId);
    if (!managed) return;

    const ate = this.hunger?.tryConsumeMeal(Phase12Balance.mealCost) ?? false;
    if (ate) {
      this.subjects.recoverHungerFor(
        subjectId,
        Phase12Balance.mealHungerRecover
      );
      if (this.nearTavern(managed.sprite.x, managed.sprite.y)) {
        this.subjects.adjustHappiness(
          subjectId,
          Phase12Balance.tavernMealHappiness
        );
      }
      managed.data.activityLabel = 'Finished a meal';
    } else {
      managed.data.activityLabel = 'Found no food';
    }
    this.subjects.clearInterrupt(subjectId);
    this.subjects.resyncFromSchedule(subjectId);
  }

  private nearTavern(x: number, y: number): boolean {
    for (const b of this.buildings.list()) {
      if (b.kind !== 'tavern' || b.hp <= 0) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < 56) return true;
    }
    return false;
  }

  private foodLow(): boolean {
    if (!this.hunger) return false;
    const food = this.hunger.currentFood();
    const pop = Math.max(1, this.subjects.count());
    return food < pop * EconomyBalance.lowFoodMult;
  }

  private assignHarvest(): void {
    if (!this.foodLow() && this.buildings.fieldCount() === 0) return;
    if (this.buildings.fieldCount() === 0) return;

    // Also harvest during normal field work when food not critical — assign if low food
    if (!this.foodLow()) return;

    const claimed = new Set(
      this.subjects
        .listInterrupts('harvest')
        .map((i) => i.targetId)
        .filter(Boolean) as string[]
    );

    for (const managed of this.subjects.listManaged()) {
      if (managed.data.role !== 'peasant') continue;
      if (managed.interrupt || managed.data.onWall) continue;
      // When food is critical, even the sick must try to harvest
      if (managed.data.sick && !this.foodLow()) continue;
      const bound =
        managed.data.workplaceId && managed.data.job === 'farmer'
          ? this.buildings.getById(managed.data.workplaceId)
          : null;
      const field =
        bound?.kind === 'field'
          ? bound
          : this.buildings.nearestField(managed.sprite.x, managed.sprite.y);
      if (!field) break;
      if (claimed.has(field.id)) continue;
      this.subjects.beginHarvest(managed.data.id, field.id);
      claimed.add(field.id);
    }
  }

  private assignRepairs(): void {
    const damaged = this.buildings.listDamaged();
    if (!damaged.length) return;

    const claimed = new Set(
      this.subjects
        .listInterrupts('repair')
        .map((i) => i.targetId)
        .filter(Boolean) as string[]
    );

    for (const target of damaged) {
      if (claimed.has(target.id)) continue;
      const peasant = this.subjects.closestFreePeasant(target.x, target.y);
      if (!peasant) break;
      this.subjects.beginRepair(peasant, target.id, target.label);
      claimed.add(target.id);
    }
  }

  private tickHarvest(deltaMs: number): void {
    this.harvestAccumMs += deltaMs;
    if (this.harvestAccumMs < EconomyBalance.harvestTickMs) return;
    this.harvestAccumMs = 0;

    let mult = 1;
    if (this.buildings.hasGranary()) mult *= EconomyBalance.granaryHarvestMult;
    if (this.inspired) mult *= EconomyBalance.waveHarvestMult;
    mult *= this.festivalMult;

    for (const managed of this.subjects.withInterrupt('harvest')) {
      const fieldId = managed.interrupt?.targetId;
      if (!fieldId) continue;
      const field = this.buildings.getById(fieldId);
      if (!field || field.kind !== 'field') {
        this.subjects.clearInterrupt(managed.data.id);
        continue;
      }

      managed.data.activity = 'harvest';
      managed.data.activityLabel = 'Harvesting the fields';

      const stand = this.subjects.standPointAt(
        field.x,
        field.y,
        field.id,
        managed.data.id,
        { radius: 20 }
      );
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        stand.x,
        stand.y
      );
      if (dist > EconomyBalance.harvestRange) {
        this.subjects.nudgeToward(managed.data.id, stand.x, stand.y, 45);
        continue;
      }

      this.subjects.playWorkAnim(managed.data.id);
      const amount = Math.max(1, Math.round(EconomyBalance.foodPerHarvestTick * mult));
      this.hunger?.addFood(amount);
    }

    // Passive harvest: only assigned farmers at their bound field
    for (const managed of this.subjects.listManaged()) {
      if (managed.data.role !== 'peasant') continue;
      if (managed.interrupt) continue;
      if (managed.data.job !== 'farmer') continue;
      const wp = managed.data.workplaceId;
      if (!wp) continue;
      const field = this.buildings.getById(wp);
      if (!field || field.kind !== 'field' || field.hp <= 0) continue;

      const stand = this.subjects.standPointAt(
        field.x,
        field.y,
        field.id,
        managed.data.id,
        { radius: 20 }
      );
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        stand.x,
        stand.y
      );
      if (dist > EconomyBalance.harvestRange) continue;

      managed.data.activityLabel = 'Harvesting the fields';
      this.subjects.playWorkAnim(managed.data.id);
      const sickMult = managed.data.sick ? 0.25 : 1;
      const amount = Math.max(
        1,
        Math.round(EconomyBalance.foodPerHarvestTick * mult * sickMult)
      );
      this.hunger?.addFood(amount);
    }
  }

  private tickRepairs(deltaMs: number): void {
    this.repairAccumMs += deltaMs;
    if (this.repairAccumMs < CombatBalance.tickMs) return;
    this.repairAccumMs = 0;

    for (const managed of this.subjects.withInterrupt('repair')) {
      const targetId = managed.interrupt?.targetId;
      if (!targetId) continue;

      const label = this.buildings.displayNameForId(targetId);
      const pos =
        targetId === KEEP_ID
          ? this.buildings.getKeepPoint()
          : this.buildings.getById(targetId);

      if (!pos) {
        this.subjects.clearInterrupt(managed.data.id);
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        pos.x,
        pos.y
      );

      managed.data.activity = 'repair';
      managed.data.activityLabel = `Repairing ${label}`;

      if (dist > CombatBalance.repairRange) {
        this.subjects.nudgeToward(managed.data.id, pos.x, pos.y, 45);
        continue;
      }

      const done = this.buildings.repair(targetId, CombatBalance.repairPerTick);
      if (done) {
        this.subjects.clearInterrupt(managed.data.id);
      }
    }
  }

  private tickChats(deltaMs: number): void {
    const toClear = new Set<string>();
    for (const managed of this.subjects.withInterrupt('chat')) {
      if (managed.interrupt?.remainingMs == null) continue;
      managed.interrupt.remainingMs -= deltaMs;
      if (managed.interrupt.remainingMs <= 0) {
        toClear.add(managed.data.id);
        if (managed.interrupt.partnerId) {
          toClear.add(managed.interrupt.partnerId);
        }
      }
    }
    for (const id of toClear) {
      this.subjects.clearInterrupt(id);
    }
  }

  private maybeStartChat(deltaMs: number): void {
    this.chatRollAccumMs += deltaMs;
    if (this.chatRollAccumMs < 1500) return;
    this.chatRollAccumMs = 0;
    if (Math.random() > 0.22) return;

    const free = this.subjects.listFreeForChat();
    if (free.length < 2) return;

    for (let i = 0; i < free.length; i++) {
      const a = free[i]!;
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j]!;
        const d = Phaser.Math.Distance.Between(
          a.sprite.x,
          a.sprite.y,
          b.sprite.x,
          b.sprite.y
        );
        if (d > CombatBalance.chatRange) continue;
        this.subjects.beginChat(
          a.data.id,
          b.data.id,
          CombatBalance.chatDurationMs
        );
        return;
      }
    }
  }
}

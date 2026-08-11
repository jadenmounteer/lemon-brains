import Phaser from 'phaser';
import { KEEP_ID, type BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import { EconomyBalance } from '../economy/economy';
import type { HungerSystem } from '../economy/HungerSystem';
import type { SubjectSystem } from './SubjectSystem';

/**
 * Peacetime interrupts: harvest, peasant repair + street chat.
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
      if (managed.interrupt || managed.data.sick || managed.data.onWall) continue;
      const field = this.buildings.nearestField(
        managed.sprite.x,
        managed.sprite.y
      );
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

      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        field.x,
        field.y
      );
      if (dist > EconomyBalance.harvestRange) {
        this.subjects.nudgeToward(managed.data.id, field.x, field.y, 45);
        continue;
      }

      const amount = Math.max(1, Math.round(EconomyBalance.foodPerHarvestTick * mult));
      this.hunger?.addFood(amount);

      // Passive schedule peasants near fields also produce when not interrupted
    }

    // Passive harvest: peasants on field work near a field
    for (const managed of this.subjects.listManaged()) {
      if (managed.data.role !== 'peasant' || managed.data.sick) continue;
      if (managed.interrupt) continue;
      if (managed.data.zone !== 'field' && managed.data.activity !== 'work') {
        continue;
      }
      const field = this.buildings.nearestField(
        managed.sprite.x,
        managed.sprite.y,
        EconomyBalance.harvestRange
      );
      if (!field) continue;
      const amount = Math.max(
        1,
        Math.round(EconomyBalance.foodPerHarvestTick * mult * 0.5)
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

import Phaser from 'phaser';
import { KEEP_ID, type BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import type { SubjectSystem } from './SubjectSystem';

/**
 * Peacetime interrupts: peasant repair + street chat.
 * Flee / combat stay in SubjectSystem + CombatSystem (higher priority).
 */
export class TaskSystem {
  private repairAccumMs = 0;
  private chatRollAccumMs = 0;

  constructor(
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  update(deltaMs: number, raidActive: boolean): void {
    if (raidActive) {
      this.subjects.cancelInterrupts(['repair', 'chat']);
      this.repairAccumMs = 0;
      this.chatRollAccumMs = 0;
      return;
    }

    this.subjects.clearFleeInterrupts();
    this.assignRepairs();
    this.tickRepairs(deltaMs);
    this.tickChats(deltaMs);
    this.maybeStartChat(deltaMs);
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

      const x = pos.x;
      const y = pos.y;
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        x,
        y
      );

      managed.data.activity = 'repair';
      managed.data.activityLabel = `Repairing ${label}`;

      if (dist > CombatBalance.repairRange) {
        this.subjects.nudgeToward(managed.data.id, x, y, 45);
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

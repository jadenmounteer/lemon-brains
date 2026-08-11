import Phaser from 'phaser';
import {
  UNIT_HEIGHT,
  UNIT_WIDTH,
  idleAnimKey,
  isMilitaryRole,
  livesAtKeep,
  walkAnimKey,
  type Direction,
  type UnitRole,
} from '../art/assetManifest';
import type { SavedSubject } from '../../kingdom/LayoutRepository';
import type { Aabb, BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance, UNIT_MAX_HP } from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import type { RaidSystem } from '../raids/RaidSystem';
import { DayClock } from './DayClock';
import { KingdomEvents } from './events';
import { genderForNewSubject, genderLabel } from './gender';
import { pickName } from './names';
import { roleLabel, scheduleSummary, slotAtHour } from './schedules';
import type {
  BuildingResident,
  InterruptKind,
  Subject,
  SubjectInterrupt,
  SubjectSnapshot,
} from './types';
import { randomPointInZone, type WorldBounds } from './zones';

export type ManagedSubject = {
  data: Subject;
  sprite: Phaser.GameObjects.Sprite;
  moving: boolean;
  fleeCooldownMs: number;
  interrupt: SubjectInterrupt | null;
};

/** Three residents per starter house (house-0 then house-1). */
const SEED_ROLES: UnitRole[] = [
  'peasant',
  'peasant',
  'guard',
  'guard',
  'archer',
  'archer',
];

export class SubjectSystem {
  readonly clock = new DayClock();
  private subjects: ManagedSubject[] = [];
  private selectedId: string | null = null;
  private marker: Phaser.GameObjects.Arc | null = null;
  private dayEmitAccumMs = 0;
  private healAccumMs = 0;
  private nextSubjectId = 0;
  private buildings: BuildingSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private raidMode = false;
  private inspired = false;
  private fgmCanTransform = false;
  private onChanged: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds
  ) {}

  setBuildings(buildings: BuildingSystem): void {
    this.buildings = buildings;
  }

  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  setInspired(active: boolean): void {
    this.inspired = active;
  }

  setFgmCanTransform(ready: boolean): void {
    this.fgmCanTransform = ready;
  }

  setRaidMode(active: boolean): void {
    const was = this.raidMode;
    this.raidMode = active;
    if (active && !was) {
      this.cancelInterrupts(['repair', 'chat', 'harvest']);
    }
    if (!active && was) {
      this.cancelInterrupts(['defend', 'flee']);
    }
  }

  beginDefend(subjectId: string, x: number, y: number): void {
    const managed = this.getById(subjectId);
    if (!managed || !isMilitaryRole(managed.data.role)) return;
    managed.interrupt = { kind: 'defend' };
    managed.data.activity = 'defend';
    managed.data.activityLabel = 'Defending the walls';
    this.nudgeToward(subjectId, x, y, 55);
  }

  beginFleeFromMonster(subjectId: string, fromX: number, fromY: number): void {
    const managed = this.getById(subjectId);
    if (!managed || managed.data.role !== 'peasant') return;
    managed.interrupt = { kind: 'flee' };
    managed.data.activity = 'flee';
    managed.data.activityLabel = 'Fleeing a monster';
    const awayX = managed.sprite.x - (fromX - managed.sprite.x);
    const awayY = managed.sprite.y - (fromY - managed.sprite.y);
    this.nudgeToward(subjectId, awayX, awayY, 70);
  }

  tickDefenseMuster(armySiege: boolean): void {
    if (!armySiege || !this.buildings) {
      this.cancelInterrupts(['defend']);
      return;
    }
    const muster = this.buildings.defenseMusterPoint();
    let i = 0;
    for (const managed of this.subjects) {
      if (!isMilitaryRole(managed.data.role)) continue;
      if (managed.data.sick) continue;
      if (managed.data.onWall) continue;
      if (managed.interrupt?.kind === 'flee') continue;
      const ox = ((i % 5) - 2) * 14;
      const oy = Math.floor(i / 5) * 12;
      i += 1;
      if (managed.interrupt?.kind !== 'defend') {
        this.beginDefend(managed.data.id, muster.x + ox, muster.y + oy);
      } else if (!managed.moving) {
        const d = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          muster.x + ox,
          muster.y + oy
        );
        if (d > 40) {
          this.nudgeToward(managed.data.id, muster.x + ox, muster.y + oy, 55);
        }
      }
    }
  }

  hasInterrupt(id: string): boolean {
    return Boolean(this.getById(id)?.interrupt);
  }

  withInterrupt(kind: InterruptKind): ManagedSubject[] {
    return this.subjects.filter((s) => s.interrupt?.kind === kind);
  }

  listInterrupts(kind: InterruptKind): SubjectInterrupt[] {
    return this.subjects
      .filter((s) => s.interrupt?.kind === kind)
      .map((s) => s.interrupt!);
  }

  clearInterrupt(id: string): void {
    const managed = this.getById(id);
    if (!managed?.interrupt) return;
    managed.interrupt = null;
  }

  /**
   * Assign up to `count` free guards/archers (not knights/generals) to assault a target.
   * targetId is a camp id or `monster:<id>`.
   */
  assignAssault(targetId: string, count: number, _generalId: string): number {
    const commandable = this.subjects.filter(
      (s) =>
        !s.data.sick &&
        !s.interrupt &&
        !s.data.onWall &&
        (s.data.role === 'guard' ||
          s.data.role === 'archer' ||
          s.data.role === 'elite_guard' ||
          s.data.role === 'elite_archer')
    );
    let assigned = 0;
    for (const s of commandable) {
      if (assigned >= count) break;
      s.interrupt = { kind: 'assault', targetId };
      s.data.activityLabel = 'On assault orders';
      assigned += 1;
    }
    return assigned;
  }

  clearAssault(targetId: string): void {
    for (const s of this.subjects) {
      if (s.interrupt?.kind === 'assault' && s.interrupt.targetId === targetId) {
        s.interrupt = null;
      }
    }
  }

  cancelInterrupts(kinds: InterruptKind[]): void {
    for (const s of this.subjects) {
      if (s.interrupt && kinds.includes(s.interrupt.kind)) {
        s.interrupt = null;
      }
    }
  }

  clearFleeInterrupts(): void {
    for (const s of this.subjects) {
      if (s.interrupt?.kind === 'flee') {
        s.interrupt = null;
      }
    }
  }

  /** Free healthy peasant for repair/harvest (no interrupt, not on wall). */
  closestFreePeasant(x: number, y: number): string | null {
    let best: ManagedSubject | null = null;
    let bestD = Infinity;
    for (const s of this.subjects) {
      if (s.data.role !== 'peasant') continue;
      if (s.interrupt || s.data.onWall || s.data.sick) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best?.data.id ?? null;
  }

  beginRepair(subjectId: string, targetId: string, label: string): void {
    const managed = this.getById(subjectId);
    if (!managed || managed.data.sick) return;
    managed.interrupt = { kind: 'repair', targetId };
    managed.data.activity = 'repair';
    managed.data.activityLabel = `Repairing ${label}`;
  }

  beginHarvest(subjectId: string, fieldId: string): void {
    const managed = this.getById(subjectId);
    if (!managed || managed.data.sick) return;
    managed.interrupt = { kind: 'harvest', targetId: fieldId };
    managed.data.activity = 'harvest';
    managed.data.activityLabel = 'Harvesting the fields';
  }

  listFreeForChat(): ManagedSubject[] {
    return this.subjects.filter(
      (s) => !s.interrupt && !s.data.onWall && !s.moving && !s.data.sick
    );
  }

  listManaged(): ManagedSubject[] {
    return this.subjects;
  }

  hasRole(role: UnitRole): boolean {
    return this.subjects.some((s) => s.data.role === role);
  }

  countRole(role: UnitRole): number {
    return this.subjects.filter((s) => s.data.role === role).length;
  }

  nearestPeasant(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.subjects) {
      if (s.data.role !== 'peasant' || s.data.sick) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  nearestFemalePeasant(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.subjects) {
      if (s.data.role !== 'peasant' || s.data.sick) continue;
      if (s.data.gender !== 'female') continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  nearestMilitary(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.subjects) {
      if (!isMilitaryRole(s.data.role) || s.data.sick) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  firstByRole(role: UnitRole): ManagedSubject | null {
    return this.subjects.find((s) => s.data.role === role) ?? null;
  }

  unmarriedPrincess(): ManagedSubject | null {
    return (
      this.subjects.find(
        (s) =>
          s.data.role === 'princess' &&
          (!s.data.married || s.data.temporaryPrincess)
      ) ?? null
    );
  }

  revertUnmarriedBallPrincesses(): void {
    for (const s of this.subjects) {
      if (s.data.role !== 'princess') continue;
      if (!s.data.temporaryPrincess) continue;
      if (s.data.married) continue;
      this.transformRole(s.data.id, 'peasant', {
        temporaryPrincess: false,
        married: false,
      });
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${s.data.name} turned back into a peasant at dawn`,
      });
    }
  }

  transformRole(
    id: string,
    role: UnitRole,
    opts?: { temporaryPrincess?: boolean; married?: boolean }
  ): boolean {
    const managed = this.getById(id);
    if (!managed) return false;
    managed.data.role = role;
    managed.data.maxHp = UNIT_MAX_HP[role];
    managed.data.hp = Math.min(managed.data.hp, managed.data.maxHp);
    managed.data.temporaryPrincess = Boolean(opts?.temporaryPrincess);
    if (opts?.married !== undefined) managed.data.married = opts.married;
    if (role === 'princess' && opts?.temporaryPrincess) {
      managed.data.gender = 'female';
    }
    if (role === 'peasant') {
      managed.data.temporaryPrincess = false;
      managed.data.married = false;
    }
    managed.sprite.setTexture(role, 0);
    managed.sprite.play(idleAnimKey(role));
    managed.interrupt = null;
    this.onChanged?.();
    return true;
  }

  markBallGather(): void {
    for (const s of this.subjects) {
      if (!livesAtKeep(s.data.role) && s.data.role !== 'peasant') continue;
      s.data.activity = 'ball';
      s.data.activityLabel = 'Attending the royal ball';
      s.data.zone = 'keep';
      this.nudgeTowardSchedule(s);
    }
  }

  markFestivalGather(): void {
    for (const s of this.subjects) {
      s.data.activity = 'festival';
      s.data.activityLabel = 'Celebrating at the festival';
      s.data.zone = 'keep';
    }
  }

  beginWedding(
    princeId: string,
    princessId: string,
    bishopId: string,
    cathedral: { x: number; y: number },
    durationMs: number
  ): void {
    const ids = [princeId, princessId, bishopId];
    for (const id of ids) {
      const m = this.getById(id);
      if (!m) continue;
      m.interrupt = {
        kind: 'wedding',
        partnerId: princessId,
        remainingMs: durationMs,
      };
      m.data.activity = 'wedding';
      m.data.activityLabel = 'At a royal wedding';
      this.nudgeToward(id, cathedral.x, cathedral.y, 50);
    }
    this.scene.time.delayedCall(durationMs, () => {
      const princess = this.getById(princessId);
      if (princess && princess.data.role === 'princess') {
        princess.data.temporaryPrincess = false;
        princess.data.married = true;
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${princess.data.name} remains a Princess forever!`,
        });
      }
      for (const id of ids) this.clearInterrupt(id);
      this.onChanged?.();
    });
  }

  healNearestSick(physicianId: string): boolean {
    const doc = this.getById(physicianId);
    if (!doc || doc.data.role !== 'physician' || doc.data.sick) return false;

    const needsCare = (s: ManagedSubject) =>
      s.data.id !== physicianId &&
      (s.data.sick || s.data.hp < s.data.maxHp);

    let best: ManagedSubject | null = null;
    let bestScore = Infinity;
    for (const s of this.subjects) {
      if (!needsCare(s)) continue;
      const d = Phaser.Math.Distance.Between(
        doc.sprite.x,
        doc.sprite.y,
        s.sprite.x,
        s.sprite.y
      );
      // Prefer sick over wounded; then nearer
      const score = d + (s.data.sick ? 0 : 40);
      if (score < bestScore && d < CombatBalance.physicianHealRange + 80) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) return false;

    const d = Phaser.Math.Distance.Between(
      doc.sprite.x,
      doc.sprite.y,
      best.sprite.x,
      best.sprite.y
    );
    if (d > CombatBalance.physicianHealRange) {
      this.nudgeToward(physicianId, best.sprite.x, best.sprite.y, 45);
      doc.data.activity = 'heal';
      doc.data.activityLabel = `Seeking ${best.data.name}`;
      return false;
    }

    const wasSick = best.data.sick;
    const wasHurt = best.data.hp < best.data.maxHp;
    if (wasSick) {
      best.data.sick = false;
      best.data.hunger = Math.max(
        0,
        best.data.hunger - CombatBalance.physicianHealHunger
      );
    }
    if (wasHurt) {
      best.data.hp = Math.min(
        best.data.maxHp,
        best.data.hp + CombatBalance.physicianHealHp
      );
    }
    this.applyHpTint(best);
    doc.data.activity = 'heal';
    doc.data.activityLabel = wasSick
      ? `Healing ${best.data.name}`
      : `Bandaging ${best.data.name}`;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: wasSick
        ? `${doc.data.name} healed ${best.data.name}`
        : `${doc.data.name} tended ${best.data.name}'s wounds`,
    });
    this.onChanged?.();
    return true;
  }

  applyStarvation(amount: number): void {
    for (const s of [...this.subjects]) {
      s.data.hunger = Math.min(100, s.data.hunger + amount);
      const wasSick = s.data.sick;
      s.data.sick = s.data.hunger >= 60;
      if (s.data.sick && !wasSick) {
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${s.data.name} fell sick from hunger`,
        });
        if (s.interrupt?.kind === 'repair' || s.interrupt?.kind === 'harvest') {
          s.interrupt = null;
        }
      }
      this.applyHpTint(s);
      if (s.data.hunger >= 100) {
        const name = s.data.name;
        this.removeSubject(s);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${name} starved`,
        });
        this.onChanged?.();
      }
    }
  }

  recoverHunger(amount: number): void {
    for (const s of this.subjects) {
      s.data.hunger = Math.max(0, s.data.hunger - amount);
      s.data.sick = s.data.hunger >= 60;
      this.applyHpTint(s);
    }
  }

  extractCaptive(id: string): SavedSubject | null {
    const managed = this.getById(id);
    if (!managed) return null;
    const saved: SavedSubject = {
      id: managed.data.id,
      name: managed.data.name,
      role: managed.data.role,
      houseId: managed.data.houseId,
      hp: managed.data.maxHp,
      maxHp: managed.data.maxHp,
      onWall: false,
      hunger: 0,
      sick: false,
    };
    this.removeSubject(managed);
    this.onChanged?.();
    return saved;
  }

  restoreCaptive(saved: SavedSubject, at: { x: number; y: number }): void {
    this.createSubject(saved.role, saved.houseId, saved.id, saved.name, {
      hp: saved.maxHp,
      maxHp: saved.maxHp,
      onWall: false,
      hunger: 0,
      sick: false,
    });
    const managed = this.getById(saved.id);
    if (managed) {
      managed.sprite.setPosition(at.x, at.y);
    }
    this.onChanged?.();
  }

  beginChat(aId: string, bId: string, durationMs: number): void {
    const a = this.getById(aId);
    const b = this.getById(bId);
    if (!a || !b) return;
    a.interrupt = {
      kind: 'chat',
      partnerId: bId,
      remainingMs: durationMs,
    };
    b.interrupt = {
      kind: 'chat',
      partnerId: aId,
      remainingMs: durationMs,
    };
    a.data.activity = 'chat';
    b.data.activity = 'chat';
    a.data.activityLabel = `Talking with ${b.data.name}`;
    b.data.activityLabel = `Talking with ${a.data.name}`;
    this.scene.tweens.killTweensOf(a.sprite);
    this.scene.tweens.killTweensOf(b.sprite);
    a.moving = false;
    b.moving = false;
    a.sprite.play(idleAnimKey(a.data.role));
    b.sprite.play(idleAnimKey(b.data.role));
  }

  spawnSeed(): void {
    SEED_ROLES.forEach((role, index) => {
      const houseId = index < 3 ? 'house-0' : 'house-1';
      this.createSubject(
        role,
        houseId,
        `subject-${index}`,
        pickName(1000 + index * 97)
      );
    });
    this.nextSubjectId = SEED_ROLES.length;
    this.ensureMarker();
  }

  restore(saved: SavedSubject[]): void {
    this.clearSubjects();
    for (const s of saved) {
      this.createSubject(s.role, s.houseId, s.id, s.name, {
        hp: s.hp,
        maxHp: s.maxHp,
        onWall: s.onWall,
        hunger: s.hunger,
        sick: s.sick,
        gender: s.gender,
        temporaryPrincess: s.temporaryPrincess,
        married: s.married,
      });
      const match = /^subject-(\d+)$/.exec(s.id);
      if (match) {
        this.nextSubjectId = Math.max(this.nextSubjectId, Number(match[1]) + 1);
      }
    }
    this.ensureMarker();
  }

  serialize(): SavedSubject[] {
    return this.subjects.map((s) => ({
      id: s.data.id,
      name: s.data.name,
      role: s.data.role,
      houseId: s.data.houseId,
      hp: s.data.hp,
      maxHp: s.data.maxHp,
      onWall: s.data.onWall,
      hunger: s.data.hunger,
      sick: s.data.sick,
      gender: s.data.gender,
      temporaryPrincess: s.data.temporaryPrincess,
      married: s.data.married,
    }));
  }

  count(): number {
    return this.subjects.length;
  }

  royalCounts(): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.subjects) {
      if (!livesAtKeep(s.data.role)) continue;
      map.set(s.data.houseId, (map.get(s.data.houseId) ?? 0) + 1);
    }
    return map;
  }

  occupantCounts(): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.subjects) {
      if (livesAtKeep(s.data.role)) continue;
      if (!this.buildings?.getHousePoint(s.data.houseId)) continue;
      map.set(s.data.houseId, (map.get(s.data.houseId) ?? 0) + 1);
    }
    return map;
  }

  unitBodies(): Aabb[] {
    return this.subjects.map((s) => ({
      left: s.sprite.x - UNIT_WIDTH / 2 - 2,
      right: s.sprite.x + UNIT_WIDTH / 2 + 2,
      top: s.sprite.y - UNIT_HEIGHT,
      bottom: s.sprite.y,
    }));
  }

  hire(role: UnitRole): boolean {
    if (!this.buildings) return false;
    if (role === 'fairy_godmother' && this.hasRole(role)) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `You already have a ${roleLabel(role)}`,
      });
      return false;
    }
    if (role === 'bishop' && this.hasRole('bishop')) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'You already have a Bishop',
      });
      return false;
    }
    if ((role === 'king' || role === 'queen') && this.buildings) {
      const cap = this.buildings.keepCount();
      if (this.countRole(role) >= cap) {
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `Need another keep for another ${roleLabel(role)}`,
        });
        return false;
      }
    }

    let houseId: string | null = null;
    if (livesAtKeep(role)) {
      houseId = this.buildings.pickKeepForHire(this.royalCounts());
      if (!houseId) {
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'No free royal chambers — build another keep',
        });
        return false;
      }
    } else {
      houseId = this.buildings.pickHouseForHire(this.occupantCounts());
      if (!houseId) {
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'No free beds — build a house first',
        });
        return false;
      }
    }
    const id = `subject-${this.nextSubjectId++}`;
    const name =
      role === 'prince'
        ? pickName(9000 + this.nextSubjectId * 17)
        : pickName(2000 + this.nextSubjectId * 41);
    this.createSubject(role, houseId, id, name);
    const managed = this.subjects[this.subjects.length - 1]!;
    this.scene.time.delayedCall(200, () => this.nudgeTowardSchedule(managed));
    this.onChanged?.();
    return true;
  }

  list(): Subject[] {
    return this.subjects.map((s) => s.data);
  }

  residentsOf(houseId: string): BuildingResident[] {
    return this.subjects
      .filter((s) => s.data.houseId === houseId)
      .map((s) => ({
        id: s.data.id,
        name: s.data.name,
        roleLabel: roleLabel(s.data.role),
      }));
  }

  combatants(): ManagedSubject[] {
    return this.subjects.filter(
      (s) => !s.data.sick && isMilitaryRole(s.data.role)
    );
  }

  nearestSubject(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.subjects) {
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  getById(id: string): ManagedSubject | undefined {
    return this.subjects.find((s) => s.data.id === id);
  }

  /** Tight world-space body pick (feet at sprite origin). */
  pickAt(worldX: number, worldY: number): string | null {
    let best: ManagedSubject | null = null;
    let bestY = -Infinity;
    for (const s of this.subjects) {
      if (!s.sprite.active) continue;
      const left = s.sprite.x - UNIT_WIDTH / 2;
      const right = s.sprite.x + UNIT_WIDTH / 2;
      const top = s.sprite.y - UNIT_HEIGHT;
      const bottom = s.sprite.y;
      if (worldX < left || worldX > right || worldY < top || worldY > bottom) {
        continue;
      }
      if (s.sprite.y >= bestY) {
        best = s;
        bestY = s.sprite.y;
      }
    }
    return best?.data.id ?? null;
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(id: string | null): SubjectSnapshot | null {
    this.selectedId = id;
    if (!id) {
      this.marker?.setVisible(false);
      for (const s of this.subjects) {
        s.sprite.clearTint();
        this.applyHpTint(s);
      }
      return null;
    }

    const managed = this.getById(id);
    if (!managed) {
      this.selectedId = null;
      this.marker?.setVisible(false);
      return null;
    }

    for (const s of this.subjects) {
      if (s.data.id === id) {
        s.sprite.setTint(0xfff0c0);
      } else {
        s.sprite.clearTint();
        this.applyHpTint(s);
      }
    }

    this.marker
      ?.setPosition(managed.sprite.x, managed.sprite.y - 2)
      .setVisible(true);

    return this.toSnapshot(managed);
  }

  update(deltaMs: number): void {
    const rolled = this.clock.tick(deltaMs);
    this.syncActivities();

    if (rolled) {
      this.scene.game.events.emit(KingdomEvents.DAY_ROLLED);
    }

    this.dayEmitAccumMs += deltaMs;
    if (this.dayEmitAccumMs >= 1000) {
      this.dayEmitAccumMs = 0;
      this.scene.game.events.emit(KingdomEvents.DAY_TICK, {
        dayPhase: this.clock.phase,
        hour: this.clock.hour,
      });
    }

    if (!this.raidMode) {
      for (const managed of this.subjects) {
        if (managed.interrupt) continue;
        if (!managed.moving && Math.random() < deltaMs * 0.0004) {
          this.nudgeTowardSchedule(managed);
        }
      }
    }

    this.healAccumMs += deltaMs;
    if (this.healAccumMs >= 2500) {
      this.healAccumMs = 0;
      for (const s of this.subjects) {
        if (s.data.role !== 'physician' || s.data.sick) continue;
        if (s.interrupt) continue;
        this.healNearestSick(s.data.id);
      }
    }

    if (this.selectedId && this.marker) {
      const sel = this.getById(this.selectedId);
      if (sel) {
        this.marker.setPosition(sel.sprite.x, sel.sprite.y - 2);
      }
    }
  }

  tickFleeAndClimb(raids: RaidSystem, deltaMs: number): void {
    for (const managed of this.subjects) {
      if (managed.data.role === 'peasant') {
        managed.fleeCooldownMs -= deltaMs;
        if (managed.fleeCooldownMs > 0) continue;
        const threat = raids.nearestRaider(
          managed.sprite.x,
          managed.sprite.y,
          CombatBalance.fleeRadius * 2
        );
        if (!threat) continue;
        managed.fleeCooldownMs = 700;
        managed.interrupt = { kind: 'flee' };
        managed.data.activity = 'flee';
        managed.data.activityLabel = 'Fleeing raiders';
        const keep = {
          x: this.world.width / 2,
          y: this.world.height / 2,
        };
        const awayX = managed.sprite.x - (threat.sprite.x - managed.sprite.x);
        const awayY = managed.sprite.y - (threat.sprite.y - managed.sprite.y);
        const dKeep = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          keep.x,
          keep.y
        );
        const targetX = dKeep < 120 ? keep.x : (awayX + keep.x) / 2;
        const targetY = dKeep < 120 ? keep.y + 30 : (awayY + keep.y) / 2;
        this.nudgeToward(managed.data.id, targetX, targetY, 70);
      } else if (managed.data.role === 'archer' && !managed.data.onWall) {
        this.tryClimbNearestStairs(managed.data.id);
      } else if (
        managed.data.role === 'guard' &&
        !managed.data.onWall &&
        Math.random() < 0.02
      ) {
        this.tryClimbNearestStairs(managed.data.id);
      }
    }
  }

  tryClimbNearestStairs(subjectId: string): boolean {
    const managed = this.getById(subjectId);
    if (!managed || !this.buildings) return false;
    const stairs = this.buildings.stairsNear(
      managed.sprite.x,
      managed.sprite.y,
      80
    );
    if (!stairs) return false;
    const wall = this.buildings.wallForStairs(stairs);
    if (!wall) return false;

    managed.data.activity = 'climb';
    managed.data.activityLabel = 'Climbing the wall';
    this.nudgeToward(subjectId, stairs.x, stairs.y, 50, () => {
      managed.data.onWall = true;
      managed.sprite.setPosition(wall.x, wall.y - 10);
      managed.sprite.setDepth(22 + wall.y * 0.01);
      managed.data.activityLabel = 'On the wall';
      managed.data.zone = 'wall';
    });
    return true;
  }

  /** Drop anyone standing on a destroyed wall. */
  dropFromWall(wallId: string): void {
    if (!this.buildings) return;
    const wall = this.buildings.getById(wallId);
    for (const s of this.subjects) {
      if (!s.data.onWall) continue;
      if (wall) {
        const d = Phaser.Math.Distance.Between(
          s.sprite.x,
          s.sprite.y,
          wall.x,
          wall.y
        );
        if (d > 40) continue;
      }
      s.data.onWall = false;
      s.sprite.setPosition(s.sprite.x, s.sprite.y + 16);
    }
  }

  onHouseDestroyed(houseId: string): void {
    for (const s of this.subjects) {
      if (s.data.houseId !== houseId) continue;
      const next = this.buildings?.pickHouseForHire(this.occupantCounts());
      s.data.houseId = next ?? '';
    }
  }

  damageSubject(id: string, amount: number): boolean {
    const managed = this.getById(id);
    if (!managed) return false;
    managed.data.hp = Math.max(0, managed.data.hp - amount);
    this.applyHpTint(managed);
    if (managed.data.hp <= 0) {
      const name = managed.data.name;
      const role = managed.data.role;
      const houseId = managed.data.houseId;
      this.removeSubject(managed);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${name} was slain`,
      });
      if (role === 'king' || role === 'queen') {
        this.trySuccession(houseId);
      }
      this.onChanged?.();
      return true;
    }
    this.onChanged?.();
    return false;
  }

  /** Married prince + princess at a keep become king & queen if both thrones are empty. */
  private trySuccession(keepId: string): void {
    const hasKing = this.subjects.some(
      (s) => s.data.role === 'king' && s.data.houseId === keepId
    );
    const hasQueen = this.subjects.some(
      (s) => s.data.role === 'queen' && s.data.houseId === keepId
    );
    if (hasKing || hasQueen) return;

    const prince = this.subjects.find(
      (s) =>
        s.data.role === 'prince' &&
        s.data.married &&
        s.data.houseId === keepId
    );
    const princess = this.subjects.find(
      (s) =>
        s.data.role === 'princess' &&
        s.data.married &&
        s.data.houseId === keepId
    );
    if (!prince || !princess) return;

    this.transformRole(prince.data.id, 'king', { married: true });
    this.transformRole(princess.data.id, 'queen', { married: true });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${prince.data.name} and ${princess.data.name} take the throne!`,
    });
  }

  nudgeToward(
    id: string,
    targetX: number,
    targetY: number,
    speed = 40,
    onArrive?: () => void
  ): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active) return;
    if (managed.data.onWall) return;

    const pad = 32;
    let x = Phaser.Math.Clamp(targetX, pad, this.world.width - pad);
    let y = Phaser.Math.Clamp(targetY, pad, this.world.height - pad);

    // Path around walls / closed gates for all ground units
    if (this.pathGrid) {
      const path = this.pathGrid.findPath(
        { x: managed.sprite.x, y: managed.sprite.y },
        { x, y }
      );
      if (path && path.length > 1) {
        const hop = Math.min(3, path.length - 1);
        x = path[hop]!.x;
        y = path[hop]!.y;
        const atGoal =
          Phaser.Math.Distance.Between(
            path[path.length - 1]!.x,
            path[path.length - 1]!.y,
            targetX,
            targetY
          ) < 18;
        const continuePath = !atGoal
          ? () => this.nudgeToward(id, targetX, targetY, speed, onArrive)
          : onArrive;
        this.tweenMove(managed, x, y, speed, continuePath);
        return;
      }
      // No path — do not walk through fortifications
      if (this.pathGrid.isWorldBlocked(x, y)) {
        onArrive?.();
        return;
      }
    }

    const dx = x - managed.sprite.x;
    const dy = y - managed.sprite.y;
    if (Math.hypot(dx, dy) < 6) {
      onArrive?.();
      return;
    }

    this.tweenMove(managed, x, y, speed, onArrive);
  }

  private tweenMove(
    managed: ManagedSubject,
    x: number,
    y: number,
    speed: number,
    onArrive?: () => void
  ): void {
    const dx = x - managed.sprite.x;
    const dy = y - managed.sprite.y;
    if (Math.hypot(dx, dy) < 4) {
      onArrive?.();
      return;
    }

    this.scene.tweens.killTweensOf(managed.sprite);
    managed.moving = false;

    let moveSpeed = speed;
    if (managed.data.sick) moveSpeed *= 0.55;
    else if (this.inspired && managed.data.role === 'peasant') moveSpeed *= 1.15;

    const dir = facingFromDelta(dx, dy);
    managed.sprite.play(walkAnimKey(managed.data.role, dir), true);
    managed.moving = true;
    const dist = Math.hypot(dx, dy);
    const duration = Math.max(200, (dist / moveSpeed) * 1000);

    this.scene.tweens.add({
      targets: managed.sprite,
      x,
      y,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        managed.sprite.setDepth(20 + managed.sprite.y * 0.01);
      },
      onComplete: () => {
        managed.moving = false;
        if (managed.sprite.active) {
          managed.sprite.play(idleAnimKey(managed.data.role));
        }
        onArrive?.();
      },
    });
  }

  refreshSelectedSnapshot(): SubjectSnapshot | null {
    if (!this.selectedId) return null;
    const managed = this.getById(this.selectedId);
    return managed ? this.toSnapshot(managed) : null;
  }

  private createSubject(
    role: UnitRole,
    houseId: string,
    id: string,
    name: string,
    opts?: {
      hp?: number;
      maxHp?: number;
      onWall?: boolean;
      hunger?: number;
      sick?: boolean;
      gender?: 'male' | 'female';
      temporaryPrincess?: boolean;
      married?: boolean;
    }
  ): void {
    const slot = slotAtHour(role, this.clock.hour);
    const home = this.buildings?.getHousePoint(houseId) ?? null;
    const start = randomPointInZone(slot.zone, this.world, home);
    const maxHp = opts?.maxHp ?? UNIT_MAX_HP[role];
    const hp = opts?.hp ?? maxHp;
    const hunger = opts?.hunger ?? 0;
    const seed = Number(id.replace(/\D/g, '')) || 1;
    const gender =
      opts?.gender ?? genderForNewSubject(role, name, seed);

    const sprite = this.scene.add.sprite(start.x, start.y, role, 0);
    sprite.setDepth(20);
    sprite.setOrigin(0.5, 1);
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(-6, -4, UNIT_WIDTH + 12, UNIT_HEIGHT + 8),
      Phaser.Geom.Rectangle.Contains
    );
    sprite.input!.cursor = 'pointer';
    sprite.setData('subjectId', id);
    sprite.play(idleAnimKey(role));

    const data: Subject = {
      id,
      name,
      role,
      gender,
      houseId,
      activity: slot.activity,
      activityLabel: slot.label,
      zone: slot.zone,
      hp,
      maxHp,
      onWall: Boolean(opts?.onWall),
      hunger,
      sick: opts?.sick ?? hunger >= 60,
      temporaryPrincess: Boolean(opts?.temporaryPrincess),
      married: Boolean(opts?.married),
    };

    const managed: ManagedSubject = {
      data,
      sprite,
      moving: false,
      fleeCooldownMs: 0,
      interrupt: null,
    };
    this.applyHpTint(managed);
    this.subjects.push(managed);
  }

  private removeSubject(managed: ManagedSubject): void {
    if (this.selectedId === managed.data.id) {
      this.select(null);
      this.scene.game.events.emit(KingdomEvents.SUBJECT_SELECTED, null);
    }
    managed.sprite.destroy();
    this.subjects = this.subjects.filter((s) => s !== managed);
  }

  private applyHpTint(managed: ManagedSubject): void {
    if (this.selectedId === managed.data.id) return;
    if (managed.data.sick) {
      managed.sprite.setTint(0xa0d080);
      return;
    }
    const ratio = managed.data.hp / managed.data.maxHp;
    if (ratio <= 0.35) managed.sprite.setTint(0xff6666);
    else managed.sprite.clearTint();
  }

  private clearSubjects(): void {
    for (const s of this.subjects) {
      s.sprite.destroy();
    }
    this.subjects = [];
    this.selectedId = null;
    this.marker?.setVisible(false);
  }

  private ensureMarker(): void {
    if (this.marker) return;
    this.marker = this.scene.add
      .circle(0, 0, 6, 0xf4efe4, 0.35)
      .setStrokeStyle(1, 0xd4a84b)
      .setDepth(19)
      .setVisible(false);
  }

  private syncActivities(): void {
    if (this.raidMode) return;
    for (const managed of this.subjects) {
      if (managed.interrupt) continue;
      const slot = slotAtHour(managed.data.role, this.clock.hour);
      managed.data.activity = slot.activity;
      managed.data.activityLabel = slot.label;
      managed.data.zone = slot.zone;
    }
  }

  private nudgeTowardSchedule(managed: ManagedSubject): void {
    if (!managed.sprite.active || managed.moving || managed.data.onWall) return;
    if (managed.interrupt) return;

    const slot = slotAtHour(managed.data.role, this.clock.hour);
    managed.data.activity = slot.activity;
    managed.data.activityLabel = slot.label;
    managed.data.zone = slot.zone;

    const home = this.buildings?.getHousePoint(managed.data.houseId) ?? null;
    const target = randomPointInZone(slot.zone, this.world, home);
    this.nudgeToward(managed.data.id, target.x, target.y, 40);
  }

  private toSnapshot(managed: ManagedSubject): SubjectSnapshot {
    return {
      id: managed.data.id,
      name: managed.data.name,
      role: managed.data.role,
      roleLabel: roleLabel(managed.data.role),
      genderLabel: genderLabel(managed.data.gender),
      activityLabel: managed.data.sick
        ? `${managed.data.activityLabel} (sick)`
        : managed.data.activityLabel,
      homeLabel: managed.data.houseId
        ? (this.buildings?.houseLabel(managed.data.houseId) ?? 'a house')
        : 'no house (orphaned)',
      scheduleSummary: scheduleSummary(managed.data.role),
      dayPhase: this.clock.phase,
      hour: this.clock.hour,
      hp: managed.data.hp,
      maxHp: managed.data.maxHp,
      onWall: managed.data.onWall,
      hunger: managed.data.hunger,
      sick: managed.data.sick,
      inspired: this.inspired,
      canTransformPeasant:
        managed.data.role === 'fairy_godmother' && this.fgmCanTransform,
      temporaryPrincess: managed.data.temporaryPrincess,
      married: managed.data.married,
      canCommandTroops: managed.data.role === 'general',
    };
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

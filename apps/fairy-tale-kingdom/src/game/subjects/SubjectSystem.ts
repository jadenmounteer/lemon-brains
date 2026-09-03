import Phaser from 'phaser';
import {
  appearanceTint,
  resolveSubjectTexture,
} from '../art/resolveSubjectTexture';
import type { FamilyAspirationView } from '../family/evaluateFamilyAspiration';
import {
  UNIT_HEIGHT,
  UNIT_WIDTH,
  celebrateCheerAnimKey,
  celebrateDanceAnimKey,
  celebrateVisualKey,
  idleAnimKey,
  isMilitaryRole,
  isRoyalRole,
  jesterJuggleAnimKey,
  roleSlashAnimKey,
  livesAtKeep,
  walkAnimKey,
  type Direction,
  type UnitRole,
} from '../art/assetManifest';
import type { SavedSubject } from '../../kingdom/LayoutRepository';
import {
  footprintAabb,
  KEEP_ID,
  ladderGroundApproach,
  type Aabb,
  type BuildingRecord,
} from '../buildings/buildingShared';
import {
  type BuildingSystem,
} from '../buildings/BuildingSystem';
import {
  buildingDoorApproach,
  interiorWaypoints,
  isInteriorBuilding,
  isOnWalkableInteriorNav,
  nearBuildingDoor,
  pointInsideFootprint,
  snapInteriorPoint,
} from '../path/interiorPathRouter';
import { hasInterior, isDwelling } from '../combat/stats';
import { CombatBalance, UNIT_MAX_HP } from '../combat/stats';
import { Phase12Balance } from '../economy/phase12Balance';
import {
  defectHoursNeeded,
  isHomelessHouseId,
} from '../family/familyHousing';
import {
  BUILDING_ROLE_CAPACITY,
  CASTLE_JOB_CAPACITY,
  CASTLE_JOBS,
  civilianJobForBuilding,
  isCastleJob,
  jobLabel,
  type CivilianJob,
} from '../jobs/capacities';
import {
  defaultRoomForActivity,
  roomForCastleJob,
  roomLabel,
  roomPoint,
} from '../keep/KeepLayout';
import type { BuildKind } from '../../marketplace/catalog';
import type { PathGrid } from '../path/PathGrid';
import type { MonsterSystem } from '../monsters/MonsterSystem';
import type { RaidSystem } from '../raids/RaidSystem';
import type { SecuritySystem } from '../security/SecuritySystem';
import { appendLifeLog as appendLifeLogEntry, backstoryFromLifeLog } from '../thoughts/lifeLog';
import type { EncampmentSystem } from '../war/EncampmentSystem';
import type { SiegeVfx } from '../siege/SiegeVfx';
import { DayClock } from './DayClock';
import { KingdomEvents } from './events';
import { genderLabel } from './gender';
import { pickName } from './names';
import { presenceLineFor } from './presenceLines';
import { roleLabel, scheduleSummary, slotAtHour } from './schedules';
import type {
  ActivityId,
  BodyCondition,
  BuildingResident,
  CareerTodoItem,
  InterruptKind,
  ScheduleSlot,
  Subject,
  SubjectInterrupt,
  SubjectSnapshot,
} from './types';
import { randomPointInZone, ringOffset, type Point, type WorldBounds } from './zones';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import type { ManagedSubject } from './managedSubject';
import { pickNearestInjured } from './physicianHeal';
import { SubjectRegistry } from './SubjectRegistry';
import { SubjectScheduler } from './SubjectScheduler';
import { SubjectSpawner } from './SubjectSpawner';
import {
  blocksMealInterrupt,
  shouldSkipFleeForCelebration,
} from './SubjectInterrupts';

export type { ManagedSubject } from './managedSubject';

const FESTIVAL_GUEST_CAP = 10;
const BALL_GUEST_CAP = 12;
const PATH_HOP_BUDGET = 1;

const FOOD_BIND_KINDS: BuildKind[] = ['field', 'bakery', 'dock', 'market', 'keep'];

const LOYALTY_TINTS = [0xc4a35a, 0x6a8caf, 0xc47a8a, 0x7a9e6a, 0xb08ad4];

/** Roles never invited to festivals/balls — they stay on duty. */
function isDutyMilitaryRole(role: UnitRole): boolean {
  return (
    role === 'soldier' ||
    role === 'archer' ||
    role === 'elite_guard' ||
    role === 'elite_archer' ||
    role === 'guard' ||
    role === 'knight' ||
    role === 'general' ||
    role === 'dungeon_keeper'
  );
}

type ScheduleSite = import('./SubjectScheduler').ScheduleSite;

const PRESENCE_ARRIVE_R = 34;
const PRESENCE_BLURB_MIN_MS = 9000;
const PRESENCE_BLURB_SPAN_MS = 6000;

/** Civic buildings patrols pause at while cycling their inspection route. */
const PATROL_INSPECTION_KINDS: BuildKind[] = [
  'market',
  'cathedral',
  'infirmary',
  'tavern',
  'bakery',
  'granary',
  'cemetery',
  'gallows',
  'stocks',
];

export class SubjectSystem {
  readonly clock = new DayClock();
  private readonly registry = new SubjectRegistry();
  private readonly scheduler: SubjectScheduler;
  private readonly spawner: SubjectSpawner;
  private selectedId: string | null = null;
  private marker: Phaser.GameObjects.Arc | null = null;
  private dayEmitAccumMs = 0;
  private healAccumMs = 0;
  private rescueAccumMs = 0;
  private presenceAccumMs = 0;
  private buildings: BuildingSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private security: SecuritySystem | null = null;
  private encampments: EncampmentSystem | null = null;
  private bubbles: SpeechBubbleSystem | null = null;
  private monsters: MonsterSystem | null = null;
  private vfx: SiegeVfx | null = null;
  private raidMode = false;
  private inspired = false;
  private fgmCanTransform = false;
  private onChanged: (() => void) | null = null;
  private onDeath:
    | ((id: string, houseId: string, name: string) => void)
    | null = null;
  private daysPlayed = 0;
  private patrolInspectionIdx = new Map<string, number>();
  private loyaltyHighlightKeepId: string | null = null;
  private familyEvaluator:
    | ((subjectId: string) => FamilyAspirationView | null)
    | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds
  ) {
    this.scheduler = new SubjectScheduler({
      world: this.world,
      getBuildings: () => this.buildings,
      getEncampments: () => this.encampments,
      getMonsters: () => this.monsters,
      getClockHour: () => this.clock.hour,
      getSubjects: () => this.registry.all,
      snapToWalkable: (x, y) => this.snapToWalkable(x, y),
      homePointFor: (houseId) => this.homePointFor(houseId),
      standPointAt: (x, y, groupKey, subjectId, opts) =>
        this.standPointAt(x, y, groupKey, subjectId, opts),
      sleepBedPoint: (managed) => this.sleepBedPoint(managed),
      getPatrolInspectionIdx: (id) => this.patrolInspectionIdx.get(id) ?? 0,
      setPatrolInspectionIdx: (id, idx) =>
        this.patrolInspectionIdx.set(id, idx),
    });
    this.spawner = new SubjectSpawner({
      scene: this.scene,
      world: this.world,
      registry: this.registry,
      getBuildings: () => this.buildings,
      getClockHour: () => this.clock.hour,
      getDaysPlayed: () => this.daysPlayed,
      snapToWalkable: (x, y) => this.snapToWalkable(x, y),
      homePointFor: (houseId) => this.homePointFor(houseId),
      assignLoyalty: (managed) => this.assignLoyalty(managed),
      bindWorkplace: (managed, role) => this.bindWorkplace(managed, role),
      applyHpTint: (managed) => this.applyHpTint(managed),
      applyBodyScale: (managed) => this.applyBodyScale(managed),
      nudgeTowardSchedule: (managed) => this.nudgeTowardSchedule(managed),
      roleAtBuildingCap: (role) => this.roleAtBuildingCap(role),
      openCastleJob: (exceptId, preferred) =>
        this.openCastleJob(exceptId, preferred),
      transformRole: (id, role, opts) => this.transformRole(id, role, opts),
      notifyChanged: () => this.notifyChanged(),
      linkRoyalSpouses: () => this.linkRoyalSpousesIfBothPresent(),
    });
  }

  setFamilyEvaluator(
    cb: (subjectId: string) => FamilyAspirationView | null
  ): void {
    this.familyEvaluator = cb;
  }

  seedStarterFamilies(houseIds: string[]): void {
    this.spawner.seedStarterFamilies(houseIds);
  }

  linkRoyalSpousesIfBothPresent(): void {
    const king = this.registry.all.find((s) => s.data.role === 'king');
    const queen = this.registry.all.find((s) => s.data.role === 'queen');
    if (!king || !queen) return;
    if (king.data.spouseId === queen.data.id && queen.data.spouseId === king.data.id) {
      return;
    }
    this.linkSpouses(king.data.id, queen.data.id);
  }

  setBuildings(buildings: BuildingSystem): void {
    this.buildings = buildings;
  }

  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
  }

  /** Wired after construction so peasants softly avoid pathing into an active cordon. */
  setSecurity(security: SecuritySystem): void {
    this.security = security;
  }

  /** Wired after construction — camp point/radius lookups for living camp garrisons. */
  setEncampments(encampments: EncampmentSystem): void {
    this.encampments = encampments;
  }

  setBubbles(bubbles: SpeechBubbleSystem): void {
    this.bubbles = bubbles;
  }

  setMonsters(monsters: MonsterSystem): void {
    this.monsters = monsters;
  }

  setVfx(vfx: SiegeVfx): void {
    this.vfx = vfx;
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  /** Fires with (subjectId, houseId, name) whenever a subject dies (slain, starved, or old age). */
  setOnDeath(cb: (id: string, houseId: string, name: string) => void): void {
    this.onDeath = cb;
  }

  setDaysPlayed(n: number): void {
    this.daysPlayed = Math.max(0, Math.floor(n));
  }

  getDaysPlayed(): number {
    return this.daysPlayed;
  }

  getClockHour(): number {
    return this.clock.hour;
  }

  setClockHour(hour: number): void {
    this.clock.setHour(hour);
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
      // Kick military off parties so they can defend
      for (const s of this.registry.all) {
        if (!isDutyMilitaryRole(s.data.role) && !isMilitaryRole(s.data.role)) {
          continue;
        }
        if (
          s.data.activity === 'ball' ||
          s.data.activity === 'festival' ||
          s.data.activity === 'joust' ||
          s.data.activity === 'feast'
        ) {
          const slot = slotAtHour(s.data.role, this.clock.hour, s.data.job);
          s.data.activity = slot.activity;
          s.data.activityLabel = slot.label;
          s.data.zone = slot.zone;
        }
      }
      // Don't leave the kingdom frozen in sleep poses when a raid starts at night
      for (const s of this.registry.all) {
        if (s.presenceAnim === 'sleep' || s.data.activity === 'sleep') {
          this.clearActivityAnim(s);
        }
      }
    }
    if (!active && was) {
      this.cancelInterrupts(['defend', 'flee']);
      for (const s of this.registry.all) {
        if (s.data.activity === 'flee' && s.interrupt?.kind === 'flee') {
          const slot = slotAtHour(s.data.role, this.clock.hour, s.data.job);
          s.data.activity = slot.activity;
          s.data.activityLabel = slot.label;
          s.data.zone = slot.zone;
        }
        if (s.data.onWall && isMilitaryRole(s.data.role)) {
          // Climb-down handled by existing wall APIs when schedules resume
        }
      }
    }
  }

  beginDefend(
    subjectId: string,
    x: number,
    y: number,
    label = 'Holding the perimeter'
  ): void {
    const managed = this.getById(subjectId);
    if (!managed || !isMilitaryRole(managed.data.role)) return;
    managed.interrupt = { kind: 'defend' };
    managed.data.activity = 'defend';
    managed.data.activityLabel = label;
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

  /**
   * Muster defense for any active raid (bandit/giant/goblin/siege).
   * Guards keep patrolling their fief; soldiers/archers hold perimeter/walls.
   */
  tickDefenseMuster(raidActive: boolean, raids?: RaidSystem | null): void {
    if (!raidActive || !this.buildings) {
      this.cancelInterrupts(['defend']);
      return;
    }
    let i = 0;
    for (const managed of this.registry.all) {
      if (!isMilitaryRole(managed.data.role)) continue;
      if (managed.data.sick) continue;
      if (managed.data.allegiance === 'camp') continue;
      if (managed.interrupt?.kind === 'flee') continue;
      if (managed.interrupt?.kind === 'abducted') continue;
      // Detachments / knight hunts / justice escorts keep marching.
      if (managed.interrupt?.kind === 'assault') continue;
      if (managed.interrupt?.kind === 'hunt_monster') continue;
      if (managed.interrupt?.kind === 'escort_captive') continue;
      if (managed.interrupt?.kind === 'execute') continue;
      if (managed.interrupt?.kind === 'imprisoned') continue;
      if (managed.interrupt?.kind === 'under_arrest') continue;
      if (managed.interrupt?.kind === 'in_stocks') continue;
      if (managed.interrupt?.kind === 'to_stocks') continue;

      const keepId =
        managed.data.loyaltyKeepId ??
        this.buildings.nearestKeepId(managed.sprite.x, managed.sprite.y) ??
        KEEP_ID;
      const keepPt =
        this.buildings.getKeepTargetPoint(keepId) ??
        this.buildings.getActiveKeepPoint();
      const threat = raids?.nearestRaider(keepPt.x, keepPt.y, 900) ?? null;
      const threatPt = threat
        ? { x: threat.sprite.x, y: threat.sprite.y }
        : null;

      const role = managed.data.role;
      const isGuardPatrol =
        role === 'guard' || role === 'dungeon_keeper';

      if (isGuardPatrol) {
        // Guards keep walking roads in their fief, biased toward the threat
        if (managed.interrupt?.kind === 'defend') {
          this.clearInterrupt(managed.data.id);
        }
        if (!managed.moving && Math.random() < 0.08) {
          const fallback = this.buildings.keepTerritoryPoint(keepId);
          let dest = this.pickPatrolTarget(managed, fallback);
          if (threatPt && Math.random() < 0.55) {
            dest = {
              x: (dest.x + threatPt.x) / 2,
              y: (dest.y + threatPt.y) / 2,
            };
          }
          managed.data.activity = 'patrol';
          managed.data.activityLabel = 'Patrolling the raid roads';
          this.nudgeToward(managed.data.id, dest.x, dest.y, 50);
        }
        continue;
      }

      const muster = this.buildings.defenseMusterPointForKeep(keepId, threatPt);
      const ox = ((i % 5) - 2) * 14;
      const oy = Math.floor(i / 5) * 12;
      i += 1;
      const tx = muster.x + ox;
      const ty = muster.y + oy;
      const isArcher =
        role === 'archer' || role === 'elite_archer';
      const label = isArcher
        ? 'Archers on the wall'
        : 'Holding the perimeter';

      if (isArcher && !managed.data.onWall && Math.random() < 0.12) {
        this.tryClimbNearestLadder(managed.data.id);
      }

      if (managed.data.onWall) {
        managed.data.activityLabel = label;
        continue;
      }

      if (managed.interrupt?.kind !== 'defend') {
        this.beginDefend(managed.data.id, tx, ty, label);
      } else if (!managed.moving) {
        const d = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          tx,
          ty
        );
        if (d > 40) {
          managed.data.activityLabel = label;
          this.nudgeToward(managed.data.id, tx, ty, 55);
        }
      }
    }
  }

  hasInterrupt(id: string): boolean {
    return this.registry.hasInterrupt(id);
  }

  withInterrupt(kind: InterruptKind): ManagedSubject[] {
    return this.registry.withInterrupt(kind);
  }

  listInterrupts(kind: InterruptKind): SubjectInterrupt[] {
    return this.registry.listInterrupts(kind);
  }

  clearInterrupt(id: string): void {
    const managed = this.getById(id);
    if (!managed?.interrupt) return;
    managed.interrupt = null;
  }

  /** Roles a general may send on detachment (not knights/generals themselves). */
  static isDetachmentRole(role: UnitRole): boolean {
    return (
      role === 'soldier' ||
      role === 'guard' ||
      role === 'archer' ||
      role === 'elite_guard' ||
      role === 'elite_archer'
    );
  }

  /** Free troops a general can currently assign (off-wall, idle, healthy). */
  countAssignableDetachment(): number {
    return this.listAssignableDetachment().length;
  }

  listAssignableDetachment(): ManagedSubject[] {
    return this.registry.all.filter(
      (s) =>
        !s.data.sick &&
        !s.interrupt &&
        !s.data.onWall &&
        s.data.allegiance !== 'camp' &&
        SubjectSystem.isDetachmentRole(s.data.role)
    );
  }

  /** Living realm general, or null. */
  findLivingGeneral(): ManagedSubject | null {
    for (const s of this.registry.all) {
      if (
        s.data.role === 'general' &&
        s.sprite.active &&
        !s.data.sick &&
        s.data.allegiance !== 'camp'
      ) {
        return s;
      }
    }
    return null;
  }

  /** Nearest free knight, or null. */
  findNearestKnight(x: number, y: number): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const s of this.registry.all) {
      if (
        s.data.role !== 'knight' ||
        !s.sprite.active ||
        s.data.sick ||
        s.data.allegiance === 'camp' ||
        s.interrupt
      ) {
        continue;
      }
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /**
   * Send a knight to hunt a specific monster. Returns false if invalid.
   */
  assignKnightHunt(knightId: string, monsterId: string): boolean {
    const knight = this.getById(knightId);
    if (
      !knight ||
      knight.data.role !== 'knight' ||
      !knight.sprite.active ||
      knight.data.sick
    ) {
      return false;
    }
    knight.interrupt = { kind: 'hunt_monster', targetId: monsterId };
    knight.data.activity = 'hunt';
    knight.data.activityLabel = 'Riding out on a monster hunt';
    return true;
  }

  /**
   * Assign up to `count` free soldiers/guards/archers to assault a target.
   * targetId is a camp id or `monster:<id>`. Requires a living generalId.
   */
  assignAssault(targetId: string, count: number, generalId: string): number {
    const general = this.getById(generalId);
    if (!general || general.data.role !== 'general' || !general.sprite.active) {
      return 0;
    }
    const commandable = this.listAssignableDetachment();
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
    for (const s of this.registry.all) {
      if (s.interrupt?.kind === 'assault' && s.interrupt.targetId === targetId) {
        s.interrupt = null;
      }
    }
  }

  cancelInterrupts(kinds: InterruptKind[]): void {
    for (const s of this.registry.all) {
      if (s.interrupt && kinds.includes(s.interrupt.kind)) {
        s.interrupt = null;
      }
    }
  }

  clearFleeInterrupts(): void {
    for (const s of this.registry.all) {
      if (s.interrupt?.kind === 'flee') {
        s.interrupt = null;
      }
    }
  }

  /** Free healthy peasant for repair/harvest (no interrupt, not on wall). */
  closestFreePeasant(x: number, y: number): string | null {
    let best: ManagedSubject | null = null;
    let bestD = Infinity;
    for (const s of this.registry.all) {
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

  /** Fisherman boards a boat at a dock and sails out — interrupt lasts for the whole trip. */
  beginFish(subjectId: string, dockId: string): void {
    const managed = this.getById(subjectId);
    if (!managed || managed.data.sick) return;
    managed.interrupt = { kind: 'fish', targetId: dockId };
    managed.data.activity = 'fish';
    managed.data.activityLabel = 'Sailing out to fish';
  }

  /** Guard signs on as permanent crew for a warship until it sinks. */
  beginCrew(subjectId: string, warshipId: string): void {
    const managed = this.getById(subjectId);
    if (!managed || managed.data.sick) return;
    managed.interrupt = { kind: 'crew', targetId: warshipId };
    managed.data.activity = 'crew';
    managed.data.activityLabel = 'Crewing a warship';
  }

  /** Peasants/guards free to board a boat: right role, no interrupt, healthy, not on the wall. */
  listFreeForNaval(role: UnitRole): ManagedSubject[] {
    return this.registry.all.filter(
      (s) =>
        s.data.role === role &&
        !s.interrupt &&
        !s.data.onWall &&
        !s.data.sick &&
        s.sprite.active
    );
  }

  listFreeForChat(): ManagedSubject[] {
    return this.registry.all.filter(
      (s) => !s.interrupt && !s.data.onWall && !s.moving && !s.data.sick
    );
  }

  listManaged(): ManagedSubject[] {
    return this.registry.listManaged();
  }

  notifyChanged(): void {
    this.onChanged?.();
  }

  spawnChild(opts: {
    name: string;
    houseId: string;
    gender: 'male' | 'female';
    motherId?: string;
    fatherId?: string;
  }): string | null {
    if (!this.buildings) return null;
    const id = `subject-${this.registry.nextId++}`;
    this.createSubject('child', opts.houseId, id, opts.name, {
      gender: opts.gender,
      ageYears: 1,
      motherId: opts.motherId,
      fatherId: opts.fatherId,
      lifeLog: appendLifeLogEntry(
        [],
        this.daysPlayed,
        opts.fatherId || opts.motherId
          ? `Born to family in the kingdom`
          : 'Born in the kingdom',
        'birth'
      ),
    });
    const child = this.getById(id);
    if (child) {
      child.data.motherId = opts.motherId;
      child.data.fatherId = opts.fatherId;
    }
    this.onChanged?.();
    return id;
  }

  linkSpouses(aId: string, bId: string): void {
    const a = this.getById(aId);
    const b = this.getById(bId);
    if (!a || !b) return;
    a.data.married = true;
    b.data.married = true;
    a.data.spouseId = bId;
    b.data.spouseId = aId;
    this.onChanged?.();
  }

  /** Miserable peasants/children walk off to join (or found) a fringe camp. */
  tryDefectMiserable(): void {
    for (const s of [...this.registry.all]) {
      if (s.data.role === 'witch' || isMilitaryRole(s.data.role)) continue;
      if (s.data.allegiance === 'camp') continue;
      if (s.interrupt?.kind === 'defect') continue;
      const hoursNeeded = defectHoursNeeded(this.isHomeless(s), {
        housed: Phase12Balance.defectHoursNeeded,
        homeless: Phase12Balance.homelessDefectHoursNeeded,
      });
      if ((s.data.lowHappyHours ?? 0) < hoursNeeded) {
        continue;
      }
      if (s.data.role !== 'peasant' && s.data.role !== 'child') continue;
      this.beginDefect(s);
      break;
    }
  }

  private beginDefect(managed: ManagedSubject): void {
    if (!this.encampments) return;
    const camp =
      this.encampments.nearestCampWithCapacity(
        managed.sprite.x,
        managed.sprite.y,
        ['bandit', 'thief', 'gypsy']
      ) ?? this.encampments.createFringeCamp('bandit');
    if (!camp) return;
    managed.interrupt = {
      kind: 'defect',
      campId: camp.id,
      targetX: camp.x,
      targetY: camp.y,
    };
    managed.data.activity = 'flee';
    managed.data.activityLabel = 'Slipping away from the kingdom';
    this.appendLifeLog(
      managed.data.id,
      'Slipped away from the kingdom in misery',
      'defect'
    );
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${managed.data.name} has gone missing...`,
    });
    this.onChanged?.();
  }

  /** Nudges every defecting subject toward its target camp; completes on arrival. */
  private tickDefectWalks(): void {
    for (const managed of this.registry.all) {
      if (managed.interrupt?.kind !== 'defect') continue;
      const { campId, targetX, targetY } = managed.interrupt;
      if (!campId || targetX == null || targetY == null) {
        managed.interrupt = null;
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        targetX,
        targetY
      );
      if (dist < 14) {
        this.completeDefect(managed, campId);
        continue;
      }
      if (!managed.moving) {
        this.nudgeToward(managed.data.id, targetX, targetY, 45);
      }
    }
  }

  /** Arrived at the camp — transforms into a living camp garrison member. */
  private completeDefect(managed: ManagedSubject, campId: string): void {
    managed.interrupt = null;
    const kind = this.encampments?.getCampKind(campId);
    if (kind !== 'bandit' && kind !== 'thief' && kind !== 'gypsy') return;
    this.transformRole(managed.data.id, kind);
    managed.data.allegiance = 'camp';
    managed.data.campId = campId;
    managed.data.houseId = `camp:${campId}`;
    this.appendLifeLog(
      managed.data.id,
      `Joined a ${roleLabel(kind)} camp`,
      'defect'
    );
    this.encampments?.registerDefector(campId, managed.data.id, managed.data.name);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${managed.data.name} has defected to join a camp!`,
    });
    this.onChanged?.();
  }

  spawnWitchNear(x: number, y: number): string | null {
    const id = `subject-${this.registry.nextId++}`;
    const name = pickName(2000 + this.registry.nextId);
    this.createSubject('witch', 'coven', id, name, {
      gender: 'female',
      ageYears: 40,
      backstory: 'A stranger from the wild wood, nursing old grudges.',
      lifeLog: appendLifeLogEntry(
        [],
        this.daysPlayed,
        'Emerged from a dark coven',
        'spawn'
      ),
    });
    const w = this.getById(id);
    if (!w) return null;
    w.sprite.setPosition(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20));
    w.data.backstory = backstoryFromLifeLog(w.data.lifeLog ?? []);
    this.onChanged?.();
    return id;
  }

  /** Necromancer emerges near the cemetery at night (spooky layer). */
  spawnNecromancerNear(x: number, y: number): string | null {
    const id = `subject-${this.registry.nextId++}`;
    const name = pickName(3000 + this.registry.nextId);
    this.createSubject('necromancer', 'cemetery', id, name, {
      gender: 'male',
      ageYears: 55,
      backstory: 'A grave-robber who traded his soul for dark rites.',
      lifeLog: appendLifeLogEntry(
        [],
        this.daysPlayed,
        'Emerged from the cemetery shadows',
        'spawn'
      ),
    });
    const n = this.getById(id);
    if (!n) return null;
    n.sprite.setPosition(
      x + Phaser.Math.Between(-16, 16),
      y + Phaser.Math.Between(-16, 16)
    );
    n.data.backstory = backstoryFromLifeLog(n.data.lifeLog ?? []);
    this.onChanged?.();
    return id;
  }

  /** Spawns (or restores) a living garrison member wandering the given camp's sphere. */
  spawnCampMember(
    campId: string,
    role: 'bandit' | 'thief' | 'gypsy',
    x: number,
    y: number,
    opts?: { id?: string; name?: string }
  ): string {
    const id = opts?.id ?? `subject-${this.registry.nextId++}`;
    const name = opts?.name ?? pickName(Math.floor(Math.random() * 1_000_000));
    this.createSubject(role, `camp:${campId}`, id, name, {
      campId,
      allegiance: 'camp',
      ageYears: 20 + Math.floor(Math.random() * 30),
    });
    const managed = this.getById(id);
    if (managed) {
      const pos = this.snapToWalkable(
        x + Phaser.Math.Between(-16, 16),
        y + Phaser.Math.Between(-16, 16)
      );
      managed.sprite.setPosition(pos.x, pos.y);
      managed.sprite.setDepth(20 + managed.sprite.y * 0.01);
    }
    this.onChanged?.();
    return id;
  }

  /** Hide a camp member's sprite while it's away on a raid; unhide it once home. */
  setCampMemberAway(id: string, away: boolean): void {
    const managed = this.getById(id);
    if (!managed) return;
    this.scene.tweens.killTweensOf(managed.sprite);
    managed.moving = false;
    managed.sprite.setVisible(!away);
    managed.sprite.setActive(!away);
  }

  /** Permanently removes a camp garrison member (lost on a raid, arrested, etc). */
  removeCampMember(id: string): void {
    const managed = this.getById(id);
    if (!managed) return;
    this.removeSubject(managed);
  }

  /** Nearest hostile living camp member (not mid-defection) for military to engage. */
  nearestCampHostile(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.registry.all) {
      if (s.data.allegiance !== 'camp') continue;
      if (!s.sprite.active) continue;
      if (s.interrupt?.kind === 'defect') continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  hasRole(role: UnitRole): boolean {
    return this.registry.hasRole(role);
  }

  countRole(role: UnitRole): number {
    return this.registry.countRole(role);
  }

  nearestPeasant(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.registry.all) {
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
    for (const s of this.registry.all) {
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
    for (const s of this.registry.all) {
      if (!isMilitaryRole(s.data.role) || s.data.sick) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Nearest free guard/elite guard who can escort a prisoner (not the target). */
  nearestArrestingGuard(
    x: number,
    y: number,
    exceptId?: string
  ): ManagedSubject | null {
    const busy = new Set(['escort_captive', 'execute', 'abducted', 'defect']);
    let best: ManagedSubject | null = null;
    let bestD = Infinity;
    for (const s of this.registry.all) {
      if (s.data.id === exceptId) continue;
      if (s.data.role !== 'guard' && s.data.role !== 'elite_guard') continue;
      if (s.data.sick || !s.sprite.active) continue;
      if (s.data.onWall) continue;
      if (s.interrupt && busy.has(s.interrupt.kind)) continue;
      if (s.interrupt?.kind === 'imprisoned' || s.interrupt?.kind === 'under_arrest') {
        continue;
      }
      if (s.interrupt?.kind === 'in_stocks' || s.interrupt?.kind === 'to_stocks') {
        continue;
      }
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  firstByRole(role: UnitRole): ManagedSubject | null {
    return this.registry.all.find((s) => s.data.role === role) ?? null;
  }

  unmarriedPrincess(): ManagedSubject | null {
    return (
      this.registry.all.find(
        (s) =>
          s.data.role === 'princess' &&
          (!s.data.married || s.data.temporaryPrincess)
      ) ?? null
    );
  }

  revertUnmarriedBallPrincesses(): void {
    for (const s of this.registry.all) {
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
    const wasPeasant = managed.data.role === 'peasant';
    managed.data.role = role;
    managed.data.maxHp = UNIT_MAX_HP[role];
    managed.data.hp = Math.min(managed.data.hp, managed.data.maxHp);
    if (opts?.temporaryPrincess !== undefined) {
      managed.data.temporaryPrincess = Boolean(opts.temporaryPrincess);
    }
    if (opts?.married !== undefined) managed.data.married = opts.married;
    if (role === 'princess' && opts?.temporaryPrincess) {
      managed.data.gender = 'female';
    }
    if (wasPeasant && role !== 'peasant') {
      managed.data.workplaceId = undefined;
      managed.data.job = undefined;
    }
    const texKey = textureKeyForSubject(managed.data);
    managed.sprite.setTexture(texKey, 0);
    managed.sprite.play(idleAnimKey(texKey));
    managed.interrupt = null;
    managed.data.lifeLog = appendLifeLogEntry(
      managed.data.lifeLog,
      this.daysPlayed,
      `Became a ${roleLabel(role)}`,
      'role'
    );
    this.applyBodyScale(managed);
    this.applyHpTint(managed);
    this.onChanged?.();
    return true;
  }

  /**
   * Gather guests in the keep courtyard (walkable land hard against the keep),
   * not out by the outer wall where pathing used to dump them.
   */
  markBallGather(): Point {
    const keep = this.buildings?.getActiveKeepPoint?.() ?? {
      x: this.world.width / 2,
      y: this.world.height / 2,
    };
    const court = this.findBallCourtyard(keep);
    const guests = this.registry.all
      .filter(
        (s) =>
          s.data.allegiance !== 'camp' &&
          !isDutyMilitaryRole(s.data.role) &&
          (livesAtKeep(s.data.role) ||
            s.data.role === 'peasant' ||
            s.data.role === 'jester' ||
            s.data.role === 'fairy_godmother' ||
            s.data.role === 'child')
      )
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(
            a.sprite.x,
            a.sprite.y,
            court.x,
            court.y
          ) -
          Phaser.Math.Distance.Between(
            b.sprite.x,
            b.sprite.y,
            court.x,
            court.y
          )
      )
      .slice(0, BALL_GUEST_CAP);
    guests.forEach((s, i) => {
      s.data.activity = 'ball';
      s.data.activityLabel = 'Attending the royal ball';
      s.data.zone = 'keep';
      const off = ringOffset(i, guests.length, 34);
      const dest = this.snapToWalkable(court.x + off.x, court.y + off.y);
      this.nudgeToward(s.data.id, dest.x, dest.y, 45);
    });
    return court;
  }

  /** Open ground hugging the keep — prefers the southern bailey. */
  private findBallCourtyard(keep: Point): Point {
    const tries: [number, number][] = [
      [0, 36],
      [0, 28],
      [0, 44],
      [-18, 32],
      [18, 32],
      [-28, 24],
      [28, 24],
      [0, 20],
      [0, -24],
      [-24, -16],
      [24, -16],
    ];
    for (const [dx, dy] of tries) {
      const x = keep.x + dx;
      const y = keep.y + dy;
      if (this.pathGrid && this.pathGrid.isWorldBlocked(x, y)) continue;
      // Prefer a spot that can path from just outside the keep footprint
      if (this.pathGrid) {
        const path = this.pathGrid.findPath(
          { x: keep.x, y: keep.y + 8 },
          { x, y }
        );
        if (!path || path.length < 1) continue;
      }
      return { x, y };
    }
    return this.snapToWalkable(keep.x, keep.y + 36);
  }

  markFestivalGather(venue?: { x: number; y: number }): void {
    const anchor = venue ??
      this.buildings?.getActiveKeepPoint?.() ?? {
        x: this.world.width / 2,
        y: this.world.height / 2,
      };
    const guests = this.registry.all
      .filter(
        (s) =>
          s.data.allegiance !== 'camp' &&
          !isDutyMilitaryRole(s.data.role) &&
          !isMilitaryRole(s.data.role) &&
          (s.data.role === 'peasant' ||
            s.data.role === 'child' ||
            s.data.role === 'jester' ||
            s.data.role === 'fairy_godmother' ||
            livesAtKeep(s.data.role) ||
            s.data.role === 'physician' ||
            s.data.role === 'bishop' ||
            s.data.role === 'executioner')
      )
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(
            a.sprite.x,
            a.sprite.y,
            anchor.x,
            anchor.y
          ) -
          Phaser.Math.Distance.Between(
            b.sprite.x,
            b.sprite.y,
            anchor.x,
            anchor.y
          )
      )
      .slice(0, FESTIVAL_GUEST_CAP);
    guests.forEach((s, i) => {
      s.data.activity = 'festival';
      s.data.activityLabel = 'Celebrating at the festival';
      s.data.zone = 'keep';
      const off = ringOffset(i, guests.length, 72);
      const dest = this.snapToWalkable(anchor.x + off.x, anchor.y + off.y);
      this.nudgeToward(s.data.id, dest.x, dest.y, 40);
    });
  }

  /** Drop temporary gather/flee labels so schedules resume. */
  clearGatherActivities(
    kinds: Array<'ball' | 'festival' | 'flee' | 'joust'> = [
      'ball',
      'festival',
      'flee',
      'joust',
    ]
  ): void {
    const set = new Set(kinds);
    for (const s of this.registry.all) {
      if (!set.has(s.data.activity as 'ball' | 'festival' | 'flee' | 'joust')) {
        continue;
      }
      const slot = slotAtHour(s.data.role, this.clock.hour, s.data.job);
      s.data.activity = slot.activity;
      s.data.activityLabel = slot.label;
      s.data.zone = slot.zone;
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
    ids.forEach((id, i) => {
      const m = this.getById(id);
      if (!m) return;
      m.interrupt = {
        kind: 'wedding',
        partnerId: princessId,
        remainingMs: durationMs,
      };
      m.data.activity = 'wedding';
      m.data.activityLabel = 'At a royal wedding';
      const off = ringOffset(i, ids.length, 22);
      const dest = this.snapToWalkable(cathedral.x + off.x, cathedral.y + off.y);
      this.nudgeToward(id, dest.x, dest.y, 50);
    });
    this.scene.time.delayedCall(durationMs, () => {
      const prince = this.getById(princeId);
      const princess = this.getById(princessId);
      if (prince) {
        prince.data.married = true;
      }
      if (princess && princess.data.role === 'princess') {
        princess.data.temporaryPrincess = false;
        princess.data.married = true;
        if (prince) {
          princess.data.houseId = prince.data.houseId;
          prince.data.spouseId = princess.data.id;
          princess.data.spouseId = prince.data.id;
        }
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${princess.data.name} remains a Princess forever!`,
        });
        this.scene.game.events.emit(KingdomEvents.KINGDOM_EVENT, {
          id: 'challenge-royal-wedding',
          severity: 'joy',
          title: 'A royal wedding!',
          detail: `${princess.data.name} and ${prince?.data.name ?? 'the prince'} are wed`,
          ttlMs: 12000,
        });
      }
      for (const id of ids) this.clearInterrupt(id);
      this.onChanged?.();
    });
  }

  /** Living kingdom subjects that use the food stores (not undead / camp hostiles). */
  needsMeals(role: UnitRole): boolean {
    return (
      role !== 'zombie' &&
      role !== 'vampire_wife' &&
      role !== 'witch' &&
      role !== 'necromancer'
    );
  }

  beginEat(subjectId: string): void {
    const managed = this.getById(subjectId);
    if (!managed || managed.interrupt) return;
    if (blocksMealInterrupt(managed.data.activity)) return;
    if (managed.data.allegiance === 'camp') return;
    if (!this.needsMeals(managed.data.role)) return;
    managed.interrupt = {
      kind: 'eat',
      remainingMs: Phase12Balance.eatDurationMs,
    };
    managed.data.activity = 'eat';
    managed.data.activityLabel = managed.data.onWall
      ? 'Eating on the wall'
      : 'Having a meal';

    // Cooks on duty slightly improve supper mood for nearby diners
    const cooksOnDuty = this.registry.all.filter(
      (s) =>
        s.data.job === 'cook' &&
        (s.data.activity === 'cook' ||
          s.data.activity === 'knead' ||
          s.data.activity === 'serve')
    ).length;
    if (cooksOnDuty > 0) {
      managed.data.happiness = Math.min(
        100,
        managed.data.happiness + Phase12Balance.cookMealHappiness
      );
    }

    // Wall units eat in place; others stroll to banquet / home / barracks.
    if (managed.data.onWall) return;
    if (livesAtKeep(managed.data.role) || isCastleJob(managed.data.job)) {
      const keepId =
        managed.data.loyaltyKeepId ??
        managed.data.workplaceId ??
        KEEP_ID;
      const keep =
        this.buildings?.getById(keepId) ?? this.buildings?.getById(KEEP_ID);
      if (keep) {
        const pt = roomPoint(keep, 'banquet', managed.data.id);
        managed.data.activityLabel = 'Dining in the banquet hall';
        this.nudgeToward(subjectId, pt.x, pt.y, 50);
        return;
      }
    }
    if (isMilitaryRole(managed.data.role)) {
      const barracks = this.buildings?.list().find((b) => b.kind === 'barracks' && b.hp > 0);
      const home = this.homePointFor(managed.data.houseId);
      if (barracks && managed.data.workplaceId === barracks.id) {
        this.nudgeToward(subjectId, barracks.x, barracks.y, 50);
        return;
      }
      if (home) {
        this.nudgeToward(subjectId, home.x, home.y, 50);
        return;
      }
    }
    const home = this.homePointFor(managed.data.houseId);
    if (home) {
      managed.data.activityLabel = 'Eating at home';
      this.nudgeToward(subjectId, home.x, home.y, 50);
      return;
    }
    const tavern = this.buildings
      ?.list()
      .find((b) => b.kind === 'tavern' && b.hp > 0);
    if (tavern) {
      this.nudgeToward(subjectId, tavern.x, tavern.y, 50);
    }
  }

  /** Resume the clock schedule after an interrupt (meals, parties, etc.). */
  resyncFromSchedule(subjectId: string): void {
    const managed = this.getById(subjectId);
    if (!managed) return;
    const slot = slotAtHour(managed.data.role, this.clock.hour, managed.data.job);
    managed.data.activity = slot.activity;
    managed.data.activityLabel = slot.label;
    managed.data.zone = slot.zone;
  }

  assignLoyalty(managed: ManagedSubject): void {
    if (!this.buildings || managed.data.allegiance === 'camp') {
      managed.data.loyaltyKeepId = null;
      return;
    }
    if (livesAtKeep(managed.data.role) && managed.data.houseId) {
      const houseKeep = this.buildings.getById(managed.data.houseId);
      if (houseKeep?.kind === 'keep') {
        managed.data.loyaltyKeepId = houseKeep.id;
        return;
      }
      if (managed.data.houseId === KEEP_ID) {
        managed.data.loyaltyKeepId = KEEP_ID;
        return;
      }
    }
    managed.data.loyaltyKeepId = this.buildings.nearestKeepId(
      managed.sprite.x,
      managed.sprite.y
    );
  }

  reassignLoyalties(): void {
    for (const s of this.registry.all) this.assignLoyalty(s);
    this.applyLoyaltyHighlight();
  }

  setLoyaltyHighlight(keepId: string | null): void {
    this.loyaltyHighlightKeepId = keepId;
    this.applyLoyaltyHighlight();
  }

  private applyLoyaltyHighlight(): void {
    const keepId = this.loyaltyHighlightKeepId;
    const tint = keepId
      ? LOYALTY_TINTS[
          Math.abs(keepId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) %
            LOYALTY_TINTS.length
        ]!
      : null;
    for (const s of this.registry.all) {
      if (s.data.id === this.selectedId) {
        s.sprite.setTint(0xfff0c0);
        continue;
      }
      if (keepId && tint && s.data.loyaltyKeepId === keepId) {
        s.sprite.setTint(tint);
      } else {
        s.sprite.clearTint();
        this.applyHpTint(s);
      }
    }
  }

  beginAbducted(subjectId: string, giantRaiderId?: string): void {
    const managed = this.getById(subjectId);
    if (!managed) return;
    managed.interrupt = { kind: 'abducted', targetId: giantRaiderId };
    managed.data.activity = 'flee';
    managed.data.activityLabel = 'Carried off by a giant!';
    managed.sprite.setVisible(false);
    managed.moving = false;
  }

  freeAbducted(subjectId: string): void {
    const managed = this.getById(subjectId);
    if (!managed) return;
    managed.interrupt = null;
    managed.sprite.setVisible(true);
    this.resyncFromSchedule(subjectId);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${managed.data.name} was freed from the giant!`,
    });
  }

  devourSubject(subjectId: string): void {
    const managed = this.getById(subjectId);
    if (!managed) return;
    const { id, houseId, name } = managed.data;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `A giant carried off ${name}!`,
    });
    this.removeSubject(managed);
    this.onDeath?.(id, houseId, name);
  }

  healNearestInjured(physicianId: string): boolean {
    const doc = this.getById(physicianId);
    if (!doc || doc.data.role !== 'physician') return false;

    const bestId = pickNearestInjured(
      physicianId,
      { x: doc.sprite.x, y: doc.sprite.y },
      this.registry.all.map((s) => ({
        id: s.data.id,
        name: s.data.name,
        x: s.sprite.x,
        y: s.sprite.y,
        hp: s.data.hp,
        maxHp: s.data.maxHp,
        onWall: s.data.onWall,
        allegiance: s.data.allegiance,
        hidden:
          !s.sprite.visible || s.interrupt?.kind === 'abducted',
      }))
    );
    if (!bestId) {
      doc.data.healTargetId = null;
      return false;
    }
    const best = this.getById(bestId.id);
    if (!best) {
      doc.data.healTargetId = null;
      return false;
    }

    const dest = this.healApproachPoint(best);
    const d = Phaser.Math.Distance.Between(
      doc.sprite.x,
      doc.sprite.y,
      best.sprite.x,
      best.sprite.y
    );
    if (d > CombatBalance.physicianHealRange) {
      this.nudgeToward(physicianId, dest.x, dest.y, 45);
      doc.data.activity = 'heal';
      doc.data.healTargetId = best.data.id;
      doc.data.activityLabel = `Seeking ${best.data.name}`;
      return false;
    }

    best.data.hp = Math.min(
      best.data.maxHp,
      best.data.hp + CombatBalance.physicianHealHp
    );
    this.applyHpTint(best);
    doc.data.activity = 'heal';
    doc.data.activityLabel = `Bandaging ${best.data.name}`;
    if (best.data.hp >= best.data.maxHp) {
      doc.data.healTargetId = null;
    } else {
      doc.data.healTargetId = best.data.id;
    }
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${doc.data.name} tended ${best.data.name}'s wounds`,
    });
    this.onChanged?.();
    return true;
  }

  private healApproachPoint(patient: ManagedSubject): Point {
    if (!patient.data.onWall || !this.buildings) {
      return { x: patient.sprite.x, y: patient.sprite.y };
    }
    const ladder = this.buildings.ladderNear(
      patient.sprite.x,
      patient.sprite.y,
      80
    );
    if (ladder) {
      const wall = this.buildings.wallForLadder(ladder);
      if (wall && ladder.ladderFacing) {
        return ladderGroundApproach(wall.x, wall.y, ladder.ladderFacing);
      }
    }
    const corner = this.buildings.cornerClimbNear(
      patient.sprite.x,
      patient.sprite.y,
      80
    );
    if (corner) return { x: corner.groundX, y: corner.groundY };
    return { x: patient.sprite.x, y: patient.sprite.y + 16 };
  }

  isSeekingWounded(managed: ManagedSubject): boolean {
    return (
      managed.data.role === 'physician' && Boolean(managed.data.healTargetId)
    );
  }

  /** @deprecated Sickness removed — physicians heal injuries via healNearestInjured. */
  healNearestSick(physicianId: string): boolean {
    return this.healNearestInjured(physicianId);
  }

  applyStarvation(amount: number): void {
    this.raiseHungerAll(amount);
  }

  private dieHungerThreshold(): number {
    return Phase12Balance.dieAtHunger;
  }

  /** Hunger level that starts souring mood (sickness is disabled). */
  private hungerUnhappyThreshold(): number {
    return Phase12Balance.sickAtHunger;
  }

  raiseHungerAll(amount: number): void {
    const dieAt = this.dieHungerThreshold();
    for (const s of [...this.registry.all]) {
      if (s.data.allegiance === 'camp') continue;
      if (!this.needsMeals(s.data.role)) continue;
      s.data.hunger = Math.min(100, s.data.hunger + amount);
      // Sickness disabled for now — hunger still rises and can starve.
      if (s.data.sick) s.data.sick = false;
      this.applyHpTint(s);
      if (s.data.hunger >= dieAt) {
        const name = s.data.name;
        const houseId = s.data.houseId;
        const id = s.data.id;
        this.removeSubject(s);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${name} starved`,
        });
        this.onDeath?.(id, houseId, name);
        this.onChanged?.();
      }
    }
  }

  recoverHunger(amount: number): void {
    for (const s of this.registry.all) {
      s.data.hunger = Math.max(0, s.data.hunger - amount);
      if (s.data.sick) s.data.sick = false;
      this.applyHpTint(s);
    }
  }

  recoverHungerFor(id: string, amount: number): void {
    const managed = this.getById(id);
    if (!managed) return;
    managed.data.hunger = Math.max(0, managed.data.hunger - amount);
    if (managed.data.sick) managed.data.sick = false;
    this.applyHpTint(managed);
  }

  adjustHappiness(id: string, delta: number): void {
    const managed = this.getById(id);
    if (!managed) return;
    managed.data.happiness = Phaser.Math.Clamp(
      managed.data.happiness + delta,
      0,
      100
    );
  }

  tickHappiness(): void {
    const hungryAt = this.hungerUnhappyThreshold();
    for (const s of this.registry.all) {
      if (s.data.allegiance === 'camp') continue;
      if (s.data.hunger >= hungryAt) {
        s.data.happiness = Phaser.Math.Clamp(s.data.happiness - 1, 0, 100);
      }
      if (this.isHomeless(s)) {
        s.data.happiness = Phaser.Math.Clamp(
          s.data.happiness - Phase12Balance.homelessHappinessDrain,
          0,
          100
        );
      }
      if (s.data.happiness < Phase12Balance.defectHappinessThreshold) {
        s.data.lowHappyHours = (s.data.lowHappyHours ?? 0) + 1;
      } else {
        s.data.lowHappyHours = 0;
      }
    }
  }

  appendLifeLog(id: string, text: string, kind?: string): void {
    const managed = this.getById(id);
    if (!managed) return;
    managed.data.lifeLog = appendLifeLogEntry(
      managed.data.lifeLog,
      this.daysPlayed,
      text,
      kind
    );
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

  despawnSubject(id: string): void {
    const managed = this.getById(id);
    if (managed) this.removeSubject(managed);
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
    a.sprite.play(idleAnimKey(textureKeyForSubject(a.data)));
    b.sprite.play(idleAnimKey(textureKeyForSubject(b.data)));
  }

  spawnSeed(): void {
    this.spawner.spawnSeed();
    this.ensureMarker();
  }

  hireAtBuilding(
    buildingId: string,
    role: UnitRole,
    opts?: { castleJob?: CivilianJob }
  ): boolean {
    return this.spawner.hireAtBuilding(buildingId, role, opts);
  }

  private findInteriorBuildingAt(
    x: number,
    y: number
  ): (BuildingRecord & { kind: BuildingRecord['kind'] | 'keep' }) | null {
    if (!this.buildings) return null;
    if (this.buildings.getKeepHp() > 0) {
      const keepPt = this.buildings.getKeepPoint();
      if (pointInsideFootprint('keep', keepPt, x, y)) {
        return {
          id: KEEP_ID,
          kind: 'keep',
          x: keepPt.x,
          y: keepPt.y,
        } as BuildingRecord;
      }
    }
    for (const b of this.buildings.list()) {
      if (
        isInteriorBuilding(b.kind) &&
        pointInsideFootprint(b.kind, b, x, y)
      ) {
        return b;
      }
    }
    return null;
  }

  restore(saved: SavedSubject[]): void {
    this.clearSubjects();
    for (const s of saved) {
      this.spawner.createSubject(s.role, s.houseId, s.id, s.name, {
        hp: s.hp,
        maxHp: s.maxHp,
        onWall: s.onWall,
        hunger: s.hunger,
        sick: s.sick,
        gender: s.gender,
        temporaryPrincess: s.temporaryPrincess,
        married: s.married,
        happiness: s.happiness,
        ageYears: s.ageYears,
        body: s.body,
        job: s.job,
        workplaceId: s.workplaceId,
        spouseId: s.spouseId,
        motherId: s.motherId,
        fatherId: s.fatherId,
        pregnant: s.pregnant,
        pregnantDaysLeft: s.pregnantDaysLeft,
        thought: s.thought,
        backstory: s.backstory,
        goal: s.goal,
        lifeLog: s.lifeLog,
        curse: s.curse,
        cursedAsRole: s.cursedAsRole,
        lowHappyHours: s.lowHappyHours,
        activity: s.activity,
        activityLabel: s.activityLabel,
        zone: s.zone,
        interrupt: s.interrupt ?? null,
        skipBirthLog: true,
        campId: s.campId,
        allegiance: s.allegiance,
        loyaltyKeepId: s.loyaltyKeepId,
        pendingChildHouseId: s.pendingChildHouseId,
        appearanceVariant: s.appearanceVariant,
        legendId: s.legendId,
      });
      const managed = this.getById(s.id);
      if (managed) {
        if (typeof s.x === 'number' && typeof s.y === 'number') {
          const land = this.snapToWalkable(s.x, s.y);
          managed.sprite.setPosition(land.x, land.y);
          managed.sprite.setDepth(20 + land.y * 0.01);
        }
        if (s.interrupt) {
          managed.interrupt = s.interrupt;
        }
      }
      this.registry.bumpNextIdFromSavedId(s.id);
    }
    this.migrateMonarchs();
    this.linkRoyalSpousesIfBothPresent();
    this.ensureMarker();
    // Sickness / quarantine disabled — clear leftover sick/flee state from older saves
    for (const s of this.registry.all) {
      s.data.sick = false;
      if (s.data.activity === 'flee' && s.interrupt?.kind !== 'abducted') {
        const slot = slotAtHour(s.data.role, this.clock.hour, s.data.job);
        s.data.activity = slot.activity;
        s.data.activityLabel = slot.label;
        s.data.zone = slot.zone;
      }
    }
    this.reassignLoyalties();
    this.rebalanceCivilianJobs();
  }

  serialize(): SavedSubject[] {
    return this.registry.serialize();
  }

  count(): number {
    return this.registry.count();
  }

  countAll(): number {
    return this.registry.countAll();
  }

  royalCounts(): Map<string, number> {
    return this.registry.royalCounts();
  }

  occupantCounts(): Map<string, number> {
    return this.registry.occupantCounts((id) =>
      Boolean(this.buildings?.getHousePoint(id))
    );
  }

  unitBodies(): Aabb[] {
    return this.registry.unitBodies();
  }

  hire(role: UnitRole): boolean {
    return this.spawner.hire(role);
  }

  list(): Subject[] {
    return this.registry.list();
  }

  campMemberNear(
    campId: string,
    x: number,
    y: number,
    radius: number
  ): boolean {
    const houseId = `camp:${campId}`;
    for (const s of this.registry.all) {
      if (s.data.houseId !== houseId) continue;
      const d = Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, x, y);
      if (d < radius) return true;
    }
    return false;
  }

  residentsOf(houseId: string): BuildingResident[] {
    return this.registry.residentsOf(houseId);
  }

  workersOf(buildingId: string): BuildingResident[] {
    return this.registry.workersOf(buildingId);
  }

  combatants(): ManagedSubject[] {
    return this.registry.all.filter(
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
    for (const s of this.registry.all) {
      if (!s.sprite.active) continue;
      if (s.interrupt?.kind === 'defect') continue;
      if (s.data.allegiance === 'camp') continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  getById(id: string): ManagedSubject | undefined {
    return this.registry.getById(id);
  }

  /** Tight world-space body pick (feet at sprite origin). */
  pickAt(worldX: number, worldY: number): string | null {
    let best: ManagedSubject | null = null;
    let bestY = -Infinity;
    for (const s of this.registry.all) {
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
      this.applyLoyaltyHighlight();
      return null;
    }

    const managed = this.getById(id);
    if (!managed) {
      this.selectedId = null;
      this.marker?.setVisible(false);
      return null;
    }

    this.applyLoyaltyHighlight();
    managed.sprite.setTint(0xfff0c0);

    this.marker
      ?.setPosition(managed.sprite.x, managed.sprite.y - 2)
      .setVisible(true);

    return this.toSnapshot(managed);
  }

  update(deltaMs: number): void {
    const rolled = this.clock.tick(deltaMs);
    this.syncActivities();
    this.rescueStranded(deltaMs);

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
      for (const managed of this.registry.all) {
        if (managed.interrupt) continue;
        if (this.isSeekingWounded(managed)) continue;
        if (
          managed.data.activity === 'ball' ||
          managed.data.activity === 'festival' ||
          managed.data.activity === 'joust' ||
          managed.data.activity === 'flee' ||
          managed.data.activity === 'wedding'
        ) {
          continue;
        }
        const slot = slotAtHour(managed.data.role, this.clock.hour, managed.data.job);
        const site = this.resolveScheduleSite(managed, slot);
        const dist = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          site.x,
          site.y
        );
        if (site.sticky) {
          if (!managed.moving && dist > PRESENCE_ARRIVE_R) {
            this.nudgeTowardSchedule(managed);
          }
          // On-site: hold position (no random wander)
        } else if (!managed.moving && Math.random() < deltaMs * 0.0004) {
          this.nudgeTowardSchedule(managed);
        }
      }
      this.tickPresence(deltaMs);
    }

    this.tickDefectWalks();

    this.healAccumMs += deltaMs;
    if (this.healAccumMs >= 2500) {
      this.healAccumMs = 0;
      for (const s of this.registry.all) {
        if (s.data.role !== 'physician') continue;
        if (s.interrupt) continue;
        this.healNearestInjured(s.data.id);
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
    for (const managed of this.registry.all) {
      if (managed.data.role === 'peasant') {
        managed.fleeCooldownMs -= deltaMs;
        if (managed.fleeCooldownMs > 0) continue;
        const threat = raids.nearestRaider(
          managed.sprite.x,
          managed.sprite.y,
          CombatBalance.fleeRadius * 2
        );
        if (!threat) continue;
        const threatDist = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          threat.sprite.x,
          threat.sprite.y
        );
        if (
          shouldSkipFleeForCelebration(
            managed.data.activity,
            threatDist,
            CombatBalance.fleeRadius
          )
        ) {
          continue;
        }
        if (
          managed.interrupt?.kind === 'imprisoned' ||
          managed.interrupt?.kind === 'under_arrest' ||
          managed.interrupt?.kind === 'spectate_hanging' ||
          managed.interrupt?.kind === 'in_stocks' ||
          managed.interrupt?.kind === 'to_stocks' ||
          managed.interrupt?.kind === 'pelt_stocks'
        ) {
          continue;
        }
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
        this.tryClimbNearestLadder(managed.data.id);
      } else if (
        managed.data.role === 'guard' &&
        !managed.data.onWall &&
        Math.random() < 0.02
      ) {
        this.tryClimbNearestLadder(managed.data.id);
      }
    }
  }

  tryClimbNearestLadder(subjectId: string): boolean {
    const managed = this.getById(subjectId);
    if (!managed || !this.buildings) return false;
    const ladder = this.buildings.ladderNear(
      managed.sprite.x,
      managed.sprite.y,
      80
    );
    if (ladder) {
      const wall = this.buildings.wallForLadder(ladder);
      if (!wall || !ladder.ladderFacing) return false;
      const ground = ladderGroundApproach(
        wall.x,
        wall.y,
        ladder.ladderFacing
      );
      managed.data.activity = 'climb';
      managed.data.activityLabel = 'Climbing the wall';
      this.nudgeToward(subjectId, ground.x, ground.y, 50, () => {
        managed.data.onWall = true;
        managed.sprite.setPosition(wall.x, wall.y - 10);
        managed.sprite.setDepth(22 + wall.y * 0.01);
        managed.data.activityLabel = 'On the wall';
        managed.data.zone = 'wall';
      });
      return true;
    }

    const corner = this.buildings.cornerClimbNear(
      managed.sprite.x,
      managed.sprite.y,
      80
    );
    if (!corner) return false;

    managed.data.activity = 'climb';
    managed.data.activityLabel = 'Climbing the wall';
    this.nudgeToward(subjectId, corner.groundX, corner.groundY, 50, () => {
      managed.data.onWall = true;
      managed.sprite.setPosition(corner.wall.x, corner.wall.y - 10);
      managed.sprite.setDepth(22 + corner.wall.y * 0.01);
      managed.data.activityLabel = 'On the wall';
      managed.data.zone = 'wall';
    });
    return true;
  }

  /** @deprecated Use tryClimbNearestLadder */
  tryClimbNearestStairs(subjectId: string): boolean {
    return this.tryClimbNearestLadder(subjectId);
  }

  /** Drop anyone standing on a destroyed wall. */
  dropFromWall(wallId: string): void {
    if (!this.buildings) return;
    const wall = this.buildings.getById(wallId);
    for (const s of this.registry.all) {
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
    for (const s of this.registry.all) {
      if (s.data.houseId !== houseId) continue;
      const next = this.buildings?.pickHouseForHire(this.occupantCounts());
      s.data.houseId = next ?? '';
    }
    this.assignHomelessToHomes();
  }

  isHomeless(managed: ManagedSubject): boolean {
    if (managed.data.allegiance === 'camp') return false;
    const houseId = managed.data.houseId;
    if (houseId.startsWith('camp:')) return false;
    const exists = Boolean(this.buildings?.getHousePoint(houseId));
    return isHomelessHouseId(houseId, exists);
  }

  /** Claim free beds (or keep chambers) for subjects whose homes are gone. */
  assignHomelessToHomes(): void {
    if (!this.buildings) return;
    const counts = this.occupantCounts();
    const royal = this.royalCounts();
    let assigned = false;
    for (const s of this.registry.all) {
      if (!this.isHomeless(s)) continue;
      if (livesAtKeep(s.data.role)) {
        const keep = this.buildings.pickKeepForHire(royal);
        if (!keep) continue;
        s.data.houseId = keep;
        royal.set(keep, (royal.get(keep) ?? 0) + 1);
        assigned = true;
        continue;
      }
      const house = this.buildings.pickHouseForHire(counts);
      if (!house) continue;
      s.data.houseId = house;
      counts.set(house, (counts.get(house) ?? 0) + 1);
      assigned = true;
    }
    if (assigned) this.onChanged?.();
  }

  damageSubject(id: string, amount: number): boolean {
    const managed = this.getById(id);
    if (!managed) return false;
    managed.data.hp = Math.max(0, managed.data.hp - amount);
    this.applyHpTint(managed);
    this.vfx?.hitFlash(managed.sprite);
    if (managed.data.hp <= 0) {
      const name = managed.data.name;
      const role = managed.data.role;
      const houseId = managed.data.houseId;
      this.removeSubject(managed, { poof: true });
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${name} was slain`,
      });
      if (role === 'king' || role === 'queen') {
        this.trySuccession();
      }
      this.onDeath?.(id, houseId, name);
      this.onChanged?.();
      return true;
    }
    this.onChanged?.();
    return false;
  }

  /** Kingdom-wide: if no king and no queen, promote a married prince + princess. */
  private trySuccession(): void {
    const hasKing = this.registry.all.some((s) => s.data.role === 'king');
    const hasQueen = this.registry.all.some((s) => s.data.role === 'queen');
    if (hasKing || hasQueen) return;

    const prince = this.registry.all.find(
      (s) => s.data.role === 'prince' && s.data.married
    );
    const princess = this.registry.all.find(
      (s) =>
        s.data.role === 'princess' &&
        s.data.married &&
        !s.data.temporaryPrincess
    );
    if (!prince || !princess) return;

    this.transformRole(prince.data.id, 'king', { married: true });
    this.transformRole(princess.data.id, 'queen', { married: true });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${prince.data.name} and ${princess.data.name} take the throne!`,
    });
  }

  /** After restore: keep one king / one queen; demote extras to duke / duchess. */
  migrateMonarchs(): void {
    const kings = this.registry.all.filter((s) => s.data.role === 'king');
    for (let i = 1; i < kings.length; i++) {
      const k = kings[i]!;
      this.transformRole(k.data.id, 'duke', { married: k.data.married });
    }
    const queens = this.registry.all.filter((s) => s.data.role === 'queen');
    for (let i = 1; i < queens.length; i++) {
      const q = queens[i]!;
      this.transformRole(q.data.id, 'duchess', { married: q.data.married });
    }
  }

  applyBodyFromHunger(): void {
    for (const s of this.registry.all) {
      if (s.data.allegiance === 'camp') continue;
      const h = s.data.hunger;
      let body = s.data.body;
      if (h >= 70) {
        if (body === 'obese') body = 'plump';
        else if (body === 'plump') body = 'average';
        else body = 'gaunt';
      } else if (h <= 15) {
        if (body === 'gaunt') body = 'average';
        else if (body === 'average') body = 'plump';
        else body = 'obese';
      } else if (h <= 35 && body === 'gaunt') {
        body = 'average';
      } else if (h >= 50 && body === 'obese') {
        body = 'plump';
      }
      s.data.body = body;
      this.applyBodyScale(s);
    }
  }

  ageOnDayRolled(): void {
    for (const s of [...this.registry.all]) {
      s.data.ageYears += 1;
      if (
        s.data.role === 'child' &&
        s.data.ageYears >= Phase12Balance.childPromoteAge
      ) {
        this.transformRole(s.data.id, 'peasant', {
          temporaryPrincess: false,
          married: false,
        });
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${s.data.name} grew into a peasant`,
        });
      }
      const lifespan = isRoyalRole(s.data.role)
        ? Phase12Balance.royalLifespan
        : Phase12Balance.defaultLifespan;
      if (s.data.ageYears > lifespan) {
        const name = s.data.name;
        const houseId = s.data.houseId;
        const id = s.data.id;
        this.removeSubject(s);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${name} died of old age`,
        });
        this.onDeath?.(id, houseId, name);
        this.onChanged?.();
      }
    }
  }

  listCareerTodos(): CareerTodoItem[] {
    return this.spawner.listCareerTodos();
  }

  promoteCareer(subjectId: string, role: UnitRole): boolean {
    return this.spawner.promoteCareer(subjectId, role);
  }

  nudgeToward(
    id: string,
    targetX: number,
    targetY: number,
    speed = 40,
    onArrive?: () => void
  ): void {
    const depth = (this.nudgeDepth ?? 0) + 1;
    this.nudgeDepth = depth;
    try {
      if (depth > 8) {
        onArrive?.();
        return;
      }
      this.nudgeTowardInner(id, targetX, targetY, speed, onArrive);
    } finally {
      this.nudgeDepth = depth - 1;
    }
  }

  private nudgeDepth = 0;

  private nudgeTowardInner(
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

    const currentInterior = this.findInteriorBuildingAt(
      managed.sprite.x,
      managed.sprite.y
    );
    const targetInterior = this.findInteriorBuildingAt(x, y);
    const leavingInterior =
      currentInterior &&
      isOnWalkableInteriorNav(
        currentInterior.kind,
        currentInterior,
        managed.sprite.x,
        managed.sprite.y
      ) &&
      (!targetInterior ||
        targetInterior.id !== currentInterior.id ||
        !pointInsideFootprint(
          currentInterior.kind,
          currentInterior,
          x,
          y
        ));

    if (leavingInterior) {
      const exitPath = interiorWaypoints(
        currentInterior!.kind,
        currentInterior!,
        managed.sprite.x,
        managed.sprite.y,
        x,
        y,
        id
      );
      this.followWaypoints(id, exitPath, speed, () => {
        // Ensure we finished outside the footprint before outdoor pathing —
        // otherwise leavingInterior fires again and can stack-overflow.
        const stillInside = pointInsideFootprint(
          currentInterior!.kind,
          currentInterior!,
          managed.sprite.x,
          managed.sprite.y
        );
        if (stillInside) {
          const approach = buildingDoorApproach(
            currentInterior!.kind,
            currentInterior!
          );
          managed.sprite.setPosition(approach.x, approach.y);
          managed.sprite.setDepth(20 + approach.y * 0.01);
        }
        this.nudgeToward(id, targetX, targetY, speed, onArrive);
      });
      return;
    }

    const interiorBuilding = targetInterior;
    if (
      interiorBuilding &&
      pointInsideFootprint(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y
      ) &&
      !isOnWalkableInteriorNav(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y
      ) &&
      !nearBuildingDoor(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y
      )
    ) {
      const approach = buildingDoorApproach(
        interiorBuilding.kind,
        interiorBuilding
      );
      this.nudgeToward(id, approach.x, approach.y, speed, () => {
        this.nudgeToward(id, targetX, targetY, speed, onArrive);
      });
      return;
    }
    if (
      interiorBuilding &&
      !isOnWalkableInteriorNav(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y
      ) &&
      !nearBuildingDoor(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y
      )
    ) {
      const approach = buildingDoorApproach(
        interiorBuilding.kind,
        interiorBuilding
      );
      this.nudgeToward(id, approach.x, approach.y, speed, () => {
        const inner = interiorWaypoints(
          interiorBuilding.kind,
          interiorBuilding,
          approach.x,
          approach.y,
          x,
          y,
          id
        );
        if (inner.length === 0) {
          onArrive?.();
          return;
        }
        this.followWaypoints(id, inner, speed, onArrive);
      });
      return;
    }
    if (
      interiorBuilding &&
      (isOnWalkableInteriorNav(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y
      ) ||
        nearBuildingDoor(
          interiorBuilding.kind,
          interiorBuilding,
          managed.sprite.x,
          managed.sprite.y
        ))
    ) {
      const inner = interiorWaypoints(
        interiorBuilding.kind,
        interiorBuilding,
        managed.sprite.x,
        managed.sprite.y,
        x,
        y,
        id
      );
      if (inner.length > 0) {
        this.followWaypoints(id, inner, speed, onArrive);
        return;
      }
    }

    // If stranded on water/mountain, teleport onto the nearest open land first
    // Only yank units off impassable terrain — not building footprints (interiors).
    if (this.pathGrid?.isTerrainBlockedAtWorld(managed.sprite.x, managed.sprite.y)) {
      const safe = this.snapToWalkable(managed.sprite.x, managed.sprite.y);
      managed.sprite.setPosition(safe.x, safe.y);
      managed.sprite.setDepth(20 + safe.y * 0.01);
    }

    const snappedGoal = this.snapToWalkable(x, y);
    x = snappedGoal.x;
    y = snappedGoal.y;

    // Path around walls / closed gates / water / mountains for all ground units
    if (this.pathGrid) {
      const path = this.pathGrid.findPath(
        { x: managed.sprite.x, y: managed.sprite.y },
        { x, y }
      );
      if (path && path.length > 1) {
        let hop = Math.min(PATH_HOP_BUDGET, path.length - 1);
        while (
          hop > 1 &&
          !this.pathGrid.isSegmentClear(
            managed.sprite.x,
            managed.sprite.y,
            path[hop]!.x,
            path[hop]!.y
          )
        ) {
          hop -= 1;
        }
        x = path[hop]!.x;
        y = path[hop]!.y;
        if (
          !this.pathGrid.isSegmentClear(managed.sprite.x, managed.sprite.y, x, y)
        ) {
          // Still blocked — snap onto first path cell
          const land = path[1]!;
          managed.sprite.setPosition(land.x, land.y);
          managed.sprite.setDepth(20 + land.y * 0.01);
          const continuePath = () =>
            this.nudgeToward(id, targetX, targetY, speed, onArrive);
          this.tweenMove(managed, path[Math.min(2, path.length - 1)]!.x, path[Math.min(2, path.length - 1)]!.y, speed, continuePath);
          return;
        }
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
      // No land path — never straight-line across water or other blocked terrain
      if (Math.hypot(managed.sprite.x - x, managed.sprite.y - y) < 12) {
        onArrive?.();
      }
      return;
    }

    const dx = x - managed.sprite.x;
    const dy = y - managed.sprite.y;
    if (Math.hypot(dx, dy) < 6) {
      onArrive?.();
      return;
    }

    this.tweenMove(managed, x, y, speed, onArrive);
  }

  /** Snap a world point onto walkable land (bridges count). */
  snapToWalkable(x: number, y: number): Point {
    if (!this.pathGrid) return { x, y };
    return this.pathGrid.snapWorldToOpen(x, y);
  }

  /** Periodically pull anyone stuck on water/mountains onto land. */
  private rescueStranded(deltaMs: number): void {
    if (!this.pathGrid) return;
    this.rescueAccumMs += deltaMs;
    if (this.rescueAccumMs < 1500) return;
    this.rescueAccumMs = 0;
    for (const managed of this.registry.all) {
      if (!managed.sprite.active || managed.moving || managed.data.onWall) continue;
      if (!this.pathGrid.isTerrainBlockedAtWorld(managed.sprite.x, managed.sprite.y)) {
        continue;
      }
      const safe = this.snapToWalkable(managed.sprite.x, managed.sprite.y);
      managed.sprite.setPosition(safe.x, safe.y);
      managed.sprite.setDepth(20 + safe.y * 0.01);
    }
  }

  private followWaypoints(
    id: string,
    points: { x: number; y: number }[],
    speed: number,
    onArrive?: () => void
  ): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || points.length === 0) {
      onArrive?.();
      return;
    }
    const [next, ...rest] = points;
    // Interior waypoints intentionally cross outdoor-blocked footprints (doors /
    // rooms). Never route them back through nudgeToward — that re-enters leave /
    // enter logic and can recurse until the stack overflows.
    this.tweenMove(managed, next!.x, next!.y, speed, () => {
      if (rest.length === 0) {
        onArrive?.();
      } else {
        this.followWaypoints(id, rest, speed, onArrive);
      }
    });
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

    this.clearActivityAnim(managed);
    this.scene.tweens.killTweensOf(managed.sprite);
    managed.moving = false;

    let moveSpeed = speed;
    if (managed.data.sick) moveSpeed *= 0.55;
    else if (this.inspired && managed.data.role === 'peasant') moveSpeed *= 1.15;

    const dir = facingFromDelta(dx, dy);
    const texKey = textureKeyForSubject(managed.data);
    managed.sprite.play(walkAnimKey(texKey, dir), true);
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
          managed.sprite.play(idleAnimKey(texKey));
        }
        onArrive?.();
      },
    });
  }

  /** Reset sleep/work pose before walking or leaving a slot. */
  clearActivityAnim(managed: ManagedSubject): void {
    const wasJuggle = managed.presenceAnim === 'juggle';
    const wasCelebrate = managed.presenceAnim === 'celebrate';
    const wasPray = managed.presenceAnim === 'pray';
    if (managed.presenceAnim) {
      this.scene.tweens.killTweensOf(managed.sprite);
      managed.presenceAnim = null;
    }
    if (!managed.sprite.active) return;
    managed.sprite.setRotation(0);
    managed.sprite.setAngle(0);
    managed.sprite.setAlpha(1);
    this.applyBodyScale(managed);
    if (wasJuggle && managed.data.role === 'jester' && !managed.moving) {
      managed.sprite.play(idleAnimKey('jester'));
    }
    if ((wasCelebrate || wasPray) && !managed.moving) {
      const texKey = textureKeyForSubject(managed.data);
      managed.sprite.setTexture(texKey);
      managed.sprite.play(idleAnimKey(texKey));
    }
  }

  playWorkAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'work') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'work';
    const baseY = managed.sprite.y;
    this.scene.tweens.add({
      targets: managed.sprite,
      y: baseY - 2,
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  playJuggleAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'juggle') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'juggle';
    const texKey = textureKeyForSubject(managed.data);
    if (managed.data.role === 'jester') {
      managed.sprite.play(jesterJuggleAnimKey(), true);
    } else {
      managed.sprite.play(idleAnimKey(texKey));
    }
    const baseX = managed.sprite.x;
    this.scene.tweens.add({
      targets: managed.sprite,
      x: baseX + 2,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  playCelebrateAnim(
    id: string,
    mode: 'dance' | 'cheer' | 'bow' = 'dance'
  ): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'celebrate') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'celebrate';
    const cKey = celebrateVisualKey(managed.data.gender);
    const texKey = textureKeyForSubject(managed.data);
    if (this.scene.textures.exists(cKey)) {
      if (mode === 'cheer' || mode === 'bow') {
        const cheerKey = celebrateCheerAnimKey(cKey);
        if (this.scene.anims.exists(cheerKey)) {
          managed.sprite.play(cheerKey, true);
        }
      } else {
        const danceKey = celebrateDanceAnimKey(cKey);
        if (this.scene.anims.exists(danceKey)) {
          managed.sprite.play(danceKey, true);
        }
      }
    } else {
      managed.sprite.play(idleAnimKey(texKey));
    }
    const baseY = managed.sprite.y;
    this.scene.tweens.add({
      targets: managed.sprite,
      y: baseY - (mode === 'dance' ? 3 : 2),
      angle: mode === 'bow' ? 12 : mode === 'dance' ? 6 : 0,
      duration: mode === 'bow' ? 400 : 180,
      yoyo: true,
      repeat: mode === 'bow' ? 1 : 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (managed.sprite.active) managed.sprite.setAngle(0);
      },
    });
  }

  playKneadAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'knead') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'knead';
    const baseX = managed.sprite.x;
    const baseScaleY = managed.sprite.scaleY;
    this.scene.tweens.add({
      targets: managed.sprite,
      x: baseX + 2,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: managed.sprite,
      scaleY: baseScaleY * 1.04,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeInOut',
    });
  }

  playMerchantAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'merchant') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'merchant';
    const baseY = managed.sprite.y;
    this.scene.tweens.add({
      targets: managed.sprite,
      y: baseY - 1,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeInOut',
    });
    managed.sprite.setScale(managed.sprite.scaleX, 1);
    this.scene.tweens.add({
      targets: managed.sprite,
      angle: { from: -4, to: 4 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  playPrayAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'pray') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'pray';
    const cKey = celebrateVisualKey(managed.data.gender);
    if (this.scene.textures.exists(cKey)) {
      const cheerKey = celebrateCheerAnimKey(cKey);
      if (this.scene.anims.exists(cheerKey)) {
        managed.sprite.setTexture(cKey);
        managed.sprite.play(cheerKey, true);
      }
    } else {
      managed.sprite.setRotation(0.15);
    }
    const baseY = managed.sprite.y;
    this.scene.tweens.add({
      targets: managed.sprite,
      y: baseY - 1,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  playChildPlayAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'play') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'play';
    const baseY = managed.sprite.y;
    this.scene.tweens.add({
      targets: managed.sprite,
      y: baseY - 5,
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeOut',
    });
  }

  playSlashAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active) return;
    const slashKey = roleSlashAnimKey(managed.data.role);
    if (!this.scene.anims.exists(slashKey)) return;
    const texKey = textureKeyForSubject(managed.data);
    managed.sprite.play(slashKey);
    managed.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (managed.sprite.active && !managed.moving) {
        managed.sprite.play(idleAnimKey(texKey));
      }
    });
  }

  playPoofVfx(x: number, y: number): void {
    const burst = this.scene.add
      .circle(x, y - 8, 6, 0xffee88, 0.85)
      .setDepth(30 + y * 0.01);
    this.scene.tweens.add({
      targets: burst,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 450,
      onComplete: () => burst.destroy(),
    });
  }

  playSleepAnim(id: string): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active || managed.moving) return;
    if (managed.presenceAnim === 'sleep') return;
    this.clearActivityAnim(managed);
    managed.presenceAnim = 'sleep';
    managed.sprite.setRotation(1.2);
    managed.sprite.setAlpha(0.92);
    const baseY = managed.sprite.y;
    this.scene.tweens.add({
      targets: managed.sprite,
      y: baseY + 1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Spaced stand point around a site so co-workers / family don't stack. */
  standPointAt(
    x: number,
    y: number,
    groupKey: string,
    subjectId: string,
    opts?: { indoor?: boolean; radius?: number }
  ): Point {
    const peers = this.registry.all.filter(
      (s) =>
        s.data.workplaceId === groupKey ||
        s.data.houseId === groupKey ||
        (s.interrupt?.kind === 'harvest' && s.interrupt.targetId === groupKey)
    );
    let idx = peers.findIndex((s) => s.data.id === subjectId);
    if (idx < 0) idx = peers.length;
    const off = ringOffset(
      idx,
      Math.max(peers.length, idx + 1),
      opts?.radius ?? 18
    );
    const px = x + off.x;
    const py = y + off.y + (opts?.indoor ? 6 : 0);
    if (opts?.indoor && this.buildings) {
      for (const b of this.buildings.list()) {
        if (
          hasInterior(b.kind) &&
          pointInsideFootprint(b.kind, b, px, py)
        ) {
          return snapInteriorPoint(b.kind, b, px, py);
        }
      }
      if (this.buildings.getKeepHp() > 0) {
        const keep = this.buildings.getKeepPoint();
        if (pointInsideFootprint('keep', keep, px, py)) {
          return snapInteriorPoint('keep', keep, px, py);
        }
      }
      return { x: px, y: py };
    }
    return this.snapToWalkable(px, py);
  }

  refreshSelectedSnapshot(): SubjectSnapshot | null {
    if (!this.selectedId) return null;
    const managed = this.getById(this.selectedId);
    return managed ? this.toSnapshot(managed) : null;
  }

  /** Camp members' "home" resolves to their camp's location instead of a house. */
  private homePointFor(houseId: string): Point | null {
    if (houseId.startsWith('camp:')) {
      const campId = houseId.slice('camp:'.length);
      return this.encampments?.getCampPoint(campId) ?? null;
    }
    return this.buildings?.getHousePoint(houseId) ?? null;
  }

  /**
   * Bed spot inside the home footprint so roofs lift and sleepers aren't
   * standing in the yard (ring offsets used to push them south of the door).
   */
  private sleepBedPoint(managed: ManagedSubject): Point | null {
    const houseId = managed.data.houseId;
    if (!houseId || houseId.startsWith('camp:')) {
      const home = this.homePointFor(houseId);
      return home;
    }
    if (!this.buildings) return this.homePointFor(houseId);

    let kind: BuildKind | 'keep' | null = null;
    let hx = 0;
    let hy = 0;
    if (houseId === KEEP_ID || livesAtKeep(managed.data.role)) {
      const keep = this.buildings.getHousePoint(
        livesAtKeep(managed.data.role) ? houseId : KEEP_ID
      );
      if (!keep) return null;
      kind = 'keep';
      hx = keep.x;
      hy = keep.y;
    } else {
      const b = this.buildings.getById(houseId);
      if (!b || (!isDwelling(b.kind) && b.kind !== 'keep')) {
        return this.homePointFor(houseId);
      }
      kind = b.kind;
      hx = b.x;
      hy = b.y;
    }

    const box = footprintAabb(kind, hx, hy);
    const roommates = this.registry.all.filter((s) => s.data.houseId === houseId);
    let idx = roommates.findIndex((s) => s.data.id === managed.data.id);
    if (idx < 0) idx = roommates.length;
    const n = Math.max(roommates.length, idx + 1);
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(n))));
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rows = Math.max(1, Math.ceil(n / cols));

    // Keep sprite feet inside the footprint (AABB bottom = building anchor y)
    const padX = 10;
    const padTop = 14;
    const padBottom = 10;
    const innerW = Math.max(8, box.right - box.left - padX * 2);
    const innerH = Math.max(8, box.bottom - box.top - padTop - padBottom);
    const x = box.left + padX + ((col + 0.5) / cols) * innerW;
    const y = box.top + padTop + ((row + 0.55) / rows) * innerH;
    const raw = {
      x: Phaser.Math.Clamp(x, box.left + padX, box.right - padX),
      y: Phaser.Math.Clamp(y, box.top + padTop, box.bottom - padBottom),
    };
    return snapInteriorPoint(kind!, { x: hx, y: hy }, raw.x, raw.y);
  }

  /** True when the subject's feet are inside their home footprint. */
  private isInsideHome(managed: ManagedSubject): boolean {
    const houseId = managed.data.houseId;
    if (!houseId || houseId.startsWith('camp:') || !this.buildings) return false;
    let box: Aabb | null = null;
    if (houseId === KEEP_ID) {
      const keep = this.buildings.getKeepPoint();
      box = footprintAabb('keep', keep.x, keep.y);
    } else {
      const b = this.buildings.getById(houseId);
      if (!b) return false;
      box = footprintAabb(b.kind, b.x, b.y);
    }
    const x = managed.sprite.x;
    const y = managed.sprite.y;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }

  private createSubject(
    role: UnitRole,
    houseId: string,
    id: string,
    name: string,
    opts?: Parameters<SubjectSpawner['createSubject']>[4]
  ): void {
    this.spawner.createSubject(role, houseId, id, name, opts);
  }

  private roleAtBuildingCap(role: UnitRole): boolean {
    if (!this.buildings) return false;
    let totalCap = 0;
    let found = false;
    const buildings = [...this.buildings.list()];
    const keep = this.buildings.getById(KEEP_ID);
    if (keep) buildings.push(keep);
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      const caps = BUILDING_ROLE_CAPACITY[b.kind as BuildKind];
      const cap = caps?.[role];
      if (cap == null) continue;
      found = true;
      totalCap += cap;
    }
    if (!found) return false;
    return this.countRole(role) >= totalCap;
  }

  private openCastleJob(
    exceptId?: string,
    preferred?: CivilianJob
  ): CivilianJob | null {
    if (preferred) {
      const cap =
        CASTLE_JOB_CAPACITY[
          preferred as keyof typeof CASTLE_JOB_CAPACITY
        ];
      const used = this.registry.all.filter(
        (s) => s.data.job === preferred && s.data.id !== exceptId
      ).length;
      return used < cap ? preferred : null;
    }
    for (const job of CASTLE_JOBS) {
      const cap =
        CASTLE_JOB_CAPACITY[
          job as keyof typeof CASTLE_JOB_CAPACITY
        ];
      const used = this.registry.all.filter(
        (s) => s.data.job === job && s.data.id !== exceptId
      ).length;
      if (used < cap) return job;
    }
    return null;
  }

  private fieldsHaveOpenFarmerSlots(exceptId?: string): boolean {
    if (!this.buildings) return false;
    for (const b of this.buildings.list()) {
      if (b.kind !== 'field' || b.hp <= 0) continue;
      const cap = BUILDING_ROLE_CAPACITY.field?.peasant ?? 0;
      const used = this.registry.all.filter(
        (s) =>
          s.data.workplaceId === b.id &&
          s.data.role === 'peasant' &&
          s.data.id !== exceptId
      ).length;
      if (used < cap) return true;
    }
    return false;
  }

  private fieldCount(): number {
    return (
      this.buildings?.list().filter((b) => b.kind === 'field' && b.hp > 0)
        .length ?? 0
    );
  }

  private castleStaffCount(exceptId?: string): number {
    return this.registry.all.filter(
      (s) => isCastleJob(s.data.job) && s.data.id !== exceptId
    ).length;
  }

  /** True when keep staff may be hired (food posts filled, or lonely keep seed). */
  private canAssignCastleJob(exceptId?: string): boolean {
    if (this.fieldsHaveOpenFarmerSlots(exceptId)) return false;
    if (this.fieldCount() === 0) {
      return this.castleStaffCount(exceptId) < 1;
    }
    return true;
  }

  private workplaceCandidatesForPeasant(
    managed: ManagedSubject
  ): BuildingRecord[] {
    if (!this.buildings) return [];
    const loyalty = managed.data.loyaltyKeepId;
    const byKind = new Map<BuildKind, BuildingRecord[]>();
    for (const kind of FOOD_BIND_KINDS) byKind.set(kind, []);

    for (const b of this.buildings.list()) {
      if (b.hp <= 0) continue;
      if (!FOOD_BIND_KINDS.includes(b.kind)) continue;
      byKind.get(b.kind)!.push(b);
    }
    const primary = this.buildings.getById(KEEP_ID);
    if (primary && !byKind.get('keep')!.some((k) => k.id === KEEP_ID)) {
      byKind.get('keep')!.unshift(primary);
    }

    const ordered: BuildingRecord[] = [];
    for (const kind of FOOD_BIND_KINDS) {
      const list = byKind.get(kind) ?? [];
      list.sort((a, b) => {
        const aLoyal =
          loyalty &&
          (a.kind === 'keep'
            ? a.id === loyalty
            : a.loyaltyKeepId === loyalty)
            ? 0
            : 1;
        const bLoyal =
          loyalty &&
          (b.kind === 'keep'
            ? b.id === loyalty
            : b.loyaltyKeepId === loyalty)
            ? 0
            : 1;
        if (aLoyal !== bLoyal) return aLoyal - bLoyal;
        const da = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          a.x,
          a.y
        );
        const db = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          b.x,
          b.y
        );
        return da - db;
      });
      ordered.push(...list);
    }
    return ordered;
  }

  private bindWorkplace(managed: ManagedSubject, role: UnitRole): void {
    if (!this.buildings) return;

    if (role === 'peasant') {
      const candidates = this.workplaceCandidatesForPeasant(managed);
      for (const b of candidates) {
        if (b.hp <= 0) continue;
        const caps = BUILDING_ROLE_CAPACITY[b.kind as BuildKind];
        const cap = caps?.[role];
        if (cap == null) continue;
        const used = this.registry.all.filter(
          (s) =>
            s.data.workplaceId === b.id &&
            (s.data.role === role || s.data.id === managed.data.id)
        ).length;
        if (used >= cap && managed.data.workplaceId !== b.id) continue;

        if (b.kind === 'keep') {
          if (!this.canAssignCastleJob(managed.data.id)) continue;
          const castleJob = this.openCastleJob(managed.data.id);
          if (!castleJob) continue;
          managed.data.workplaceId = b.id;
          managed.data.job = castleJob;
          return;
        }

        managed.data.workplaceId = b.id;
        const job = civilianJobForBuilding(b.kind);
        if (job) managed.data.job = job;
        return;
      }
      return;
    }

    // Non-peasant: nearest capacity building (prefer loyalty territory)
    const loyalty = managed.data.loyaltyKeepId;
    const candidates = [...this.buildings.list()].sort((a, b) => {
      const aLoyal = loyalty && a.loyaltyKeepId === loyalty ? 0 : 1;
      const bLoyal = loyalty && b.loyaltyKeepId === loyalty ? 0 : 1;
      if (aLoyal !== bLoyal) return aLoyal - bLoyal;
      return (
        Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          a.x,
          a.y
        ) -
        Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          b.x,
          b.y
        )
      );
    });
    const keep = this.buildings.getById(KEEP_ID);
    if (keep) candidates.push(keep);

    for (const b of candidates) {
      if (b.hp <= 0) continue;
      const caps = BUILDING_ROLE_CAPACITY[b.kind as BuildKind];
      const cap = caps?.[role];
      if (cap == null) continue;
      const used = this.registry.all.filter(
        (s) =>
          s.data.workplaceId === b.id &&
          (s.data.role === role || s.data.id === managed.data.id)
      ).length;
      if (used >= cap && managed.data.workplaceId !== b.id) continue;
      managed.data.workplaceId = b.id;
      const job = civilianJobForBuilding(b.kind);
      if (job) managed.data.job = job;
      return;
    }
  }

  /** Move surplus castle staff onto open field slots; rebind unbound peasants food-first. */
  rebalanceCivilianJobs(): void {
    if (!this.buildings) return;
    const peasants = this.registry.all.filter(
      (s) => s.data.role === 'peasant' && s.data.allegiance !== 'camp'
    );

    // Pull castle staff onto open fields first
    if (this.fieldsHaveOpenFarmerSlots()) {
      const staff = peasants
        .filter((s) => isCastleJob(s.data.job))
        .slice()
        .reverse();
      for (const s of staff) {
        if (!this.fieldsHaveOpenFarmerSlots(s.data.id)) break;
        s.data.workplaceId = undefined;
        s.data.job = undefined;
        this.bindWorkplace(s, 'peasant');
      }
    }

    for (const s of peasants) {
      if (s.data.workplaceId && s.data.job) continue;
      this.bindWorkplace(s, 'peasant');
    }
  }

  private applyBodyScale(managed: ManagedSubject): void {
    const scaleX = bodyScaleX(managed.data.body);
    const childScale = managed.data.role === 'child' ? 0.85 : 1;
    managed.sprite.setScale(scaleX * childScale, childScale);
  }

  private removeSubject(
    managed: ManagedSubject,
    opts?: { poof?: boolean }
  ): void {
    if (this.selectedId === managed.data.id) {
      this.select(null);
      this.scene.game.events.emit(KingdomEvents.SUBJECT_SELECTED, null);
    }
    this.clearActivityAnim(managed);
    const sprite = managed.sprite;
    const x = sprite.x;
    const y = sprite.y;
    this.registry.remove(managed);
    if (opts?.poof) {
      this.playPoofVfx(x, y);
      this.vfx?.breachDust(x, y - 8);
    }
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        if (sprite.active) sprite.destroy();
      },
    });
    this.onChanged?.();
  }

  private applyHpTint(managed: ManagedSubject): void {
    if (this.selectedId === managed.data.id) return;
    const ratio = managed.data.hp / managed.data.maxHp;
    if (ratio <= 0.35) {
      managed.sprite.setTint(0xff6666);
    } else if (managed.data.role === 'thief') {
      managed.sprite.setTint(0x4a3a5a);
    } else {
      const variantTint = appearanceTint(managed.data.appearanceVariant);
      if (variantTint && variantTint !== 0xffffff) {
        managed.sprite.setTint(variantTint);
      } else {
        managed.sprite.clearTint();
      }
    }
  }

  private clearSubjects(): void {
    for (const s of this.registry.all) {
      s.sprite.destroy();
    }
    this.registry.clear();
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
    this.scheduler.syncActivities((managed) => this.clearActivityAnim(managed));
  }

  private isStickyActivity(activity: ActivityId): boolean {
    return this.scheduler.isStickyActivity(activity);
  }

  private resolveScheduleSite(
    managed: ManagedSubject,
    slot: ScheduleSlot
  ): ScheduleSite {
    return this.scheduler.resolveScheduleSite(managed, slot);
  }

  private tickPresence(deltaMs: number): void {
    this.presenceAccumMs += deltaMs;
    const pulse = this.presenceAccumMs >= 400;
    if (pulse) this.presenceAccumMs = 0;

    for (const managed of this.registry.all) {
      if (!managed.sprite.active || managed.moving || managed.interrupt) {
        continue;
      }
      if (this.isSeekingWounded(managed)) continue;
      if (
        managed.data.activity === 'ball' ||
        managed.data.activity === 'festival' ||
        managed.data.activity === 'joust' ||
        managed.data.activity === 'flee' ||
        managed.data.activity === 'wedding'
      ) {
        if (managed.presenceAnim) this.clearActivityAnim(managed);
        continue;
      }

      const slot = slotAtHour(managed.data.role, this.clock.hour, managed.data.job);
      const site = this.resolveScheduleSite(managed, slot);
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        site.x,
        site.y
      );
      const onSite = dist <= PRESENCE_ARRIVE_R + 8;

      if (!site.sticky || !onSite) {
        if (managed.presenceAnim) this.clearActivityAnim(managed);
        if (!onSite && pulse && site.sticky) {
          managed.data.activityLabel = this.commuteLabel(managed, slot, site);
        }
        continue;
      }

      if (pulse) {
        if (
          site.mode === 'sleep' ||
          slot.activity === 'sleep' ||
          slot.activity === 'chamber'
        ) {
          // Once near bed/chamber, snap onto the sleep slot
          if (!this.isInsideHome(managed) || slot.activity === 'chamber') {
            const bed =
              slot.activity === 'chamber'
                ? { x: site.x, y: site.y }
                : this.sleepBedPoint(managed);
            if (bed) {
              const doorDist = Phaser.Math.Distance.Between(
                managed.sprite.x,
                managed.sprite.y,
                bed.x,
                bed.y
              );
              if (doorDist <= PRESENCE_ARRIVE_R + 24) {
                managed.sprite.setPosition(bed.x, bed.y);
                managed.sprite.setDepth(20 + bed.y * 0.01);
              }
            }
          }
          this.playSleepAnim(managed.data.id);
          managed.data.activityLabel =
            slot.activity === 'chamber'
              ? 'Sleeping in chambers'
              : 'Sleeping at home';
        } else if (site.mode === 'work' || this.isStickyActivity(slot.activity)) {
          if (
            managed.data.role === 'jester' &&
            slot.activity === 'juggle'
          ) {
            this.playJuggleAnim(managed.data.id);
          } else if (slot.activity === 'juggle') {
            this.playCelebrateAnim(managed.data.id, 'dance');
          } else if (
            managed.data.role === 'child' &&
            slot.activity === 'play'
          ) {
            this.playChildPlayAnim(managed.data.id);
          } else {
            this.playWorkAnim(managed.data.id);
          }
          if (
            managed.data.role === 'peasant' &&
            (slot.activity === 'work' || slot.zone === 'field') &&
            site.buildingId
          ) {
            const b = this.buildings?.getById(site.buildingId);
            if (b?.kind === 'field') {
              managed.data.activityLabel = 'Harvesting the fields';
            }
          }
        }
      }

      managed.presenceBlurbMs -= deltaMs;
      if (managed.presenceBlurbMs <= 0 && onSite) {
        managed.presenceBlurbMs =
          PRESENCE_BLURB_MIN_MS + Math.random() * PRESENCE_BLURB_SPAN_MS;
        const line = presenceLineFor({
          activity: slot.activity,
          role: managed.data.role,
          job: managed.data.job,
        });
        if (line && this.bubbles) {
          this.bubbles.say(managed.sprite, line);
          managed.data.thought = line;
        }
      }
    }
  }

  private nudgeTowardSchedule(managed: ManagedSubject): void {
    if (!managed.sprite.active || managed.moving || managed.data.onWall) return;
    if (managed.interrupt) return;
    if (this.isSeekingWounded(managed)) return;

    const slot = slotAtHour(managed.data.role, this.clock.hour, managed.data.job);
    managed.data.activity = slot.activity;
    managed.data.activityLabel = slot.label;
    managed.data.zone = slot.zone;

    const site = this.resolveScheduleSite(managed, slot);
    let target = { x: site.x, y: site.y };

    // Soft block: civilians prefer not to path into an active security cordon.
    if (
      this.security?.isActive() &&
      !isMilitaryRole(managed.data.role) &&
      this.security.inQuarantine(target.x, target.y)
    ) {
      const home = this.homePointFor(managed.data.houseId);
      const retry = randomPointInZone(slot.zone, this.world, home);
      if (!this.security.inQuarantine(retry.x, retry.y)) {
        target = retry;
      } else {
        return;
      }
    }

    // Already on sticky site — stay put
    if (site.sticky) {
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        target.x,
        target.y
      );
      if (dist <= PRESENCE_ARRIVE_R) return;
      managed.data.activityLabel = this.commuteLabel(managed, slot, site);
    }

    // Stagger repath slightly so crowds fan out on roads
    const stagger = (managed.data.id.charCodeAt(managed.data.id.length - 1) % 5) * 40;
    this.scene.time.delayedCall(stagger, () => {
      if (!managed.sprite.active || managed.moving || managed.interrupt) return;
      this.nudgeToward(managed.data.id, target.x, target.y, 40);
    });
  }

  private commuteLabel(
    managed: ManagedSubject,
    slot: ScheduleSlot,
    site: ScheduleSite
  ): string {
    if (slot.activity === 'hunt') return 'Hunting across the wilds';
    if (slot.activity === 'sleep' || slot.activity === 'chamber') {
      return 'Heading home';
    }
    if (site.buildingId && this.buildings) {
      const b = this.buildings.getById(site.buildingId);
      if (b?.kind === 'field') return 'Walking to the fields';
      if (b?.kind === 'dock') return 'Walking to the docks';
      if (b?.kind === 'keep') return 'Marching to the keep';
      if (b?.kind === 'bakery') return 'Walking to the bakery';
      if (b?.kind === 'market') return 'Walking to the market';
    }
    if (slot.zone === 'field') return 'Walking to the fields';
    if (slot.zone === 'keep') return 'Marching to the keep';
    if (slot.zone === 'home') return 'Heading home';
    return managed.data.activityLabel || slot.label;
  }

  private static readonly MILITARY_PATROL_ROLES = new Set([
    'guard',
    'soldier',
    'archer',
    'elite_guard',
    'elite_archer',
    'knight',
  ]);

  /**
   * Patrol within the unit's loyalty keep territory (roads, civic posts, approaches).
   */
  private pickPatrolTarget(managed: ManagedSubject, fallback: Point): Point {
    if (!this.buildings) return fallback;
    if (!SubjectSystem.MILITARY_PATROL_ROLES.has(managed.data.role)) return fallback;
    const keepId =
      managed.data.loyaltyKeepId ??
      this.buildings.nearestKeepId(managed.sprite.x, managed.sprite.y) ??
      KEEP_ID;
    const origin =
      this.buildings.getKeepTargetPoint(keepId) ??
      this.buildings.getActiveKeepPoint();
    if (!origin) return fallback;

    if (Math.random() < 0.35) {
      const posts = this.buildings
        .list()
        .filter(
          (b) =>
            b.hp > 0 &&
            PATROL_INSPECTION_KINDS.includes(b.kind)
        );
      if (posts.length) {
        const idx = this.patrolInspectionIdx.get(managed.data.id) ?? 0;
        const post = posts[idx % posts.length]!;
        this.patrolInspectionIdx.set(managed.data.id, idx + 1);
        return { x: post.x, y: post.y };
      }
    }

    const roadPts = this.buildings.listRoadPoints();
    if (roadPts.length) {
      return roadPts[Math.floor(Math.random() * roadPts.length)]!;
    }

    // Houses / fields / docks including exclaves
    const civic = this.buildings
      .list()
      .filter(
        (b) =>
          b.hp > 0 &&
          (b.kind === 'house' ||
            b.kind === 'field' ||
            b.kind === 'dock' ||
            b.kind === 'manor')
      );
    if (civic.length) {
      const b = civic[Math.floor(Math.random() * civic.length)]!;
      return { x: b.x, y: b.y };
    }

    return this.buildings.keepTerritoryPoint(
      keepId,
      managed.sprite.x,
      managed.sprite.y
    );
  }

  private toSnapshot(managed: ManagedSubject): SubjectSnapshot {
    const spouse = managed.data.spouseId
      ? this.getById(managed.data.spouseId)
      : undefined;
    const mother = managed.data.motherId
      ? this.getById(managed.data.motherId)
      : undefined;
    const father = managed.data.fatherId
      ? this.getById(managed.data.fatherId)
      : undefined;
    const lineageParts: string[] = [];
    if (mother) lineageParts.push(`Mother: ${mother.data.name}`);
    if (father) lineageParts.push(`Father: ${father.data.name}`);

    return {
      id: managed.data.id,
      name: managed.data.name,
      role: managed.data.role,
      roleLabel: roleLabel(managed.data.role),
      genderLabel: genderLabel(managed.data.gender),
      activityLabel: managed.data.activityLabel,
      homeLabel: managed.data.houseId
        ? (this.buildings?.houseLabel(managed.data.houseId) ?? 'a house')
        : 'no house (orphaned)',
      scheduleSummary: scheduleSummary(managed.data.role, managed.data.job),
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
      canHuntMonster: managed.data.role === 'knight',
      subjectKind: 'subject',
      happiness: managed.data.happiness,
      ageYears: managed.data.ageYears,
      body: managed.data.body,
      thought: managed.data.thought,
      goal: managed.data.goal,
      goalLabel: managed.data.goal?.text ?? managed.data.goal?.kind,
      backstory: managed.data.backstory,
      lifeLog: managed.data.lifeLog,
      lineageLabel: lineageParts.length ? lineageParts.join(' · ') : undefined,
      pregnantLabel: managed.data.pregnant
        ? `Expecting (${managed.data.pregnantDaysLeft ?? '?'} days)`
        : undefined,
      spouseLabel: spouse?.data.name,
      jobLabel: jobDisplayLabel(managed),
      workplaceLabel: managed.data.workplaceId
        ? (this.buildings?.displayNameForId(managed.data.workplaceId) ??
          'a workplace')
        : 'No assigned workplace',
      roomLabel: this.roomLabelFor(managed),
      loyaltyLabel: this.buildings?.loyaltyLabelForKeep(
        managed.data.loyaltyKeepId
      ),
      familyAspiration: this.familyEvaluator
        ? mapFamilyAspiration(this.familyEvaluator(managed.data.id))
        : null,
      imprisoned: managed.interrupt?.kind === 'imprisoned',
      underArrest:
        managed.interrupt?.kind === 'under_arrest' ||
        managed.interrupt?.kind === 'imprisoned',
      inStocks:
        managed.interrupt?.kind === 'in_stocks' ||
        managed.interrupt?.kind === 'to_stocks',
    };
  }

  private roomLabelFor(managed: ManagedSubject): string | undefined {
    if (managed.data.zone !== 'keep') return undefined;
    const slot = slotAtHour(
      managed.data.role,
      this.clock.hour,
      managed.data.job
    );
    const room =
      slot.room ??
      (isCastleJob(managed.data.job)
        ? roomForCastleJob(managed.data.job)
        : defaultRoomForActivity(managed.data.activity, managed.data.role));
    return roomLabel(room);
  }
}

function jobDisplayLabel(managed: ManagedSubject): string {
  if (managed.data.job) {
    const label = jobLabel(managed.data.job);
    if (label) return label;
  }
  return roleLabel(managed.data.role);
}

/** Thieves reuse the bandit sheet (tinted) instead of a dedicated sprite. */
function textureKeyForSubject(
  data: Pick<
    Subject,
    'role' | 'gender' | 'ageYears' | 'job' | 'appearanceVariant' | 'legendId'
  >
): string {
  return resolveSubjectTexture({
    role: data.role,
    gender: data.gender,
    ageYears: data.ageYears,
    job: data.job,
    appearanceVariant: data.appearanceVariant,
    legendId: data.legendId,
  });
}

function mapFamilyAspiration(
  view: FamilyAspirationView | null
): SubjectSnapshot['familyAspiration'] {
  if (!view) return null;
  return {
    kind: view.kind,
    title: view.title,
    partnerName: view.partnerName,
    criteria: view.criteria,
    canGrant: view.canGrant,
    blockReason: view.blockReason,
    cost: view.cost,
  };
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

function bodyScaleX(body: BodyCondition): number {
  switch (body) {
    case 'gaunt':
      return 0.9;
    case 'plump':
      return 1.12;
    case 'obese':
      return 1.25;
    default:
      return 1;
  }
}

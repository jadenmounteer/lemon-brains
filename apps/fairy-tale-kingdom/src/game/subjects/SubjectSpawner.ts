import Phaser from 'phaser';
import {
  idleAnimKey,
  livesAtKeep,
  UNIT_HEIGHT,
  UNIT_WIDTH,
  type UnitRole,
} from '../art/assetManifest';
import { KEEP_ID, type BuildingSystem } from '../buildings/BuildingSystem';
import { UNIT_MAX_HP } from '../combat/stats';
import { Phase12Balance } from '../economy/phase12Balance';
import {
  BUILDING_ROLE_CAPACITY,
  civilianJobForBuilding,
  roleFromCareerGoal,
  type CivilianJob,
} from '../jobs/capacities';
import {
  ROYAL_SLOTS_PER_KEEP,
  type BuildKind,
} from '../../marketplace/catalog';
import { TRAINABLE_ROLES } from '../../marketplace/rules';
import { getSandboxRuntime } from '../sandboxRuntime';
import { appendLifeLog as appendLifeLogEntry } from '../thoughts/lifeLog';
import { appearanceTint, resolveSubjectTexture } from '../art/resolveSubjectTexture';
import { FAMILY_GOAL_MARRY } from '../family/familyGoals';
import { KingdomEvents } from './events';
import { genderForNewSubject } from './gender';
import { LEGEND_VILLAGERS } from './legendVillagers';
import { pickName } from './names';
import { roleLabel, slotAtHour } from './schedules';
import type {
  BodyCondition,
  CurseKind,
  Subject,
  SubjectGoal,
  SubjectInterrupt,
} from './types';
import type { ManagedSubject } from './managedSubject';
import type { SubjectRegistry } from './SubjectRegistry';
import { randomPointInZone, type Point, type WorldBounds } from './zones';

const SEED_ROLES: UnitRole[] = [
  'peasant',
  'peasant',
  'guard',
  'guard',
  'archer',
  'archer',
];

export type SubjectSpawnerDeps = {
  scene: Phaser.Scene;
  world: WorldBounds;
  registry: SubjectRegistry;
  getBuildings: () => BuildingSystem | null;
  getClockHour: () => number;
  getDaysPlayed: () => number;
  snapToWalkable: (x: number, y: number) => Point;
  homePointFor: (houseId: string) => Point | null;
  assignLoyalty: (managed: ManagedSubject) => void;
  bindWorkplace: (managed: ManagedSubject, role: UnitRole) => void;
  applyHpTint: (managed: ManagedSubject) => void;
  applyBodyScale: (managed: ManagedSubject) => void;
  nudgeTowardSchedule: (managed: ManagedSubject) => void;
  roleAtBuildingCap: (role: UnitRole) => boolean;
  openCastleJob: (exceptId?: string, preferred?: CivilianJob) => CivilianJob | null;
  transformRole: (
    id: string,
    role: UnitRole,
    opts?: { temporaryPrincess?: boolean; married?: boolean }
  ) => boolean;
  notifyChanged: () => void;
  linkRoyalSpouses: () => void;
};

function randomAdultAge(): number {
  return Math.random() < 0.85
    ? 18 + Math.floor(Math.random() * 27)
    : 55 + Math.floor(Math.random() * 18);
}

function appearanceVariantForSeed(seed: number): 0 | 1 | 2 | 3 | 4 | 5 {
  return (seed % 6) as 0 | 1 | 2 | 3 | 4 | 5;
}

function defaultAgeYears(role: UnitRole): number {
  if (role === 'child') return 8;
  if (
    role === 'king' ||
    role === 'queen' ||
    role === 'duke' ||
    role === 'duchess' ||
    role === 'bishop' ||
    role === 'fairy_godmother' ||
    role === 'witch'
  ) {
    return 48 + Math.floor(Math.random() * 22);
  }
  if (role === 'peasant') return randomAdultAge();
  return 25;
}

/** Hire, seed, promote, camp allegiance, createSubject. */
export class SubjectSpawner {
  constructor(private readonly deps: SubjectSpawnerDeps) {}

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
    this.deps.registry.nextId = SEED_ROLES.length;
  }

  hire(role: UnitRole): boolean {
    const buildings = this.deps.getBuildings();
    if (!buildings) return false;
    if (getSandboxRuntime().units.kinds[role] === false) {
      this.toast(`${roleLabel(role)} hiring is off in sandbox settings`);
      return false;
    }
    if (role === 'fairy_godmother' && this.deps.registry.hasRole(role)) {
      this.toast(`You already have a ${roleLabel(role)}`);
      return false;
    }
    if (role === 'bishop' && this.deps.registry.hasRole('bishop')) {
      this.toast('You already have a Bishop');
      return false;
    }
    if (role === 'king' || role === 'queen') {
      if (this.deps.registry.countRole(role) >= 1) {
        this.toast(`The realm already has a ${roleLabel(role)}`);
        return false;
      }
    }
    if (role === 'duke' || role === 'duchess') {
      if (buildings.keepCount() < 2) {
        this.toast(`Need a second keep to seat a ${roleLabel(role)}`);
        return false;
      }
    }
    if (role === 'guard' && !buildings.hasDungeon()) {
      this.toast('Build a dungeon before hiring guards');
      return false;
    }
    if (
      (role === 'soldier' ||
        role === 'archer' ||
        role === 'knight' ||
        role === 'general' ||
        role === 'elite_guard' ||
        role === 'elite_archer') &&
      !buildings.hasBarracks()
    ) {
      this.toast('Build a barracks before hiring that troop');
      return false;
    }
    if (this.deps.roleAtBuildingCap(role)) {
      this.toast(`No free posts for a ${roleLabel(role)} — expand capacity`);
      return false;
    }

    let houseId: string | null = null;
    if (livesAtKeep(role)) {
      houseId = buildings.pickKeepForHire(this.deps.registry.royalCounts());
      if (!houseId) {
        this.toast('No free royal chambers — build another keep');
        return false;
      }
    } else {
      houseId = buildings.pickHouseForHire(
        this.deps.registry.occupantCounts((id) =>
          Boolean(buildings.getHousePoint(id))
        )
      );
      if (!houseId) {
        this.toast('No free beds — build a house first');
        return false;
      }
    }
    const id = `subject-${this.deps.registry.nextId++}`;
    const name =
      role === 'prince'
        ? pickName(9000 + this.deps.registry.nextId * 17)
        : pickName(2000 + this.deps.registry.nextId * 41);
    this.createSubject(role, houseId, id, name);
    const managed = this.deps.registry.all[this.deps.registry.all.length - 1]!;
    this.deps.assignLoyalty(managed);
    this.deps.bindWorkplace(managed, role);
    this.deps.scene.time.delayedCall(200, () =>
      this.deps.nudgeTowardSchedule(managed)
    );
    if (role === 'king' || role === 'queen') {
      this.deps.linkRoyalSpouses();
    }
    this.deps.notifyChanged();
    return true;
  }

  /** Cross-household singles + elder couple + legend villagers for new kingdoms. */
  seedStarterFamilies(houseIds: string[]): void {
    if (houseIds.length < 2) return;

    const [house0, house1, house2] = houseIds;
    const maleId = `subject-${this.deps.registry.nextId++}`;
    const femaleId = `subject-${this.deps.registry.nextId++}`;

    this.createSubject('peasant', house0!, maleId, pickName(301), {
      gender: 'male',
      ageYears: 20 + Math.floor(Math.random() * 8),
      appearanceVariant: 0,
      happiness: 68,
      skipBirthLog: true,
    });
    this.createSubject('peasant', house1!, femaleId, pickName(302), {
      gender: 'female',
      ageYears: 19 + Math.floor(Math.random() * 8),
      appearanceVariant: 1,
      happiness: 68,
      skipBirthLog: true,
    });

    const male = this.deps.registry.getById(maleId)!;
    const female = this.deps.registry.getById(femaleId)!;
    const mName = male.data.name.split(',')[0]!;
    const fName = female.data.name.split(',')[0]!;
    male.data.goal = {
      kind: FAMILY_GOAL_MARRY,
      targetId: femaleId,
      text: `I wish to marry ${fName}.`,
    };
    female.data.goal = {
      kind: FAMILY_GOAL_MARRY,
      targetId: maleId,
      text: `I wish to marry ${mName}.`,
    };

    if (house2) {
      const elderMId = `subject-${this.deps.registry.nextId++}`;
      const elderFId = `subject-${this.deps.registry.nextId++}`;
      this.createSubject('peasant', house2, elderMId, pickName(303), {
        gender: 'male',
        ageYears: 61,
        appearanceVariant: 4,
        married: true,
        skipBirthLog: true,
      });
      this.createSubject('peasant', house2, elderFId, pickName(304), {
        gender: 'female',
        ageYears: 59,
        appearanceVariant: 2,
        married: true,
        spouseId: elderMId,
        skipBirthLog: true,
      });
      const elderM = this.deps.registry.getById(elderMId)!;
      elderM.data.spouseId = elderFId;
      elderM.data.married = true;
    }

    const legendHomes = [house0!, house1!];
    for (let i = 0; i < Math.min(2, LEGEND_VILLAGERS.length); i++) {
      const legend = LEGEND_VILLAGERS[i]!;
      const id = `subject-${this.deps.registry.nextId++}`;
      this.createSubject('peasant', legendHomes[i]!, id, legend.name, {
        gender: legend.gender,
        ageYears: legend.ageYears,
        job: legend.job,
        appearanceVariant: legend.appearanceVariant,
        legendId: legend.id,
        backstory: legend.backstory,
        happiness: 72,
        skipBirthLog: true,
      });
    }

    this.deps.notifyChanged();
  }

  hireAtBuilding(
    buildingId: string,
    role: UnitRole,
    opts?: { castleJob?: CivilianJob }
  ): boolean {
    const buildings = this.deps.getBuildings();
    if (!buildings) return false;

    const target = this.resolveTrainBuilding(buildings, buildingId);
    if (!target) {
      this.toast('That building is unavailable');
      return false;
    }

    const trainable = TRAINABLE_ROLES[target.kind];
    if (!trainable?.includes(role)) {
      this.toast(`Cannot train a ${roleLabel(role)} here`);
      return false;
    }

    if (getSandboxRuntime().units.kinds[role] === false) {
      this.toast(`${roleLabel(role)} hiring is off in sandbox settings`);
      return false;
    }
    if (role === 'fairy_godmother' && this.deps.registry.hasRole(role)) {
      this.toast(`You already have a ${roleLabel(role)}`);
      return false;
    }
    if (role === 'bishop' && this.deps.registry.hasRole('bishop')) {
      this.toast('You already have a Bishop');
      return false;
    }
    if (role === 'king' || role === 'queen') {
      if (this.deps.registry.countRole(role) >= 1) {
        this.toast(`The realm already has a ${roleLabel(role)}`);
        return false;
      }
    }
    if (role === 'duke' || role === 'duchess') {
      if (buildings.keepCount() < 2) {
        this.toast(`Need a second keep to seat a ${roleLabel(role)}`);
        return false;
      }
    }
    if (this.roleAtBuildingCapFor(target.id, target.kind, role)) {
      this.toast(`No free posts for a ${roleLabel(role)} at this building`);
      return false;
    }
    if (this.deps.roleAtBuildingCap(role)) {
      this.toast(`No free posts for a ${roleLabel(role)} — expand capacity`);
      return false;
    }
    if (
      role === 'peasant' &&
      target.kind === 'keep' &&
      !this.deps.openCastleJob(undefined, opts?.castleJob)
    ) {
      this.toast('No open castle staff posts at this keep');
      return false;
    }

    let houseId: string | null = null;
    if (livesAtKeep(role)) {
      if (target.kind === 'keep') {
        houseId = target.id;
        const used = this.deps.registry.royalCounts().get(houseId) ?? 0;
        if (used >= ROYAL_SLOTS_PER_KEEP) {
          this.toast('No free royal chambers at this keep');
          return false;
        }
      } else {
        houseId = buildings.pickKeepForHire(this.deps.registry.royalCounts());
        if (!houseId) {
          this.toast('No free royal chambers — build another keep');
          return false;
        }
      }
    } else {
      const occupantCounts = this.deps.registry.occupantCounts((id) =>
        Boolean(buildings.getHousePoint(id))
      );
      if (
        (target.kind === 'house' || target.kind === 'manor') &&
        !livesAtKeep(role)
      ) {
        const used = occupantCounts.get(target.id) ?? 0;
        const cap = buildings.bedsFor(target.kind);
        if (used >= cap) {
          this.toast('No free beds at this house');
          return false;
        }
        houseId = target.id;
      } else {
        houseId = buildings.pickHouseForHire(occupantCounts);
        if (!houseId) {
          this.toast('No free beds — build a house first');
          return false;
        }
      }
    }

    const spawnPt = buildings.spawnPoint(target.id);
    if (!spawnPt) {
      this.toast('Cannot spawn units at that building right now');
      return false;
    }
    const loyaltyKeepId = buildings.keepForBuilding(target.id);

    const id = `subject-${this.deps.registry.nextId++}`;
    const name =
      role === 'prince'
        ? pickName(9000 + this.deps.registry.nextId * 17)
        : pickName(2000 + this.deps.registry.nextId * 41);

    this.createSubject(role, houseId, id, name, {
      spawnAt: spawnPt,
      loyaltyKeepId: loyaltyKeepId ?? undefined,
      workplaceId: target.id,
    });

    const managed = this.deps.registry.getById(id)!;
    managed.data.workplaceId = target.id;
    if (role === 'peasant' && target.kind === 'keep') {
      const castleJob =
        opts?.castleJob ?? this.deps.openCastleJob(managed.data.id);
      if (castleJob) managed.data.job = castleJob;
    } else {
      const job = civilianJobForBuilding(target.kind);
      if (job) managed.data.job = job;
    }

    this.deps.scene.time.delayedCall(200, () =>
      this.deps.nudgeTowardSchedule(managed)
    );
    this.deps.notifyChanged();
    return true;
  }

  promoteCareer(subjectId: string, role: UnitRole): boolean {
    const managed = this.deps.registry.getById(subjectId);
    if (!managed) return false;
    const from = managed.data.role;
    const allowed =
      from === 'peasant' ||
      from === 'guard' ||
      from === 'elite_guard' ||
      from === 'soldier';
    if (!allowed) return false;
    const buildings = this.deps.getBuildings();
    if (!buildings) return false;
    if (role === 'guard' && !buildings.hasDungeon()) return false;
    if (
      (role === 'soldier' ||
        role === 'archer' ||
        role === 'knight' ||
        role === 'general' ||
        role === 'elite_guard' ||
        role === 'elite_archer') &&
      !buildings.hasBarracks()
    ) {
      return false;
    }
    if (this.deps.roleAtBuildingCap(role) && role !== from) return false;
    const ok = this.deps.transformRole(subjectId, role, {
      temporaryPrincess: false,
      married: managed.data.married,
    });
    if (!ok) return false;
    managed.data.goal = null;
    this.deps.bindWorkplace(managed, role);
    if (role === 'king' || role === 'queen') {
      this.deps.linkRoyalSpouses();
    }
    this.deps.notifyChanged();
    return true;
  }

  listCareerTodos() {
    const todos = [];
    for (const s of this.deps.registry.all) {
      if (!s.data.goal) continue;
      const targetRole = roleFromCareerGoal(s.data.goal.kind);
      if (!targetRole) continue;
      todos.push({
        subjectId: s.data.id,
        name: s.data.name,
        targetRole,
        targetLabel: roleLabel(targetRole),
        cost: Phase12Balance.careerCosts[targetRole] ?? 0,
      });
    }
    return todos;
  }

  createSubject(
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
      happiness?: number;
      ageYears?: number;
      body?: BodyCondition;
      job?: CivilianJob;
      workplaceId?: string;
      spouseId?: string;
      motherId?: string;
      fatherId?: string;
      pregnant?: boolean;
      pregnantDaysLeft?: number;
      thought?: string;
      backstory?: string;
      goal?: SubjectGoal | null;
      lifeLog?: Subject['lifeLog'];
      curse?: CurseKind;
      cursedAsRole?: UnitRole;
      lowHappyHours?: number;
      activity?: Subject['activity'];
      activityLabel?: string;
      zone?: Subject['zone'];
      interrupt?: SubjectInterrupt | null;
      skipBirthLog?: boolean;
      campId?: string | null;
      allegiance?: Subject['allegiance'];
      loyaltyKeepId?: string | null;
      spawnAt?: Point;
      pendingChildHouseId?: string;
      appearanceVariant?: 0 | 1 | 2 | 3 | 4 | 5;
      legendId?: string;
    }
  ): void {
    const slot = slotAtHour(role, this.deps.getClockHour(), opts?.job);
    const home = this.deps.homePointFor(houseId);
    const rawStart =
      opts?.spawnAt ?? randomPointInZone(slot.zone, this.deps.world, home);
    const start = this.deps.snapToWalkable(rawStart.x, rawStart.y);
    const maxHp = opts?.maxHp ?? UNIT_MAX_HP[role];
    const hp = opts?.hp ?? maxHp;
    const hunger = opts?.hunger ?? 0;
    const seed = Number(id.replace(/\D/g, '')) || 1;
    const gender = opts?.gender ?? genderForNewSubject(role, name, seed);
    const ageYears = opts?.ageYears ?? defaultAgeYears(role);
    const body = opts?.body ?? 'average';
    const happiness = opts?.happiness ?? 60;
    const appearanceVariant =
      opts?.appearanceVariant ?? appearanceVariantForSeed(seed);

    const texKey = resolveSubjectTexture({
      role,
      gender,
      ageYears,
      job: opts?.job,
      appearanceVariant,
      legendId: opts?.legendId,
    });
    const sprite = this.deps.scene.add.sprite(start.x, start.y, texKey, 0);
    sprite.setDepth(20);
    sprite.setOrigin(0.5, 1);
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(-6, -4, UNIT_WIDTH + 12, UNIT_HEIGHT + 8),
      Phaser.Geom.Rectangle.Contains
    );
    sprite.input!.cursor = 'pointer';
    sprite.setData('subjectId', id);
    sprite.play(idleAnimKey(texKey));
    const variantTint = appearanceTint(appearanceVariant);
    if (variantTint && variantTint !== 0xffffff) {
      sprite.setTint(variantTint);
    }

    let lifeLog = opts?.lifeLog;
    if (!opts?.skipBirthLog && !lifeLog?.length) {
      const birthText =
        role === 'child'
          ? `${name} was born`
          : `${name} joined the kingdom as a ${roleLabel(role)}`;
      lifeLog = appendLifeLogEntry(
        [],
        this.deps.getDaysPlayed(),
        birthText,
        role === 'child' ? 'birth' : 'hire'
      );
    }

    const data: Subject = {
      id,
      name,
      role,
      gender,
      houseId,
      activity: opts?.activity ?? slot.activity,
      activityLabel: opts?.activityLabel ?? slot.label,
      zone: opts?.zone ?? slot.zone,
      hp,
      maxHp,
      onWall: Boolean(opts?.onWall),
      hunger,
      sick: false,
      temporaryPrincess: Boolean(opts?.temporaryPrincess),
      married: Boolean(opts?.married),
      happiness,
      ageYears,
      body,
      job: opts?.job,
      workplaceId: opts?.workplaceId,
      spouseId: opts?.spouseId,
      motherId: opts?.motherId,
      fatherId: opts?.fatherId,
      pregnant: opts?.pregnant,
      pregnantDaysLeft: opts?.pregnantDaysLeft,
      thought: opts?.thought ?? 'Looking around the kingdom…',
      backstory: opts?.backstory,
      goal: opts?.goal ?? null,
      lifeLog,
      curse: opts?.curse ?? null,
      cursedAsRole: opts?.cursedAsRole,
      lowHappyHours: opts?.lowHappyHours ?? 0,
      campId: opts?.campId ?? null,
      allegiance: opts?.allegiance ?? 'kingdom',
      loyaltyKeepId: opts?.loyaltyKeepId ?? null,
      pendingChildHouseId: opts?.pendingChildHouseId,
      appearanceVariant,
      legendId: opts?.legendId,
    };

    const managed: ManagedSubject = {
      data,
      sprite,
      moving: false,
      presenceAnim: null,
      presenceBlurbMs: 2000 + Math.random() * 4000,
      fleeCooldownMs: 0,
      interrupt: opts?.interrupt ?? null,
    };
    this.deps.applyHpTint(managed);
    this.deps.applyBodyScale(managed);
    this.deps.registry.push(managed);
    if (opts?.loyaltyKeepId == null && data.allegiance !== 'camp') {
      this.deps.assignLoyalty(managed);
    }
  }

  spawnCampMember(
    campId: string,
    role: UnitRole,
    name: string,
    opts?: { away?: boolean }
  ): string {
    const id = `camp-${campId}-${this.deps.registry.nextId++}`;
    this.createSubject(role, `camp:${campId}`, id, name, {
      allegiance: 'camp',
      campId,
      skipBirthLog: true,
    });
    const managed = this.deps.registry.getById(id);
    if (managed && opts?.away) {
      managed.sprite.setVisible(false);
    }
    return id;
  }

  private resolveTrainBuilding(
    buildings: BuildingSystem,
    buildingId: string
  ): { id: string; kind: BuildKind } | null {
    if (buildingId === KEEP_ID) {
      if (buildings.getKeepHp() <= 0) return null;
      return { id: KEEP_ID, kind: 'keep' };
    }
    const b = buildings.getById(buildingId);
    if (!b || b.hp <= 0) return null;
    return { id: b.id, kind: b.kind };
  }

  private roleAtBuildingCapFor(
    buildingId: string,
    kind: BuildKind,
    role: UnitRole
  ): boolean {
    const caps = BUILDING_ROLE_CAPACITY[kind];
    const cap = caps?.[role];
    if (cap == null) return false;
    const used = this.deps.registry.all.filter(
      (s) => s.data.workplaceId === buildingId && s.data.role === role
    ).length;
    return used >= cap;
  }

  private toast(message: string): void {
    this.deps.scene.game.events.emit(KingdomEvents.MARKET_TOAST, { message });
  }
}

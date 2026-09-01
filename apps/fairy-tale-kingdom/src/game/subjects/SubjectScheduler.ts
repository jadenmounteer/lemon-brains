import Phaser from 'phaser';
import type { BuildKind } from '../../marketplace/catalog';
import {
  KEEP_ID,
  type BuildingRecord,
  type BuildingSystem,
} from '../buildings/BuildingSystem';
import { bakeryKneadPoint } from '../buildings/layouts/BakeryLayout';
import { dungeonPatrolPoint } from '../buildings/layouts/DungeonLayout';
import { marketMerchantPoint } from '../buildings/layouts/MarketLayout';
import {
  BUILDING_ROLE_CAPACITY,
  isCastleJob,
} from '../jobs/capacities';
import {
  defaultRoomForActivity,
  roomForCastleJob,
  roomPoint,
  type KeepRoomId,
} from '../keep/KeepLayout';
import type { MonsterSystem } from '../monsters/MonsterSystem';
import type { EncampmentSystem } from '../war/EncampmentSystem';
import type { UnitRole } from '../art/assetManifest';
import { slotAtHour } from './schedules';
import type { ManagedSubject } from './managedSubject';
import type { ActivityId, ScheduleSlot, ZoneId } from './types';
import { randomPointInZone, type Point, type WorldBounds } from './zones';

export type ScheduleSite = {
  x: number;
  y: number;
  sticky: boolean;
  mode: 'sleep' | 'work' | 'zone';
  buildingId?: string;
};

const ZONE_BUILDING: Partial<Record<ZoneId, BuildKind>> = {
  cathedral: 'cathedral',
  infirmary: 'infirmary',
  dungeon: 'dungeon',
  tavern: 'tavern',
  barracks: 'barracks',
  gallows: 'gallows',
  cemetery: 'cemetery',
  field: 'field',
};

const PATROL_INSPECTION_KINDS: BuildKind[] = [
  'market',
  'cathedral',
  'infirmary',
  'tavern',
  'bakery',
  'granary',
  'cemetery',
  'gallows',
];

const MILITARY_PATROL_ROLES = new Set<UnitRole>([
  'guard',
  'soldier',
  'archer',
  'elite_guard',
  'elite_archer',
  'knight',
]);

export type SubjectSchedulerDeps = {
  world: WorldBounds;
  getBuildings: () => BuildingSystem | null;
  getEncampments: () => EncampmentSystem | null;
  getMonsters: () => MonsterSystem | null;
  getClockHour: () => number;
  getSubjects: () => ManagedSubject[];
  snapToWalkable: (x: number, y: number) => Point;
  homePointFor: (houseId: string) => Point | null;
  standPointAt: (
    x: number,
    y: number,
    groupKey: string,
    subjectId: string,
    opts?: { indoor?: boolean; radius?: number }
  ) => Point;
  sleepBedPoint: (managed: ManagedSubject) => Point | null;
  getPatrolInspectionIdx: (id: string) => number;
  setPatrolInspectionIdx: (id: string, idx: number) => void;
};

/** Schedule resolution, slotAtHour usage, fief-filtered site picking. */
export class SubjectScheduler {
  constructor(private readonly deps: SubjectSchedulerDeps) {}

  slotFor(managed: ManagedSubject): ScheduleSlot {
    return slotAtHour(
      managed.data.role,
      this.deps.getClockHour(),
      managed.data.job
    );
  }

  syncActivities(clearActivityAnim: (managed: ManagedSubject) => void): void {
    for (const managed of this.deps.getSubjects()) {
      if (managed.interrupt) continue;
      if (
        managed.data.activity === 'ball' ||
        managed.data.activity === 'festival' ||
        managed.data.activity === 'joust' ||
        managed.data.activity === 'flee'
      ) {
        continue;
      }
      const prev = managed.data.activity;
      const slot = this.slotFor(managed);
      managed.data.activity = slot.activity;
      managed.data.activityLabel = slot.label;
      managed.data.zone = slot.zone;
      if (
        slot.activity !== 'sleep' &&
        slot.activity !== 'chamber' &&
        (prev === 'sleep' ||
          prev === 'chamber' ||
          managed.presenceAnim === 'sleep')
      ) {
        clearActivityAnim(managed);
      } else if (prev !== slot.activity && managed.presenceAnim) {
        clearActivityAnim(managed);
      }
    }
  }

  isStickyActivity(activity: ActivityId): boolean {
    return (
      activity === 'sleep' ||
      activity === 'work' ||
      activity === 'harvest' ||
      activity === 'heal' ||
      activity === 'train' ||
      activity === 'juggle' ||
      activity === 'execute' ||
      activity === 'gather' ||
      activity === 'cook' ||
      activity === 'knead' ||
      activity === 'serve' ||
      activity === 'clean' ||
      activity === 'court' ||
      activity === 'feast' ||
      activity === 'study' ||
      activity === 'chamber'
    );
  }

  resolveScheduleSite(
    managed: ManagedSubject,
    slot: ScheduleSlot
  ): ScheduleSite {
    const home = this.deps.homePointFor(managed.data.houseId);
    const rawFallback = randomPointInZone(slot.zone, this.deps.world, home);
    const fallback = this.deps.snapToWalkable(rawFallback.x, rawFallback.y);
    const buildings = this.deps.getBuildings();

    if (managed.data.allegiance === 'camp' && managed.data.campId) {
      if (slot.activity === 'sleep' && home) {
        const pt = this.deps.standPointAt(
          home.x,
          home.y,
          managed.data.houseId,
          managed.data.id,
          { radius: 16 }
        );
        return { ...pt, sticky: true, mode: 'sleep' };
      }
      const wander = this.pickCampWanderTarget(
        managed.data.campId,
        home,
        fallback
      );
      return { ...wander, sticky: false, mode: 'zone' };
    }

    if (slot.activity === 'sleep' || slot.activity === 'chamber') {
      if (slot.activity === 'chamber' && buildings) {
        const keepId =
          managed.data.loyaltyKeepId ?? managed.data.houseId ?? KEEP_ID;
        const keep =
          buildings.getById(keepId) ?? buildings.getById(KEEP_ID);
        if (keep) {
          const pt = roomPoint(keep, 'chambers', managed.data.id);
          return {
            ...pt,
            sticky: true,
            mode: 'sleep',
            buildingId: keep.id,
          };
        }
      }
      const bed = this.deps.sleepBedPoint(managed);
      if (bed) {
        return { ...bed, sticky: true, mode: 'sleep' };
      }
      return { ...fallback, sticky: true, mode: 'sleep' };
    }

    if (slot.activity === 'hunt') {
      const hunt = this.resolveHuntTarget(managed);
      if (hunt) {
        return { ...hunt, sticky: true, mode: 'zone' };
      }
    }

    if (slot.activity === 'patrol') {
      if (slot.zone === 'dungeon' && buildings) {
        const dungeon = this.pickBuildingOfKind('dungeon', managed);
        if (dungeon) {
          const idx = this.deps.getPatrolInspectionIdx(managed.data.id) ?? 0;
          const pt = dungeonPatrolPoint(dungeon, idx, managed.data.id);
          this.deps.setPatrolInspectionIdx(managed.data.id, idx + 1);
          return { ...pt, sticky: false, mode: 'zone', buildingId: dungeon.id };
        }
      }
      const patrol = this.pickPatrolTarget(managed, fallback);
      return { ...patrol, sticky: false, mode: 'zone' };
    }

    if (slot.zone === 'keep' && buildings) {
      const keepId =
        managed.data.loyaltyKeepId ??
        (managed.data.workplaceId &&
        buildings.getById(managed.data.workplaceId)?.kind === 'keep'
          ? managed.data.workplaceId
          : KEEP_ID);
      const keep = buildings.getById(keepId) ?? buildings.getById(KEEP_ID);
      if (keep) {
        const room: KeepRoomId =
          slot.room ??
          (isCastleJob(managed.data.job)
            ? roomForCastleJob(managed.data.job)
            : defaultRoomForActivity(slot.activity, managed.data.role));
        const pt = roomPoint(keep, room, managed.data.id);
        const sticky =
          this.isStickyActivity(slot.activity) ||
          slot.activity === 'idle_keep' ||
          slot.activity === 'eat';
        return {
          x: pt.x,
          y: pt.y,
          sticky,
          mode: sticky ? 'work' : 'zone',
          buildingId: keep.id,
        };
      }
    }

    if (managed.data.workplaceId && buildings) {
      const b = buildings.getById(managed.data.workplaceId);
      if (b && this.isStickyActivity(slot.activity)) {
        if (b.kind === 'keep') {
          const room: KeepRoomId =
            slot.room ??
            (isCastleJob(managed.data.job)
              ? roomForCastleJob(managed.data.job)
              : defaultRoomForActivity(slot.activity, managed.data.role));
          const pt = roomPoint(b, room, managed.data.id);
          return {
            ...pt,
            sticky: true,
            mode: 'work',
            buildingId: b.id,
          };
        }
        const anchor = this.workplaceAnchor(b, managed);
        if (anchor) {
          return {
            ...anchor,
            sticky: true,
            mode: 'work',
            buildingId: b.id,
          };
        }
        const outdoor =
          b.kind === 'field' ||
          b.kind === 'dock' ||
          b.kind === 'gallows' ||
          b.kind === 'road' ||
          b.kind === 'bridge';
        const pt = this.deps.standPointAt(b.x, b.y, b.id, managed.data.id, {
          indoor: !outdoor,
          radius: outdoor ? 20 : 14,
        });
        return {
          ...pt,
          sticky: true,
          mode: 'work',
          buildingId: b.id,
        };
      }
    }

    if (this.isStickyActivity(slot.activity) && buildings) {
      const roleB = this.nearestCapacityBuilding(managed);
      if (roleB) {
        const outdoor =
          roleB.kind === 'field' ||
          roleB.kind === 'dock' ||
          roleB.kind === 'gallows';
        const pt = this.deps.standPointAt(
          roleB.x,
          roleB.y,
          roleB.id,
          managed.data.id,
          { indoor: !outdoor, radius: 16 }
        );
        return {
          ...pt,
          sticky: true,
          mode: 'work',
          buildingId: roleB.id,
        };
      }
    }

    const zoneKind = ZONE_BUILDING[slot.zone];
    if (zoneKind && buildings && this.isStickyActivity(slot.activity)) {
      const b = this.pickBuildingOfKind(zoneKind, managed);
      if (b) {
        const outdoor = zoneKind === 'field' || zoneKind === 'gallows';
        const pt = this.deps.standPointAt(b.x, b.y, b.id, managed.data.id, {
          indoor: !outdoor,
          radius: 16,
        });
        return {
          ...pt,
          sticky: true,
          mode: 'work',
          buildingId: b.id,
        };
      }
    }

    if (
      slot.zone === 'field' &&
      (slot.activity === 'work' || slot.activity === 'train') &&
      buildings
    ) {
      const field = this.nearestFieldInFief(managed);
      if (field) {
        const pt = this.deps.standPointAt(
          field.x,
          field.y,
          field.id,
          managed.data.id,
          { radius: 20 }
        );
        return {
          ...pt,
          sticky: true,
          mode: 'work',
          buildingId: field.id,
        };
      }
    }

    return { ...fallback, sticky: false, mode: 'zone' };
  }

  private loyaltyKeepId(managed: ManagedSubject): string {
    const buildings = this.deps.getBuildings();
    return (
      managed.data.loyaltyKeepId ??
      buildings?.nearestKeepId(managed.sprite.x, managed.sprite.y) ??
      KEEP_ID
    );
  }

  private nearestCapacityBuilding(
    managed: ManagedSubject
  ): BuildingRecord | null {
    const buildings = this.deps.getBuildings();
    if (!buildings) return null;
    const role = managed.data.role;
    const keepId = this.loyaltyKeepId(managed);
    let best: BuildingRecord | null = null;
    let bestD = Infinity;
    for (const b of buildings.list()) {
      if (b.hp <= 0) continue;
      const caps = BUILDING_ROLE_CAPACITY[b.kind as BuildKind];
      if (caps?.[role] == null) continue;
      const inFief = buildings.inKeepTerritory(keepId, b.x, b.y);
      const d = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        b.x,
        b.y
      );
      const score = d + (inFief ? 0 : 5000);
      if (score < bestD) {
        bestD = score;
        best = b;
      }
    }
    return best;
  }

  private pickBuildingOfKind(
    kind: BuildKind,
    managed: ManagedSubject
  ): BuildingRecord | null {
    const buildings = this.deps.getBuildings();
    if (!buildings) return null;
    const keepId = this.loyaltyKeepId(managed);
    let best: BuildingRecord | null = null;
    let bestD = Infinity;
    for (const b of buildings.list()) {
      if (b.kind !== kind || b.hp <= 0) continue;
      const inFief = buildings.inKeepTerritory(keepId, b.x, b.y);
      const d = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        b.x,
        b.y
      );
      const score = d + (inFief ? 0 : 5000);
      if (score < bestD) {
        bestD = score;
        best = b;
      }
    }
    return best;
  }

  private nearestFieldInFief(managed: ManagedSubject): BuildingRecord | null {
    const buildings = this.deps.getBuildings();
    if (!buildings) return null;
    const keepId = this.loyaltyKeepId(managed);
    const inFief = buildings
      .list()
      .filter(
        (b) =>
          b.kind === 'field' &&
          b.hp > 0 &&
          buildings.inKeepTerritory(keepId, b.x, b.y)
      );
    if (inFief.length) {
      let best = inFief[0]!;
      let bestD = Infinity;
      for (const b of inFief) {
        const d = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          b.x,
          b.y
        );
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      return best;
    }
    return (
      buildings.nearestField(managed.sprite.x, managed.sprite.y) ??
      buildings.list().find((b) => b.kind === 'field' && b.hp > 0) ??
      null
    );
  }

  private pickCampWanderTarget(
    campId: string,
    home: Point | null,
    fallback: Point
  ): Point {
    const encampments = this.deps.getEncampments();
    if (!home || !encampments) return fallback;
    const radius = encampments.influenceRadius(
      encampments.getCampKind(campId) ?? 'bandit'
    );
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.8;
    return {
      x: home.x + Math.cos(angle) * dist,
      y: home.y + Math.sin(angle) * dist,
    };
  }

  private pickPatrolTarget(managed: ManagedSubject, fallback: Point): Point {
    const buildings = this.deps.getBuildings();
    if (!buildings) return fallback;
    if (!MILITARY_PATROL_ROLES.has(managed.data.role)) return fallback;
    const keepId = this.loyaltyKeepId(managed);
    const origin =
      buildings.getKeepTargetPoint(keepId) ?? buildings.getActiveKeepPoint();
    if (!origin) return fallback;

    if (Math.random() < 0.35) {
      const posts = buildings
        .list()
        .filter(
          (b) =>
            b.hp > 0 &&
            PATROL_INSPECTION_KINDS.includes(b.kind) &&
            buildings.inKeepTerritory(keepId, b.x, b.y)
        );
      if (posts.length) {
        const idx = this.deps.getPatrolInspectionIdx(managed.data.id) ?? 0;
        const post = posts[idx % posts.length]!;
        this.deps.setPatrolInspectionIdx(managed.data.id, idx + 1);
        return { x: post.x, y: post.y };
      }
    }

    const roadPts = buildings
      .listRoadPoints()
      .filter((p) => buildings.inKeepTerritory(keepId, p.x, p.y));
    if (roadPts.length) {
      return roadPts[Math.floor(Math.random() * roadPts.length)]!;
    }

    const civic = buildings
      .list()
      .filter(
        (b) =>
          b.hp > 0 &&
          (b.kind === 'house' ||
            b.kind === 'field' ||
            b.kind === 'dock' ||
            b.kind === 'manor') &&
          buildings.inKeepTerritory(keepId, b.x, b.y)
      );
    if (civic.length) {
      const b = civic[Math.floor(Math.random() * civic.length)]!;
      return { x: b.x, y: b.y };
    }

    return buildings.keepTerritoryPoint(
      keepId,
      managed.sprite.x,
      managed.sprite.y
    );
  }

  private resolveHuntTarget(
    managed: ManagedSubject
  ): { x: number; y: number } | null {
    const monsters = this.deps.getMonsters();
    if (!monsters) return null;
    if (managed.data.role === 'knight' || managed.data.role === 'witch_hunter') {
      const sleepers = monsters.sleepingDragons();
      let best: { kind: string; sprite: { x: number; y: number } } | null =
        null;
      let bestD = Infinity;
      for (const m of sleepers) {
        const d = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          m.sprite.x,
          m.sprite.y
        );
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (!best) {
        best = monsters.nearestMonster(
          managed.sprite.x,
          managed.sprite.y,
          5000
        );
      }
      if (best) {
        const kind = best.kind;
        managed.data.activityLabel =
          kind === 'dragon'
            ? 'Hunting a dragon'
            : kind === 'troll'
              ? 'Tracking a troll'
              : `Hunting a ${kind}`;
        return { x: best.sprite.x, y: best.sprite.y };
      }
    }
    return null;
  }

  private workplaceAnchor(
    building: BuildingRecord,
    managed: ManagedSubject
  ): Point | null {
    if (building.kind === 'bakery' && managed.data.job === 'baker') {
      return bakeryKneadPoint(building, managed.data.id);
    }
    if (building.kind === 'market' && managed.data.job === 'merchant') {
      return marketMerchantPoint(building, managed.data.id);
    }
    return null;
  }
}

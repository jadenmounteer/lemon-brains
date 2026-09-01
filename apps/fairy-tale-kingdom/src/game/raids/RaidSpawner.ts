import Phaser from 'phaser';
import { idleAnimKey } from '../art/assetManifest';
import { RAIDER_MAX_HP } from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import { WarBalance } from '../war/WarBalance';
import type {
  ActiveRaider,
  KeepPoint,
  RaidKind,
  RaiderState,
  StealKind,
} from './raidTypes';

export interface RaidSpawnerHost {
  scene: Phaser.Scene;
  pathGrid: PathGrid | null;
  raiders: ActiveRaider[];
  investPoint(index: number, total: number): KeepPoint;
}

/** Creates raider sprites and seeds their initial state. */
export class RaidSpawner {
  constructor(private readonly host: RaidSpawnerHost) {}

  launchRaider(
    kind: RaidKind,
    x: number,
    y: number,
    camp?: Phaser.GameObjects.Arc,
    index = 0,
    total = 1,
    home?: {
      homeCampId: string | null;
      homeX: number;
      homeY: number;
      stealKind: StealKind | null;
      aggroOnly: boolean;
      isGeneral?: boolean;
      siegeRole?: 'main' | 'field_raid';
      strategyFieldId?: string | null;
      rosterSubjectId?: string | null;
    },
    repath?: (raider: ActiveRaider) => void
  ): void {
    const sprite = this.host.scene.add.sprite(x, y, kind, 0);
    sprite.setDepth(25);
    sprite.setOrigin(0.5, 1);
    if (kind === 'giant') {
      sprite.setScale(2.35);
    } else if (kind === 'goblin') {
      sprite.setScale(0.85);
    }
    if (home?.isGeneral) {
      sprite.setTint(0xffd700);
    }
    sprite.play(idleAnimKey(kind));

    const maxHp = home?.isGeneral
      ? Math.floor(RAIDER_MAX_HP[kind] * WarBalance.leaderHpMult)
      : RAIDER_MAX_HP[kind];
    const invest = this.host.investPoint(index, total);
    const fieldRaid = home?.siegeRole === 'field_raid';
    const startState: RaiderState =
      kind === 'enemy_army'
        ? fieldRaid
          ? 'burning'
          : 'investing'
        : home?.aggroOnly
          ? 'fighting'
          : 'pathing';
    const rawHomeX = home?.homeX ?? x;
    const rawHomeY = home?.homeY ?? y;
    const homePt = this.host.pathGrid
      ? this.host.pathGrid.snapWorldToOpen(rawHomeX, rawHomeY)
      : { x: rawHomeX, y: rawHomeY };
    const raider: ActiveRaider = {
      kind,
      sprite,
      hp: maxHp,
      maxHp,
      path: [],
      pathIndex: 0,
      state: startState,
      targetSubjectId: null,
      targetBuildingId: fieldRaid ? home?.strategyFieldId ?? null : null,
      thinkAccumMs: 0,
      camp,
      investX: invest.x,
      investY: invest.y,
      homeCampId: home?.homeCampId ?? null,
      homeX: homePt.x,
      homeY: homePt.y,
      rosterSubjectId: home?.rosterSubjectId ?? null,
      stealKind: home?.stealKind ?? null,
      carriedGold: 0,
      looted: false,
      isGeneral: Boolean(home?.isGeneral),
      siegeRole: home?.siegeRole ?? 'main',
      strategyFieldId: home?.strategyFieldId ?? null,
      carriedSubjectId: null,
      feastMs: 0,
    };
    this.host.raiders.push(raider);
    if (kind !== 'enemy_army' && !home?.aggroOnly && repath) {
      repath(raider);
    }
  }
}

/** Sandbox edge spawn helper. */
export function sandboxRaidSpawnPoint(
  world: { width: number; height: number },
  pathGrid: PathGrid | null
): { x: number; y: number } {
  const pad = 48;
  const side = Phaser.Math.Between(0, 3);
  let x = pad;
  let y = pad;
  switch (side) {
    case 0:
      x = Phaser.Math.Between(pad, world.width - pad);
      y = pad;
      break;
    case 1:
      x = Phaser.Math.Between(pad, world.width - pad);
      y = world.height - pad;
      break;
    case 2:
      x = pad;
      y = Phaser.Math.Between(pad, world.height - pad);
      break;
    default:
      x = world.width - pad;
      y = Phaser.Math.Between(pad, world.height - pad);
      break;
  }
  if (pathGrid) {
    const snap = pathGrid.snapWorldToOpen(x, y);
    return { x: snap.x, y: snap.y };
  }
  return { x, y };
}

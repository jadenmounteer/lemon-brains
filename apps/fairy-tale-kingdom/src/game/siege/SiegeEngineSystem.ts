import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingRecord, BuildingSystem } from '../buildings/BuildingSystem';
import type { PathGrid } from '../path/PathGrid';
import { KingdomEvents } from '../subjects/events';
import {
  SiegeBalance,
  type EngineKind,
  enginesForRaidCount,
} from './balance';
import type { SiegeVfx } from './SiegeVfx';

export interface SiegeEngine {
  id: string;
  kind: EngineKind;
  sprite: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  cooldownMs: number;
  targetBuildingId: string | null;
  done: boolean;
}

const ENGINE_TEX: Record<EngineKind, string> = {
  ram: PROP_KEYS.ram,
  catapult: PROP_KEYS.catapult,
  trebuchet: PROP_KEYS.trebuchet,
};

const ENGINE_HP: Record<EngineKind, number> = {
  ram: SiegeBalance.ramHp,
  catapult: SiegeBalance.catapultHp,
  trebuchet: SiegeBalance.trebuchetHp,
};

export class SiegeEngineSystem {
  private engines: SiegeEngine[] = [];
  private nextId = 0;
  private buildings: BuildingSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private vfx: SiegeVfx | null = null;
  private onKill: (() => void) | null = null;
  private keep: { x: number; y: number } = { x: 0, y: 0 };

  constructor(private readonly scene: Phaser.Scene) {}

  setBuildings(b: BuildingSystem): void {
    this.buildings = b;
  }

  setPathGrid(g: PathGrid): void {
    this.pathGrid = g;
  }

  setVfx(v: SiegeVfx): void {
    this.vfx = v;
  }

  setKeep(keep: { x: number; y: number }): void {
    this.keep = keep;
  }

  setOnKill(cb: () => void): void {
    this.onKill = cb;
  }

  list(): SiegeEngine[] {
    return this.engines.filter((e) => !e.done && e.sprite.active);
  }

  countAlive(): number {
    return this.list().length;
  }

  spawnForRaid(raidCount: number, campX: number, campY: number): void {
    const kinds = enginesForRaidCount(raidCount);
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i]!;
      const x = campX + Phaser.Math.Between(-30, 30) + i * 18;
      const y = campY + Phaser.Math.Between(-20, 20);
      this.spawn(kind, x, y);
    }
  }

  spawn(kind: EngineKind, x: number, y: number): SiegeEngine {
    const maxHp = ENGINE_HP[kind];
    const sprite = this.scene.add
      .image(x, y, ENGINE_TEX[kind])
      .setDepth(24)
      .setOrigin(0.5, 0.85);
    const engine: SiegeEngine = {
      id: `engine-${this.nextId++}`,
      kind,
      sprite,
      hp: maxHp,
      maxHp,
      cooldownMs: 400 + Math.random() * 600,
      targetBuildingId: null,
      done: false,
    };
    this.engines.push(engine);
    return engine;
  }

  nearestEngine(x: number, y: number, radius: number): SiegeEngine | null {
    let best: SiegeEngine | null = null;
    let bestD = radius;
    for (const e of this.list()) {
      const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  damageEngine(engine: SiegeEngine, amount: number): boolean {
    if (engine.done || !engine.sprite.active) return false;
    engine.hp = Math.max(0, engine.hp - amount);
    const ratio = engine.hp / engine.maxHp;
    if (ratio <= 0.35) engine.sprite.setTint(0xff6666);
    this.vfx?.hitFlash(engine.sprite);
    if (engine.hp <= 0) {
      this.destroyEngine(engine, true);
      return true;
    }
    return false;
  }

  abandonAll(): void {
    for (const e of [...this.engines]) {
      if (!e.done) this.destroyEngine(e, false);
    }
  }

  clear(): void {
    for (const e of this.engines) {
      e.sprite.destroy();
    }
    this.engines = [];
  }

  update(deltaMs: number, storming: boolean, routing: boolean): void {
    if (routing) {
      this.abandonAll();
      return;
    }
    for (const engine of [...this.engines]) {
      if (engine.done || !engine.sprite.active) continue;
      engine.cooldownMs -= deltaMs;
      this.tickEngine(engine, storming, deltaMs);
    }
  }

  private tickEngine(
    engine: SiegeEngine,
    storming: boolean,
    deltaMs: number
  ): void {
    const range =
      engine.kind === 'ram'
        ? SiegeBalance.ramRange
        : engine.kind === 'catapult'
          ? SiegeBalance.catapultRange
          : SiegeBalance.trebuchetRange;

    let target = engine.targetBuildingId
      ? this.buildings?.getById(engine.targetBuildingId)
      : null;
    if (!target || target.hp <= 0) {
      target = this.pickTarget(engine, storming);
      engine.targetBuildingId = target?.id ?? null;
    }
    const step = (SiegeBalance.engineMoveSpeed * deltaMs) / 1000;

    if (!target) {
      this.stepToward(engine, this.keep.x, this.keep.y + 40, step);
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      engine.sprite.x,
      engine.sprite.y,
      target.x,
      target.y
    );

    if (engine.kind === 'ram') {
      if (dist > SiegeBalance.ramRange) {
        this.stepToward(engine, target.x, target.y, step);
        return;
      }
      if (engine.cooldownMs > 0) return;
      engine.cooldownMs = SiegeBalance.ramCooldownMs;
      this.vfx?.engineRecoil(engine.sprite, target.x, target.y);
      this.buildings?.shakeBuilding(target.id);
      const destroyed = this.buildings?.damageBuilding(
        target.id,
        SiegeBalance.ramDps
      );
      if (destroyed) {
        engine.targetBuildingId = null;
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'A battering ram smashed a fortification!',
        });
      }
      return;
    }

    // Ranged engines hold outside and lob
    const holdDist = range * 0.65;
    if (dist < holdDist - 20 && !storming) {
      const dx = engine.sprite.x - target.x;
      const dy = engine.sprite.y - target.y;
      const len = Math.hypot(dx, dy) || 1;
      this.stepToward(
        engine,
        engine.sprite.x + (dx / len) * 20,
        engine.sprite.y + (dy / len) * 20,
        step
      );
      return;
    }
    if (dist > range) {
      this.stepToward(engine, target.x, target.y, step);
      return;
    }
    if (engine.cooldownMs > 0) return;
    engine.cooldownMs =
      engine.kind === 'catapult'
        ? SiegeBalance.catapultCooldownMs
        : SiegeBalance.trebuchetCooldownMs;
    const dmg =
      engine.kind === 'catapult'
        ? SiegeBalance.catapultDps
        : SiegeBalance.trebuchetDps;
    this.vfx?.engineRecoil(engine.sprite, target.x, target.y);
    const tid = target.id;
    const tx = target.x;
    const ty = target.y;
    this.vfx?.projectileArc(
      engine.sprite.x,
      engine.sprite.y - 8,
      tx,
      ty - 6,
      'rock',
      () => {
        const still = this.buildings?.getById(tid);
        if (!still) return;
        this.buildings?.shakeBuilding(tid);
        const destroyed = this.buildings?.damageBuilding(tid, dmg, {
          fire: still.kind === 'field',
        });
        if (destroyed && still.kind === 'field') {
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: 'A field was burned by siege fire!',
          });
        }
      }
    );
  }

  private pickTarget(
    engine: SiegeEngine,
    storming: boolean
  ): BuildingRecord | null {
    if (!this.buildings) return null;
    if (engine.kind === 'trebuchet' && storming) {
      // can hit keep via damageKeep separately — prefer fort still
    }
    const fort = this.buildings.nearestFortification(
      engine.sprite.x,
      engine.sprite.y
    );
    if (fort) return fort;
    if (engine.kind !== 'ram') {
      return this.buildings.fieldsNear(
        engine.sprite.x,
        engine.sprite.y,
        SiegeBalance.fieldBurnPriorityRadius
      );
    }
    return null;
  }

  private stepToward(
    engine: SiegeEngine,
    tx: number,
    ty: number,
    step: number
  ): void {
    const dx = tx - engine.sprite.x;
    const dy = ty - engine.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    let nx = engine.sprite.x + (dx / dist) * Math.min(step, dist);
    let ny = engine.sprite.y + (dy / dist) * Math.min(step, dist);
    if (this.pathGrid?.isWorldBlocked(nx, ny)) {
      // slide along open neighbor
      const path = this.pathGrid.findPath(
        { x: engine.sprite.x, y: engine.sprite.y },
        { x: tx, y: ty }
      );
      if (path && path.length > 1) {
        nx = path[1]!.x;
        ny = path[1]!.y;
        const d2 = Math.hypot(nx - engine.sprite.x, ny - engine.sprite.y) || 1;
        nx = engine.sprite.x + ((nx - engine.sprite.x) / d2) * Math.min(step, d2);
        ny = engine.sprite.y + ((ny - engine.sprite.y) / d2) * Math.min(step, d2);
      }
    }
    engine.sprite.setPosition(nx, ny);
    engine.sprite.setDepth(24 + ny * 0.01);
  }

  private destroyEngine(engine: SiegeEngine, toast: boolean): void {
    engine.done = true;
    this.vfx?.breachDust(engine.sprite.x, engine.sprite.y);
    this.scene.tweens.add({
      targets: engine.sprite,
      alpha: 0,
      duration: 280,
      onComplete: () => {
        engine.sprite.destroy();
        this.engines = this.engines.filter((e) => e !== engine);
      },
    });
    if (toast) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `A ${engine.kind === 'ram' ? 'battering ram' : engine.kind} was destroyed!`,
      });
    }
    this.onKill?.();
  }
}

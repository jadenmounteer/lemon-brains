import Phaser from 'phaser';
import { isMilitaryRole, PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { ringOffset } from '../subjects/zones';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';

const STOCK_THOUGHTS = [
  'This tomato has opinions.',
  'I can see my house from here. It is judging me.',
  'If dignity were a hat, it just blew off.',
  'The cabbage was uncalled for.',
  'I shall never skip stew again.',
];

const PELT_LINES = [
  'Have a tomato!',
  'Rotten luck!',
  'Take that!',
  'The market surplus had to go somewhere.',
  'Justice, but sticky.',
];

const FRUIT_KEYS = [
  PROP_KEYS.fruitTomato,
  PROP_KEYS.fruitApple,
  PROP_KEYS.fruitCabbage,
];

interface EscortState {
  guardId: string;
  captiveId: string;
  stocksId: string;
}

interface FruitShot {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  lifeMs: number;
}

export class StocksLifeSystem {
  private escorts: EscortState[] = [];
  private fruit: FruitShot[] = [];
  private throwAccum = 0;
  private thoughtAccum = 0;
  private bubbles: SpeechBubbleSystem | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  setBubbles(bubbles: SpeechBubbleSystem): void {
    this.bubbles = bubbles;
  }

  hasStocks(): boolean {
    return this.buildings.list().some((b) => b.kind === 'stocks' && b.hp > 0);
  }

  freeStocksCount(): number {
    return this.freeStocks().length;
  }

  isInStocks(id: string): boolean {
    const k = this.subjects.getById(id)?.interrupt?.kind;
    return k === 'in_stocks' || k === 'to_stocks';
  }

  requestLock(subjectId: string, guardId: string): boolean {
    const target = this.subjects.getById(subjectId);
    const guard = this.subjects.getById(guardId);
    if (!target || !guard || target.data.id === guard.data.id) return false;
    if (this.isInStocks(subjectId)) return false;
    if (
      target.interrupt?.kind === 'imprisoned' ||
      target.interrupt?.kind === 'under_arrest' ||
      target.interrupt?.kind === 'execute'
    ) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'They are already spoken for by the dungeon.',
      });
      return false;
    }
    const stocks = this.nearestFreeStocks(target.sprite.x, target.sprite.y);
    if (!stocks) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No free stocks — build another, or release someone.',
      });
      return false;
    }

    guard.interrupt = {
      kind: 'escort_captive',
      targetId: target.data.id,
      remainingMs: 40_000,
    };
    guard.data.activityLabel = `Marching ${target.data.name} to the stocks`;
    target.interrupt = {
      kind: 'to_stocks',
      targetId: stocks.id,
      remainingMs: 40_000,
    };
    target.data.activityLabel = 'Being walked to the stocks';
    target.data.thought = 'This is going to be sticky.';
    this.subjects.appendLifeLog(target.data.id, 'Marched to the stocks', 'stocks');
    this.escorts.push({
      guardId: guard.data.id,
      captiveId: target.data.id,
      stocksId: stocks.id,
    });
    this.subjects.nudgeToward(guard.data.id, stocks.x, stocks.y + 22, 52);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${guard.data.name} hauls ${target.data.name} to the stocks`,
    });
    return true;
  }

  release(subjectId: string): boolean {
    const s = this.subjects.getById(subjectId);
    if (!s) return false;
    if (s.interrupt?.kind !== 'in_stocks' && s.interrupt?.kind !== 'to_stocks') {
      return false;
    }
    const escort = this.escorts.find((e) => e.captiveId === subjectId);
    if (escort) {
      this.subjects.clearInterrupt(escort.guardId);
      this.escorts = this.escorts.filter((e) => e !== escort);
    }
    const stocksId = s.interrupt.targetId;
    const stocks = stocksId ? this.buildings.getById(stocksId) : null;
    this.subjects.clearInterrupt(s.data.id);
    s.data.activityLabel = 'Freed from the stocks';
    s.data.thought = 'I smell like a salad. A punished salad.';
    s.sprite.setAngle(0);
    this.subjects.appendLifeLog(s.data.id, 'Released from the stocks', 'release');
    if (stocks) {
      this.subjects.nudgeToward(s.data.id, stocks.x + 18, stocks.y + 22, 48);
    }
    this.clearPelters();
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${s.data.name} is freed from the stocks`,
    });
    return true;
  }

  onBuildingDestroyed(id: string): void {
    for (const s of this.subjects.listManaged()) {
      if (
        (s.interrupt?.kind === 'in_stocks' || s.interrupt?.kind === 'to_stocks') &&
        s.interrupt.targetId === id
      ) {
        this.release(s.data.id);
      }
    }
    this.escorts = this.escorts.filter((e) => e.stocksId !== id);
  }

  update(deltaMs: number): void {
    this.tickEscorts();
    this.tickPinned();
    this.tickCrowd(deltaMs);
    this.tickFruit(deltaMs);
    this.tickThoughts(deltaMs);
  }

  clear(): void {
    for (const f of this.fruit) f.sprite.destroy();
    this.fruit = [];
    this.escorts = [];
  }

  private freeStocks() {
    const used = new Set<string>();
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind === 'in_stocks' || s.interrupt?.kind === 'to_stocks') {
        if (s.interrupt.targetId) used.add(s.interrupt.targetId);
      }
    }
    for (const e of this.escorts) used.add(e.stocksId);
    return this.buildings
      .list()
      .filter((b) => b.kind === 'stocks' && b.hp > 0 && !used.has(b.id));
  }

  private nearestFreeStocks(x: number, y: number) {
    const list = this.freeStocks();
    let best = list[0] ?? null;
    let bestD = Infinity;
    for (const b of list) {
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private lockPoint(stocks: { x: number; y: number }) {
    return { x: stocks.x, y: stocks.y - 4 };
  }

  private tickEscorts(): void {
    for (const escort of [...this.escorts]) {
      const guard = this.subjects.getById(escort.guardId);
      const captive = this.subjects.getById(escort.captiveId);
      const stocks = this.buildings.getById(escort.stocksId);
      if (!captive || !captive.sprite.active) {
        this.escorts = this.escorts.filter((e) => e !== escort);
        continue;
      }
      if (!guard || !stocks || !guard.sprite.active || stocks.hp <= 0) {
        this.subjects.clearInterrupt(captive.data.id);
        if (guard) this.subjects.clearInterrupt(guard.data.id);
        this.escorts = this.escorts.filter((e) => e !== escort);
        continue;
      }
      const stand = { x: stocks.x, y: stocks.y + 22 };
      captive.sprite.x = Phaser.Math.Linear(captive.sprite.x, guard.sprite.x - 10, 0.22);
      captive.sprite.y = Phaser.Math.Linear(captive.sprite.y, guard.sprite.y + 4, 0.22);
      const dist = Phaser.Math.Distance.Between(
        guard.sprite.x,
        guard.sprite.y,
        stand.x,
        stand.y
      );
      if (dist > 20) {
        if (!guard.moving) {
          this.subjects.nudgeToward(guard.data.id, stand.x, stand.y, 52);
        }
      } else {
        this.lockIn(captive.data.id, stocks);
        this.subjects.clearInterrupt(guard.data.id);
        guard.data.activityLabel = 'Locked them in the stocks';
        this.escorts = this.escorts.filter((e) => e !== escort);
        this.gatherCrowd(stocks.x, stocks.y, captive.data.id);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${captive.data.name} is locked in the stocks`,
        });
      }
    }
  }

  private lockIn(
    subjectId: string,
    stocks: { id: string; x: number; y: number }
  ): void {
    const s = this.subjects.getById(subjectId);
    if (!s) return;
    const pt = this.lockPoint(stocks);
    s.sprite.setPosition(pt.x, pt.y);
    s.sprite.setDepth(12 + pt.y * 0.01);
    s.interrupt = { kind: 'in_stocks', targetId: stocks.id };
    s.data.zone = 'stocks';
    s.data.activityLabel = 'Locked in the stocks';
    s.data.thought =
      STOCK_THOUGHTS[Math.floor(Math.random() * STOCK_THOUGHTS.length)]!;
  }

  private tickPinned(): void {
    const t = this.scene.time.now;
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'in_stocks' || !s.interrupt.targetId) continue;
      const stocks = this.buildings.getById(s.interrupt.targetId);
      if (!stocks || stocks.hp <= 0) {
        this.release(s.data.id);
        continue;
      }
      const pt = this.lockPoint(stocks);
      s.sprite.setPosition(pt.x + Math.sin(t / 220) * 0.6, pt.y);
      s.sprite.setDepth(12 + pt.y * 0.01);
    }
  }

  private tickCrowd(deltaMs: number): void {
    this.throwAccum += deltaMs;
    if (this.throwAccum < 1100) return;
    this.throwAccum = 0;
    for (const victim of this.subjects.listManaged()) {
      if (victim.interrupt?.kind !== 'in_stocks' || !victim.interrupt.targetId) {
        continue;
      }
      const stocks = this.buildings.getById(victim.interrupt.targetId);
      if (!stocks) continue;
      this.keepCrowd(stocks.x, stocks.y, victim.data.id);
      const throwers = this.subjects
        .listManaged()
        .filter((s) => s.interrupt?.kind === 'pelt_stocks');
      if (throwers.length === 0) continue;
      const thrower = throwers[Math.floor(Math.random() * throwers.length)]!;
      this.lobFruit(thrower, victim);
    }
  }

  private keepCrowd(gx: number, gy: number, victimId: string): void {
    const existing = this.subjects
      .listManaged()
      .filter((s) => s.interrupt?.kind === 'pelt_stocks').length;
    if (existing >= 8) return;
    const extras = this.subjects
      .listManaged()
      .filter((s) => {
        if (s.data.id === victimId) return false;
        if (!s.sprite.active || s.interrupt) return false;
        if (s.data.allegiance === 'camp') return false;
        if (isMilitaryRole(s.data.role) && s.data.role !== 'jester') return false;
        const d = Phaser.Math.Distance.Between(gx, gy, s.sprite.x, s.sprite.y);
        return d < 200;
      })
      .slice(0, 8 - existing);
    extras.forEach((s, i) => {
      s.interrupt = { kind: 'pelt_stocks', remainingMs: 18_000 };
      s.data.activityLabel = 'Pelting the stocks';
      s.data.thought =
        PELT_LINES[Math.floor(Math.random() * PELT_LINES.length)]!;
      const off = ringOffset(existing + i, 8, 48);
      const dest = this.subjects.snapToWalkable(gx + off.x, gy + 26 + off.y * 0.4);
      this.subjects.nudgeToward(s.data.id, dest.x, dest.y, 42);
    });
  }

  private gatherCrowd(gx: number, gy: number, victimId: string): void {
    this.keepCrowd(gx, gy, victimId);
  }

  private lobFruit(
    thrower: ReturnType<SubjectSystem['listManaged']>[number],
    victim: ReturnType<SubjectSystem['listManaged']>[number]
  ): void {
    const key = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)]!;
    if (!this.scene.textures.exists(key)) return;
    const sprite = this.scene.add
      .sprite(thrower.sprite.x, thrower.sprite.y - 10, key)
      .setDepth(20)
      .setOrigin(0.5, 0.5);
    const dx = victim.sprite.x - thrower.sprite.x;
    const dy = victim.sprite.y - 14 - (thrower.sprite.y - 10);
    this.fruit.push({
      sprite,
      vx: dx / 0.42,
      vy: dy / 0.42 - 90,
      lifeMs: 520,
    });
    this.subjects.playCelebrateAnim(thrower.data.id, 'cheer');
    const line = PELT_LINES[Math.floor(Math.random() * PELT_LINES.length)]!;
    thrower.data.thought = line;
    if (this.bubbles && Math.random() < 0.55) {
      this.bubbles.say(thrower.sprite, line, 1800);
    }
  }

  private tickFruit(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const shot of [...this.fruit]) {
      shot.lifeMs -= deltaMs;
      shot.vy += 280 * dt;
      shot.sprite.x += shot.vx * dt;
      shot.sprite.y += shot.vy * dt;
      shot.sprite.rotation += 8 * dt;
      if (shot.lifeMs <= 0) {
        shot.sprite.destroy();
        this.fruit = this.fruit.filter((f) => f !== shot);
      }
    }
  }

  private tickThoughts(deltaMs: number): void {
    this.thoughtAccum += deltaMs;
    if (this.thoughtAccum < 7000) return;
    this.thoughtAccum = 0;
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'in_stocks') continue;
      s.data.thought =
        STOCK_THOUGHTS[Math.floor(Math.random() * STOCK_THOUGHTS.length)]!;
    }
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'pelt_stocks') continue;
      s.interrupt.remainingMs = (s.interrupt.remainingMs ?? 8000) - 7000;
      if ((s.interrupt.remainingMs ?? 0) <= 0) {
        this.subjects.clearInterrupt(s.data.id);
      }
    }
  }

  private clearPelters(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'pelt_stocks') continue;
      this.subjects.clearInterrupt(s.data.id);
      s.data.activityLabel = 'Done pelting';
    }
  }
}

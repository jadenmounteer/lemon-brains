import Phaser from 'phaser';
import {
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type MonsterRole,
} from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import {
  CombatBalance,
  MONSTER_MAX_HP,
} from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import type { SiegeVfx } from '../siege/SiegeVfx';
import { DayClock } from '../subjects/DayClock';
import { KingdomEvents } from '../subjects/events';
import { pickMonsterName } from '../subjects/names';
import type { ActivityId, SubjectSnapshot, ZoneId } from '../subjects/types';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import {
  getCavePoints,
  randomPointInZone,
  type Point,
  type WorldBounds,
} from '../subjects/zones';

export type MonsterKind = MonsterRole;

export interface SavedMonster {
  id: string;
  kind: MonsterKind;
  name: string;
  hp: number;
  maxHp: number;
  twoHeaded?: boolean;
  caveId?: string;
  x?: number;
  y?: number;
}

export interface ManagedMonster {
  id: string;
  kind: MonsterKind;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  twoHeaded: boolean;
  caveId: string | null;
  activity: ActivityId;
  activityLabel: string;
  zone: ZoneId;
  thinkAccumMs: number;
  regenAccumMs: number;
  moving: boolean;
}

const TROLL_SLOTS: {
  start: number;
  end: number;
  activity: ActivityId;
  zone: ZoneId;
  label: string;
}[] = [
  { start: 0, end: 6, activity: 'sleep', zone: 'mountain', label: 'Hiding in the mountains' },
  { start: 6, end: 18, activity: 'patrol', zone: 'forest', label: 'Lurking in the forest' },
  { start: 18, end: 24, activity: 'patrol', zone: 'path', label: 'Stalking the paths' },
];

const OGRE_SLOTS: typeof TROLL_SLOTS = [
  { start: 0, end: 7, activity: 'sleep', zone: 'forest', label: 'Sleeping in the woods' },
  { start: 7, end: 12, activity: 'patrol', zone: 'path', label: 'Stomping the roads' },
  { start: 12, end: 17, activity: 'smash', zone: 'path', label: 'Smashing near homes' },
  { start: 17, end: 24, activity: 'patrol', zone: 'forest', label: 'Returning to the trees' },
];

const DRAGON_SLOTS: typeof TROLL_SLOTS = [
  { start: 0, end: 8, activity: 'sleep', zone: 'cave', label: 'Sleeping in its cave' },
  { start: 8, end: 14, activity: 'patrol', zone: 'mountain', label: 'Soaring the ridges' },
  { start: 14, end: 17, activity: 'steal', zone: 'keep', label: 'Raiding the keep for gold' },
  { start: 17, end: 24, activity: 'sleep', zone: 'cave', label: 'Returning to the cave' },
];

export class MonsterSystem {
  private monsters: ManagedMonster[] = [];
  private nextId = 0;
  private selectedId: string | null = null;
  private buildings: BuildingSystem | null = null;
  private subjects: SubjectSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private vfx: SiegeVfx | null = null;
  private clock: DayClock | null = null;
  private dayCount = 0;
  private daysPlayed = 0;
  private spawnAccumDays = 0;
  private onChanged: (() => void) | null = null;
  private keep: Point = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds
  ) {}

  setBuildings(b: BuildingSystem): void {
    this.buildings = b;
  }

  setSubjects(s: SubjectSystem): void {
    this.subjects = s;
  }

  setPathGrid(g: PathGrid): void {
    this.pathGrid = g;
  }

  setVfx(v: SiegeVfx): void {
    this.vfx = v;
  }

  setClock(clock: DayClock): void {
    this.clock = clock;
  }

  setKeep(keep: Point): void {
    this.keep = keep;
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  list(): ManagedMonster[] {
    return this.monsters;
  }

  getById(id: string): ManagedMonster | undefined {
    return this.monsters.find((m) => m.id === id);
  }

  sleepingDragons(): ManagedMonster[] {
    return this.monsters.filter(
      (m) => m.kind === 'dragon' && m.activity === 'sleep' && m.sprite.active
    );
  }

  nearestMonster(
    x: number,
    y: number,
    radius: number,
    opts?: { awakeOnly?: boolean; kind?: MonsterKind }
  ): ManagedMonster | null {
    let best: ManagedMonster | null = null;
    let bestD = radius;
    for (const m of this.monsters) {
      if (!m.sprite.active) continue;
      if (opts?.kind && m.kind !== opts.kind) continue;
      if (opts?.awakeOnly && m.activity === 'sleep') continue;
      const d = Phaser.Math.Distance.Between(x, y, m.sprite.x, m.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  pickAt(worldX: number, worldY: number): string | null {
    let best: ManagedMonster | null = null;
    let bestD = 18;
    for (const m of this.monsters) {
      if (!m.sprite.active) continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, m.sprite.x, m.sprite.y - 8);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best?.id ?? null;
  }

  select(id: string | null): SubjectSnapshot | null {
    this.selectedId = id;
    if (!id) return null;
    const m = this.getById(id);
    return m ? this.toSnapshot(m) : null;
  }

  refreshSelectedSnapshot(): SubjectSnapshot | null {
    if (!this.selectedId) return null;
    const m = this.getById(this.selectedId);
    return m ? this.toSnapshot(m) : null;
  }

  serialize(): SavedMonster[] {
    return this.monsters.map((m) => ({
      id: m.id,
      kind: m.kind,
      name: m.name,
      hp: m.hp,
      maxHp: m.maxHp,
      twoHeaded: m.twoHeaded || undefined,
      caveId: m.caveId ?? undefined,
      x: m.sprite.x,
      y: m.sprite.y,
    }));
  }

  restore(saved: SavedMonster[]): void {
    this.clearSprites();
    this.monsters = [];
    for (const s of saved) {
      this.spawnMonster(s.kind, {
        id: s.id,
        name: s.name,
        hp: s.hp,
        maxHp: s.maxHp,
        twoHeaded: Boolean(s.twoHeaded),
        caveId: s.caveId ?? null,
        x: s.x,
        y: s.y,
      });
    }
  }

  seedIfEmpty(): void {
    if (this.monsters.length > 0) return;
    this.spawnMonster('troll');
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${this.monsters[0]?.name ?? 'A troll'} appeared in the wilds!`,
    });
  }

  damageMonster(id: string, amount: number): boolean {
    const m = this.getById(id);
    if (!m || !m.sprite.active) return false;
    m.hp = Math.max(0, m.hp - amount);
    this.vfx?.hitFlash(m.sprite);
    if (m.hp / m.maxHp <= 0.35) m.sprite.setTint(0xff6666);
    if (m.hp <= 0) {
      this.killMonster(m);
      return true;
    }
    return false;
  }

  update(deltaMs: number): void {
    const hour = this.clock?.hour ?? 12;
    for (const m of [...this.monsters]) {
      if (!m.sprite.active) continue;
      this.syncActivity(m, hour);
      m.thinkAccumMs += deltaMs;
      if (m.kind === 'troll') {
        m.regenAccumMs += deltaMs;
        if (m.regenAccumMs >= 2500 && m.hp < m.maxHp && m.activity !== 'sleep') {
          m.regenAccumMs = 0;
          m.hp = Math.min(m.maxHp, m.hp + CombatBalance.trollRegen);
        }
      }
      if (m.thinkAccumMs < CombatBalance.tickMs) continue;
      m.thinkAccumMs = 0;
      this.tickMonster(m);
    }
  }

  setDaysPlayed(days: number): void {
    this.daysPlayed = Math.max(0, Math.floor(days));
  }

  onDayRolled(): void {
    this.dayCount += 1;
    this.spawnAccumDays += 1;
    const maxMonsters = Math.min(14, 4 + Math.floor(this.daysPlayed / 3));
    if (this.monsters.length >= maxMonsters) return;
    // Spawn more often as days rise (every 2 days early → every day late)
    const interval = this.daysPlayed >= 8 ? 1 : 2;
    if (this.spawnAccumDays < interval) return;
    this.spawnAccumDays = 0;
    const hasDragon = this.monsters.some((m) => m.kind === 'dragon');
    let kind: MonsterKind = Math.random() < 0.45 ? 'ogre' : 'troll';
    // Earlier / more frequent dragons
    if (!hasDragon && (this.dayCount >= 2 || this.daysPlayed >= 2) && Math.random() < 0.65) {
      kind = 'dragon';
    }
    // Extra spawn chance on long-lived kingdoms
    const m = this.spawnMonster(kind);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message:
        kind === 'dragon'
          ? `${m.name} the dragon nests in a cave!`
          : `${m.name} the ${kind} stalks the kingdom!`,
    });
    if (
      this.daysPlayed >= 8 &&
      this.monsters.length < maxMonsters &&
      Math.random() < 0.45
    ) {
      const extra = this.spawnMonster(Math.random() < 0.5 ? 'ogre' : 'troll');
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${extra.name} the ${extra.kind} joins the wilds!`,
      });
    }
    this.onChanged?.();
  }

  clear(): void {
    this.clearSprites();
    this.monsters = [];
  }

  private clearSprites(): void {
    for (const m of this.monsters) {
      this.scene.tweens.killTweensOf(m.sprite);
      m.sprite.destroy();
    }
  }

  private spawnMonster(
    kind: MonsterKind,
    opts?: {
      id?: string;
      name?: string;
      hp?: number;
      maxHp?: number;
      twoHeaded?: boolean;
      caveId?: string | null;
      x?: number;
      y?: number;
    }
  ): ManagedMonster {
    const id = opts?.id ?? `${kind}-${this.nextId++}`;
    const match = /^.*?(\d+)$/.exec(id);
    if (match) this.nextId = Math.max(this.nextId, Number(match[1]) + 1);

    const twoHeaded =
      opts?.twoHeaded ?? (kind === 'dragon' && Math.random() < 0.25);
    const maxHp =
      opts?.maxHp ??
      (kind === 'dragon' && twoHeaded
        ? MONSTER_MAX_HP.dragonTwoHead
        : MONSTER_MAX_HP[kind]);
    const hp = opts?.hp ?? maxHp;
    const name = opts?.name ?? pickMonsterName(kind, id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));

    const caves = getCavePoints();
    let caveId = opts?.caveId ?? null;
    if (kind === 'dragon' && !caveId && caves.length) {
      caveId = caves[this.monsters.filter((m) => m.kind === 'dragon').length % caves.length]!.id;
    }

    const start = this.startPoint(kind, caveId, opts?.x, opts?.y);
    const sprite = this.scene.add.sprite(start.x, start.y, kind, 0);
    sprite.setDepth(26);
    sprite.setOrigin(0.5, 1);
    if (kind === 'dragon') sprite.setScale(twoHeaded ? 1.55 : 1.35);
    if (kind === 'ogre') sprite.setScale(1.3);
    if (kind === 'troll') sprite.setScale(1.15);
    if (twoHeaded) sprite.setTint(0xffccaa);
    sprite.play(idleAnimKey(kind));

    const m: ManagedMonster = {
      id,
      kind,
      name,
      sprite,
      hp,
      maxHp,
      twoHeaded,
      caveId,
      activity: 'patrol',
      activityLabel: 'Roaming',
      zone: 'path',
      thinkAccumMs: 0,
      regenAccumMs: 0,
      moving: false,
    };
    this.monsters.push(m);
    this.syncActivity(m, this.clock?.hour ?? 12);
    return m;
  }

  private startPoint(
    kind: MonsterKind,
    caveId: string | null,
    x?: number,
    y?: number
  ): Point {
    if (typeof x === 'number' && typeof y === 'number') return { x, y };
    if (kind === 'dragon' && caveId) {
      const cave = getCavePoints().find((c) => c.id === caveId);
      if (cave) return { x: cave.x, y: cave.y + 8 };
    }
    return randomPointInZone(
      kind === 'troll' ? 'forest' : kind === 'ogre' ? 'path' : 'cave',
      this.world,
      null
    );
  }

  private syncActivity(m: ManagedMonster, hour: number): void {
    const slots =
      m.kind === 'troll' ? TROLL_SLOTS : m.kind === 'ogre' ? OGRE_SLOTS : DRAGON_SLOTS;
    const h = ((hour % 24) + 24) % 24;
    const slot =
      slots.find((s) => h >= s.start && h < s.end) ?? slots[slots.length - 1]!;
    if (m.activity !== slot.activity || m.zone !== slot.zone) {
      m.activity = slot.activity;
      m.activityLabel = slot.label;
      m.zone = slot.zone;
      m.moving = false;
      this.nudgeTowardZone(m);
    }
  }

  private tickMonster(m: ManagedMonster): void {
    if (m.activity === 'sleep') {
      m.sprite.play(idleAnimKey(m.kind), true);
      if (m.kind === 'dragon' && m.caveId) {
        const cave = getCavePoints().find((c) => c.id === m.caveId);
        if (cave) {
          const d = Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, cave.x, cave.y);
          if (d > 24) this.nudgeToward(m, cave.x, cave.y + 6, 35);
        }
      }
      return;
    }

    if (m.activity === 'steal' && m.kind === 'dragon') {
      const d = Phaser.Math.Distance.Between(
        m.sprite.x,
        m.sprite.y,
        this.keep.x,
        this.keep.y
      );
      if (d > 36) {
        this.nudgeToward(m, this.keep.x, this.keep.y + 20, 55);
        return;
      }
      const amount = m.twoHeaded
        ? CombatBalance.dragonTwoHeadStealGold
        : CombatBalance.dragonStealGold;
      this.scene.game.events.emit(KingdomEvents.GOLD_STOLEN, {
        amount,
        kind: 'dragon',
        label: m.name,
      });
      this.vfx?.breachDust(this.keep.x, this.keep.y - 10);
      m.activity = 'patrol';
      m.activityLabel = 'Fleeing with gold';
      m.zone = 'cave';
      this.nudgeTowardZone(m);
      return;
    }

    if (m.activity === 'smash' && m.kind === 'ogre') {
      const target = this.buildings?.burnablesNear(
        m.sprite.x,
        m.sprite.y,
        50
      ) ?? this.buildings?.nearestFortification(m.sprite.x, m.sprite.y, 60);
      if (target) {
        const d = Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, target.x, target.y);
        if (d > 32) {
          this.nudgeToward(m, target.x, target.y, 40);
          return;
        }
        this.vfx?.meleeLunge(m.sprite, target.x, target.y);
        this.buildings?.shakeBuilding(target.id);
        const destroyed = this.buildings?.damageBuilding(
          target.id,
          CombatBalance.ogreSmash,
          { fire: false }
        );
        if (destroyed) {
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${m.name} smashed ${this.buildings?.displayNameForId(target.id) ?? 'a building'}!`,
          });
        }
        return;
      }
    }

    // Scare peasants / melee nearby subjects
    const victim = this.subjects?.nearestSubject(
      m.sprite.x,
      m.sprite.y,
      CombatBalance.monsterAggro
    );
    if (victim) {
      if (m.kind === 'troll' && victim.data.role === 'peasant') {
        this.subjects?.beginFleeFromMonster(victim.data.id, m.sprite.x, m.sprite.y);
      }
      const d = Phaser.Math.Distance.Between(
        m.sprite.x,
        m.sprite.y,
        victim.sprite.x,
        victim.sprite.y
      );
      if (d < CombatBalance.guardRange + 10) {
        this.vfx?.meleeLunge(m.sprite, victim.sprite.x, victim.sprite.y);
        const dmg =
          m.kind === 'dragon'
            ? CombatBalance.dragonBreath
            : m.kind === 'ogre'
              ? CombatBalance.ogreSmash * 0.5
              : CombatBalance.monsterMelee;
        this.subjects?.damageSubject(victim.data.id, dmg);
        if (m.kind === 'dragon') {
          this.vfx?.startBurn(`breath-${m.id}`, victim.sprite.x, victim.sprite.y - 8);
          this.scene.time.delayedCall(400, () => this.vfx?.stopBurn(`breath-${m.id}`));
        }
        return;
      }
    }

    if (!m.moving) this.nudgeTowardZone(m);
  }

  private nudgeTowardZone(m: ManagedMonster): void {
    let target = randomPointInZone(m.zone, this.world, null);
    if (m.kind === 'dragon' && m.zone === 'cave' && m.caveId) {
      const cave = getCavePoints().find((c) => c.id === m.caveId);
      if (cave) target = { x: cave.x, y: cave.y + 8 };
    }
    this.nudgeToward(m, target.x, target.y, m.kind === 'dragon' ? 50 : 32);
  }

  private nudgeToward(
    m: ManagedMonster,
    tx: number,
    ty: number,
    speed: number
  ): void {
    let x = Phaser.Math.Clamp(tx, 32, this.world.width - 32);
    let y = Phaser.Math.Clamp(ty, 32, this.world.height - 32);
    // Dragons fly — ignore terrain/path blocks (water, mountains, walls).
    if (this.pathGrid && m.kind !== 'dragon') {
      const path = this.pathGrid.findPath(
        { x: m.sprite.x, y: m.sprite.y },
        { x, y }
      );
      if (path && path.length > 1) {
        const hop = Math.min(4, path.length - 1);
        x = path[hop]!.x;
        y = path[hop]!.y;
      } else if (this.pathGrid.isWorldBlocked(x, y)) {
        return;
      }
    }
    const dx = x - m.sprite.x;
    const dy = y - m.sprite.y;
    if (Math.hypot(dx, dy) < 6) return;

    this.scene.tweens.killTweensOf(m.sprite);
    const dir = facingFromDelta(dx, dy);
    m.sprite.play(walkAnimKey(m.kind, dir), true);
    m.moving = true;
    const dist = Math.hypot(dx, dy);
    this.scene.tweens.add({
      targets: m.sprite,
      x,
      y,
      duration: Math.max(250, (dist / speed) * 1000),
      ease: 'Linear',
      onUpdate: () => {
        m.sprite.setDepth(26 + m.sprite.y * 0.01);
      },
      onComplete: () => {
        m.moving = false;
        if (m.sprite.active) m.sprite.play(idleAnimKey(m.kind));
      },
    });
  }

  private killMonster(m: ManagedMonster): void {
    this.scene.tweens.killTweensOf(m.sprite);
    this.scene.tweens.add({
      targets: m.sprite,
      alpha: 0,
      duration: 320,
      onComplete: () => {
        m.sprite.destroy();
        this.monsters = this.monsters.filter((x) => x !== m);
        if (this.selectedId === m.id) this.selectedId = null;
        this.onChanged?.();
      },
    });
  }

  private toSnapshot(m: ManagedMonster): SubjectSnapshot {
    const hour = this.clock?.hour ?? 12;
    return {
      id: m.id,
      name: m.name,
      role: 'peasant',
      roleLabel:
        m.kind === 'dragon'
          ? m.twoHeaded
            ? 'Two-Headed Dragon'
            : 'Dragon'
          : m.kind === 'troll'
            ? 'Troll'
            : 'Ogre',
      activityLabel: m.activityLabel,
      homeLabel: m.caveId ? 'A mountain cave' : 'The wilds',
      scheduleSummary: this.scheduleLines(m.kind),
      dayPhase: this.clock?.phase ?? 'Morning',
      hour,
      hp: m.hp,
      maxHp: m.maxHp,
      onWall: false,
      hunger: 0,
      sick: false,
      genderLabel: '—',
    };
  }

  private scheduleLines(kind: MonsterKind): string[] {
    const slots =
      kind === 'troll' ? TROLL_SLOTS : kind === 'ogre' ? OGRE_SLOTS : DRAGON_SLOTS;
    return slots.map((s) => `${fmt(s.start)}–${fmt(s.end)}: ${s.label}`);
  }
}

function fmt(hour: number): string {
  const h = Math.floor(hour) % 24;
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

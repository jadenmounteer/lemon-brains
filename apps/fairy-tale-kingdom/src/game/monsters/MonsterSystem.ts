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
import { getSandboxRuntime } from '../sandboxRuntime';
import { getModeProfile } from '../core/modeRuntime';

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
  homeX?: number;
  homeY?: number;
  influenceRadius?: number;
  hunger?: number;
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
  /** Territory sphere center — the spawn point (or cave, for dragons). */
  homeX: number;
  homeY: number;
  influenceRadius: number;
  /** 0–100; wandering targets clamp to the sphere, but a hungry monster hunts. */
  hunger: number;
  /** True while actively chasing prey after crossing the hunger threshold. */
  hunting: boolean;
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

  /** Territory sphere for the selected (or given) monster — drawn like the keep overlay. */
  getInfluence(id: string): { x: number; y: number; radius: number } | null {
    const m = this.getById(id);
    if (!m) return null;
    return { x: m.homeX, y: m.homeY, radius: m.influenceRadius };
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
      homeX: m.homeX,
      homeY: m.homeY,
      influenceRadius: m.influenceRadius,
      hunger: m.hunger,
    }));
  }

  restore(saved: SavedMonster[]): void {
    this.clearSprites();
    this.monsters = [];
    for (const s of saved) {
      let homeX = s.homeX;
      let homeY = s.homeY;
      // Migrate ogres that nested their home on the keep roads.
      if (
        s.kind === 'ogre' &&
        typeof homeX === 'number' &&
        typeof homeY === 'number'
      ) {
        const pushed = this.pushAwayFromKeep({ x: homeX, y: homeY }, 220);
        homeX = pushed.x;
        homeY = pushed.y;
      }
      this.spawnMonster(s.kind, {
        id: s.id,
        name: s.name,
        hp: s.hp,
        maxHp: s.maxHp,
        twoHeaded: Boolean(s.twoHeaded),
        caveId: s.caveId ?? null,
        x: s.x,
        y: s.y,
        homeX,
        homeY,
        influenceRadius: s.influenceRadius,
        hunger: s.hunger,
      });
    }
  }

  /** Sandbox: force-spawn a monster (ignores daily caps / dragon uniqueness). */
  debugSpawn(kind: MonsterKind): void {
    const m = this.spawnMonster(kind);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message:
        kind === 'dragon'
          ? `Sandbox: ${m.name} the dragon nests nearby!`
          : `Sandbox: ${m.name} the ${kind} stalks the wilds!`,
    });
    this.onChanged?.();
  }

  seedIfEmpty(): void {
    if (this.monsters.length > 0) return;
    const sb = getSandboxRuntime().monsters;
    const profile = getModeProfile();
    const maxKinds = Math.max(0, profile.starterMonsterCount);
    if (maxKinds <= 0) return;
    const lines: string[] = [];
    if (sb.kinds.troll && lines.length < maxKinds) {
      const m = this.spawnMonster('troll');
      lines.push(`${m.name} the troll`);
    }
    if (sb.kinds.ogre && lines.length < maxKinds) {
      const m = this.spawnMonster('ogre');
      lines.push(`${m.name} the ogre`);
    }
    if (
      sb.kinds.dragon &&
      lines.length < maxKinds &&
      getCavePoints().length > 0
    ) {
      const m = this.spawnMonster('dragon');
      lines.push(`${m.name} the dragon`);
    }
    if (!lines.length) return;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message:
        lines.length === 1
          ? `${lines[0]} appeared in the wilds!`
          : `Wild beasts stir: ${lines.join(', ')}!`,
    });
    this.onChanged?.();
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
      m.hunger = Math.min(
        100,
        m.hunger +
          (deltaMs / 1000) *
            CombatBalance.monsterHungerPerSec *
            getSandboxRuntime().monsters.hungerHunt
      );
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
    const sb = getSandboxRuntime().monsters;
    if (sb.spawnRate <= 0) return;
    this.spawnAccumDays += sb.spawnRate;
    const maxMonsters = Math.min(14, 4 + Math.floor(this.daysPlayed / 3));
    if (this.monsters.length >= maxMonsters) return;
    // One attempt per accumulated day of spawnRate (sandbox 1 = daily).
    if (this.spawnAccumDays < 1) return;
    this.spawnAccumDays -= 1;
    const kind = this.pickSpawnKind(sb.kinds);
    if (!kind) return;
    const m = this.spawnMonster(kind);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message:
        kind === 'dragon'
          ? `${m.name} the dragon nests in a cave!`
          : `${m.name} the ${kind} stalks the kingdom!`,
    });
    if (
      this.daysPlayed >= 6 &&
      this.monsters.length < maxMonsters &&
      Math.random() < 0.5 * sb.spawnRate
    ) {
      const extraKind = this.pickSpawnKind(sb.kinds, { excludeDragon: true });
      if (extraKind) {
        const extra = this.spawnMonster(extraKind);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${extra.name} the ${extra.kind} joins the wilds!`,
        });
      }
    }
    this.onChanged?.();
  }

  /**
   * Weighted pick favoring kinds you don't already have.
   * At most one dragon lives at a time; no extra day/RNG gate.
   */
  private pickSpawnKind(
    kinds: { troll: boolean; ogre: boolean; dragon: boolean },
    opts?: { excludeDragon?: boolean }
  ): MonsterKind | null {
    const counts = {
      troll: this.monsters.filter((m) => m.kind === 'troll').length,
      ogre: this.monsters.filter((m) => m.kind === 'ogre').length,
      dragon: this.monsters.filter((m) => m.kind === 'dragon').length,
    };
    const weighted: { kind: MonsterKind; w: number }[] = [];
    if (kinds.troll) {
      weighted.push({ kind: 'troll', w: (counts.troll === 0 ? 1.4 : 1) / (1 + counts.troll * 0.4) });
    }
    if (kinds.ogre) {
      weighted.push({ kind: 'ogre', w: (counts.ogre === 0 ? 1.6 : 1.1) / (1 + counts.ogre * 0.4) });
    }
    if (
      kinds.dragon &&
      !opts?.excludeDragon &&
      counts.dragon === 0 &&
      getCavePoints().length > 0
    ) {
      weighted.push({ kind: 'dragon', w: 1.5 });
    }
    if (!weighted.length) return null;
    const total = weighted.reduce((s, e) => s + e.w, 0);
    let roll = Math.random() * total;
    for (const e of weighted) {
      roll -= e.w;
      if (roll <= 0) return e.kind;
    }
    return weighted[weighted.length - 1]!.kind;
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
      homeX?: number;
      homeY?: number;
      influenceRadius?: number;
      hunger?: number;
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

    // Home defaults to the spawn point — dragons anchor to their cave, not
    // the (slightly-offset) sprite start position, so restores stay stable.
    const cave = kind === 'dragon' && caveId ? getCavePoints().find((c) => c.id === caveId) : null;
    const home =
      typeof opts?.homeX === 'number' && typeof opts?.homeY === 'number'
        ? { x: opts.homeX, y: opts.homeY }
        : cave
          ? { x: cave.x, y: cave.y + 8 }
          : start;

    const m: ManagedMonster = {
      id,
      kind,
      name,
      sprite,
      hp,
      maxHp,
      twoHeaded,
      homeX: home.x,
      homeY: home.y,
      influenceRadius: opts?.influenceRadius ?? CombatBalance.monsterInfluenceRadius,
      hunger: opts?.hunger ?? 0,
      hunting: false,
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
    // Ogres used to spawn on 'path' (map center / keep roads) so their home
    // sphere sat on the bailey. Nest them in the woods like trolls instead.
    const zone =
      kind === 'troll' || kind === 'ogre' ? 'forest' : 'cave';
    let pt = randomPointInZone(zone, this.world, null);
    pt = this.pushAwayFromKeep(pt, 220);
    if (this.pathGrid) {
      pt = this.pathGrid.snapWorldToOpen(pt.x, pt.y);
      pt = this.pushAwayFromKeep(pt, 200);
    }
    return pt;
  }

  /** Nudge a spawn out of the keep clearing if it landed too close. */
  private pushAwayFromKeep(pt: Point, minDist: number): Point {
    const dx = pt.x - this.keep.x;
    const dy = pt.y - this.keep.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= minDist) return pt;
    if (dist < 1) {
      const ang = Math.random() * Math.PI * 2;
      return {
        x: Phaser.Math.Clamp(
          this.keep.x + Math.cos(ang) * minDist,
          40,
          this.world.width - 40
        ),
        y: Phaser.Math.Clamp(
          this.keep.y + Math.sin(ang) * minDist,
          40,
          this.world.height - 40
        ),
      };
    }
    const scale = minDist / dist;
    return {
      x: Phaser.Math.Clamp(this.keep.x + dx * scale, 40, this.world.width - 40),
      y: Phaser.Math.Clamp(this.keep.y + dy * scale, 40, this.world.height - 40),
    };
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

    // Hunger-driven hunt — takes priority over idle wandering (but not the
    // scripted steal/smash actions above) once the monster grows ravenous.
    if (m.hunger > CombatBalance.monsterHungerHuntThreshold) {
      if (this.tickHunt(m)) return;
    } else if (m.hunting) {
      m.hunting = false;
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

  /**
   * Chases and bites the nearest kingdom subject within the monster's home
   * sphere. Returns false (letting normal roaming resume) when no prey is
   * within range. Toasts once per hunt, not on every tick.
   */
  private tickHunt(m: ManagedMonster): boolean {
    const victim = this.subjects?.nearestSubject(
      m.homeX,
      m.homeY,
      m.influenceRadius
    );
    if (!victim) return false;

    if (!m.hunting) {
      m.hunting = true;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${m.name} the ${m.kind} grows ravenous and hunts nearby!`,
      });
    }
    m.activity = 'hunt';
    m.activityLabel = 'Hunting for prey';

    const d = Phaser.Math.Distance.Between(
      m.sprite.x,
      m.sprite.y,
      victim.sprite.x,
      victim.sprite.y
    );
    if (d > CombatBalance.guardRange + 10) {
      this.nudgeToward(m, victim.sprite.x, victim.sprite.y, m.kind === 'dragon' ? 60 : 45);
      return true;
    }

    this.vfx?.meleeLunge(m.sprite, victim.sprite.x, victim.sprite.y);
    const dmg =
      m.kind === 'dragon'
        ? CombatBalance.dragonBreath
        : m.kind === 'ogre'
          ? CombatBalance.ogreSmash * 0.5
          : CombatBalance.monsterMelee;
    this.subjects?.damageSubject(victim.data.id, dmg);
    m.hunger = Math.max(0, m.hunger - CombatBalance.monsterHungerFeedRelief);
    if (m.hunger <= CombatBalance.monsterHungerHuntThreshold) m.hunting = false;
    return true;
  }

  /** Clamps a wander target to the monster's home sphere. */
  private clampToSphere(m: ManagedMonster, x: number, y: number): Point {
    const dx = x - m.homeX;
    const dy = y - m.homeY;
    const dist = Math.hypot(dx, dy);
    if (dist <= m.influenceRadius || dist === 0) return { x, y };
    const scale = m.influenceRadius / dist;
    return { x: m.homeX + dx * scale, y: m.homeY + dy * scale };
  }

  private nudgeTowardZone(m: ManagedMonster): void {
    let target = randomPointInZone(m.zone, this.world, null);
    if (m.kind === 'dragon' && m.zone === 'cave' && m.caveId) {
      const cave = getCavePoints().find((c) => c.id === m.caveId);
      if (cave) target = { x: cave.x, y: cave.y + 8 };
    }
    // Dragons leave the sphere briefly to steal gold from the keep — every
    // other wander target (and the fleeing-home leg right after) stays put.
    if (m.zone !== 'keep') {
      target = this.clampToSphere(m, target.x, target.y);
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
        let hop = Math.min(4, path.length - 1);
        while (
          hop > 1 &&
          !this.pathGrid.isSegmentClear(m.sprite.x, m.sprite.y, path[hop]!.x, path[hop]!.y)
        ) {
          hop -= 1;
        }
        x = path[hop]!.x;
        y = path[hop]!.y;
        if (!this.pathGrid.isSegmentClear(m.sprite.x, m.sprite.y, x, y)) {
          return;
        }
      } else {
        // No land path — never walk straight through rivers/lakes
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
      hunger: Math.round(m.hunger),
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

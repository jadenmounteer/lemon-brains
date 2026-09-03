import Phaser from 'phaser';
import { PROP_KEYS, isMilitaryRole, isRoyalRole } from '../art/assetManifest';
import type { Aabb, BuildingSystem } from '../buildings/BuildingSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SecuritySystem } from '../security/SecuritySystem';
import { CombatBalance } from '../combat/stats';
import { KingdomEvents } from '../subjects/events';
import { getSandboxRuntime } from '../sandboxRuntime';
import { ringOffset } from '../subjects/zones';

interface Haunt {
  houseId: string;
  ghostName: string;
}

/** Footprint dims mirror the vampire-castle canvas drawn in generateTextures.ts. */
const CASTLE_FOOTPRINT = { w: 56, h: 48 };

interface VampireCastle {
  id: string;
  x: number;
  y: number;
  hp: number;
  sprite: Phaser.GameObjects.Image;
  interiorSprite: Phaser.GameObjects.Image | null;
  lifeMs: number;
}

function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function castleFootprint(x: number, y: number): Aabb {
  return {
    left: x - CASTLE_FOOTPRINT.w / 2,
    right: x + CASTLE_FOOTPRINT.w / 2,
    top: y - CASTLE_FOOTPRINT.h,
    bottom: y,
  };
}

interface ActiveNecromancer {
  id: string;
  raiseMs: number;
}

/** Necromancers, zombies, ghosts, vampires — Phase 12.5 spooky layer. */
export class UndeadSystem {
  private necroSpawnMs = 60_000;
  private necromancers: ActiveNecromancer[] = [];
  private haunts: Haunt[] = [];
  private castles: VampireCastle[] = [];
  private nextId = 1;
  private accumMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly security: SecuritySystem
  ) {}

  update(deltaMs: number, isNight: boolean): void {
    const sb = getSandboxRuntime().undead;
    const undeadOff =
      !sb.kinds.vampire &&
      !sb.kinds.necromancer &&
      !sb.kinds.ghost &&
      sb.vampire <= 0 &&
      sb.necromancer <= 0 &&
      sb.ghost <= 0;
    if (undeadOff) return;

    this.necroSpawnMs -= deltaMs * Math.max(0.01, sb.necromancer);
    for (const c of [...this.castles]) {
      c.lifeMs -= deltaMs;
      if (c.lifeMs <= 0) this.despawnCastle(c);
    }

    // Runs every frame (not throttled below) — TaskSystem clears 'flee'
    // interrupts each non-raid tick, so haunted tenants need continuous
    // re-application to keep fleeing, same as monster-flee elsewhere.
    this.tickHauntedTenants();
    this.tickVampireWivesDaySeek(isNight);

    this.accumMs += deltaMs;
    if (this.accumMs < 1200) return;
    const tickMs = this.accumMs;
    this.accumMs = 0;

    if (
      sb.kinds.necromancer &&
      sb.necromancer > 0 &&
      isNight &&
      this.necromancers.length === 0 &&
      this.necroSpawnMs <= 0
    ) {
      this.necroSpawnMs = (140_000 + Math.random() * 100_000) / sb.necromancer;
      this.spawnNecromancer();
    }
    this.tickNecromancers(isNight, tickMs);
    this.tickZombieBites();
    this.tickMilitaryVsZombies();
    this.tickExorcists();

    if (
      sb.kinds.vampire &&
      sb.vampire > 0 &&
      isNight &&
      this.castles.length < 2 &&
      Math.random() < 0.05 * sb.vampire
    ) {
      this.spawnVampireCastle();
    }
    if (
      sb.kinds.vampire &&
      sb.vampire > 0 &&
      isNight &&
      this.castles.length > 0 &&
      Math.random() < 0.15 * sb.vampire
    ) {
      this.tryVampireBite();
    }
    this.tickVampireHunters();
    this.syncZombieCordon();
  }

  onSubjectDied(_subjectId: string, houseId: string, name: string): void {
    const sb = getSandboxRuntime().undead;
    if (!sb.kinds.ghost) return;
    const ghostMult = sb.ghost;
    if (ghostMult <= 0 || Math.random() > 0.18 * ghostMult) return;
    if (this.haunts.some((h) => h.houseId === houseId)) return;
    this.haunts.push({ houseId, ghostName: name });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${name}'s ghost haunts their home!`,
    });
  }

  hauntsHouse(houseId: string): boolean {
    return this.haunts.some((h) => h.houseId === houseId);
  }

  exorcise(houseId: string): boolean {
    const before = this.haunts.length;
    this.haunts = this.haunts.filter((h) => h.houseId !== houseId);
    return this.haunts.length < before;
  }

  isZombie(id: string): boolean {
    return this.subjects.getById(id)?.data.role === 'zombie';
  }

  clear(): void {
    for (const c of this.castles) {
      c.sprite.destroy();
      c.interiorSprite?.destroy();
    }
    this.castles = [];
    this.necromancers = [];
    this.haunts = [];
  }

  /** Hides a castle's roof (like buildings/keep) while a unit stands inside its footprint. */
  updateCastleInteriors(unitBodies: Aabb[]): void {
    for (const c of this.castles) {
      if (!c.interiorSprite) continue;
      const box = castleFootprint(c.x, c.y);
      const occupied = unitBodies.some((u) => aabbIntersects(box, u));
      c.sprite.setVisible(!occupied);
      c.interiorSprite.setVisible(occupied);
    }
  }

  /**
   * By day, vampire wives retreat into their castle's footprint (out of the
   * sun); by night they head back out to prowl and bite as before — handled
   * by their normal schedule (`vampireWifeSchedule`'s 'hunt' slots).
   */
  private tickVampireWivesDaySeek(isNight: boolean): void {
    if (isNight || !this.castles.length) return;
    for (const s of this.subjects.listManaged()) {
      if (s.data.role !== 'vampire_wife' || !s.sprite.active || s.interrupt) {
        continue;
      }
      const castle = [...this.castles].sort(
        (a, b) =>
          Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, a.x, a.y) -
          Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, b.x, b.y)
      )[0];
      if (!castle) continue;
      const d = Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, castle.x, castle.y);
      if (d > 10) {
        this.subjects.nudgeToward(s.data.id, castle.x, castle.y - 4, 42);
      }
    }
  }

  // --- Necromancers -------------------------------------------------------

  /** Sandbox: spawn a necromancer near the cemetery (or keep). */
  debugSpawnNecromancer(): boolean {
    return this.spawnNecromancer(true);
  }

  /** Sandbox: plant a vampire castle on the fringe. */
  debugSpawnVampireCastle(): boolean {
    return this.spawnVampireCastle(true);
  }

  /** Sandbox: haunt a random house. */
  debugSpawnGhost(): boolean {
    const house = this.buildings
      .list()
      .find((b) => b.kind === 'house' || b.kind === 'keep');
    if (!house) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Sandbox: need a house or keep to haunt',
      });
      return false;
    }
    if (this.haunts.some((h) => h.houseId === house.id)) {
      this.haunts = this.haunts.filter((h) => h.houseId !== house.id);
    }
    this.haunts.push({ houseId: house.id, ghostName: 'Sandbox Specter' });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Sandbox: a ghost haunts a home!',
    });
    return true;
  }

  private spawnNecromancer(force = false): boolean {
    if (!force && !getSandboxRuntime().undead.kinds.necromancer) return false;
    const cem =
      this.buildings.getCemeteryPoint() ?? this.buildings.getActiveKeepPoint();
    if (!cem) return false;
    const id = this.subjects.spawnNecromancerNear(cem.x, cem.y);
    if (!id) return false;
    this.necromancers.push({ id, raiseMs: 8000 + Math.random() * 6000 });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: force
        ? 'Sandbox: a necromancer stirs!'
        : 'A necromancer stirs among the graves!',
    });
    return true;
  }

  private tickNecromancers(isNight: boolean, tickMs: number): void {
    for (const n of [...this.necromancers]) {
      const managed = this.subjects.getById(n.id);
      if (!managed || !managed.sprite.active) {
        this.necromancers = this.necromancers.filter((x) => x !== n);
        continue;
      }

      if (!isNight) {
        this.subjects.extractCaptive(n.id);
        this.necromancers = this.necromancers.filter((x) => x !== n);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'The necromancer flees with the dawn.',
        });
        continue;
      }

      // Guards arrest necromancers rather than melee-kill them (reuses the
      // ransom/captive path — same pattern as raid royal captures).
      const guard = this.subjects.nearestMilitary(
        managed.sprite.x,
        managed.sprite.y,
        CombatBalance.necromancerArrestRange
      );
      if (guard && this.buildings.hasDungeon()) {
        this.necromancers = this.necromancers.filter((x) => x !== n);
        this.scene.game.events.emit(KingdomEvents.ROYAL_CAPTURED, {
          id: managed.data.id,
          name: managed.data.name,
          role: managed.data.role,
          houseId: managed.data.houseId,
          maxHp: managed.data.maxHp,
        });
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${managed.data.name} the necromancer was arrested!`,
        });
        continue;
      }

      n.raiseMs -= tickMs;
      if (n.raiseMs <= 0) {
        n.raiseMs = 10_000 + Math.random() * 8000;
        this.raiseZombieNear(managed.sprite.x, managed.sprite.y);
      }
    }
  }

  private raiseZombieNear(x: number, y: number): void {
    const victim = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.data.role === 'peasant' &&
          Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y) < 220
      )
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(x, y, a.sprite.x, a.sprite.y) -
          Phaser.Math.Distance.Between(x, y, b.sprite.x, b.sprite.y)
      )[0];
    if (!victim) return;
    this.turnIntoZombie(victim.data.id);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A necromancer raises the dead — a zombie shambles forth!',
    });
  }

  private turnIntoZombie(id: string): void {
    const managed = this.subjects.getById(id);
    if (!managed || managed.data.role === 'zombie') return;
    this.subjects.transformRole(id, 'zombie');
    this.subjects.clearInterrupt(id);
    managed.data.thought = 'Braaaains…';
    // Quarantine cordons disabled for now — soldiers still fight zombies.
  }

  // --- Zombies -------------------------------------------------------------

  private tickZombieBites(): void {
    const zombies = this.subjects
      .listManaged()
      .filter((s) => s.data.role === 'zombie' && s.sprite.active);
    if (!zombies.length) return;

    for (const z of zombies) {
      const victim = this.subjects.listManaged().find(
        (s) =>
          s.data.id !== z.data.id &&
          s.sprite.active &&
          s.data.role !== 'zombie' &&
          s.data.role !== 'necromancer' &&
          s.data.role !== 'vampire_wife' &&
          !isMilitaryRole(s.data.role) &&
          !isRoyalRole(s.data.role) &&
          Phaser.Math.Distance.Between(
            z.sprite.x,
            z.sprite.y,
            s.sprite.x,
            s.sprite.y
          ) < CombatBalance.zombieBiteRange
      );
      if (!victim) continue;
      if (Math.random() > 0.35) continue;
      this.turnIntoZombie(victim.data.id);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${victim.data.name} was bitten — the outbreak spreads!`,
      });
    }
  }

  /** Military auto-aggro: engage any zombie that wanders into range. */
  private tickMilitaryVsZombies(): void {
    const zombies = this.subjects
      .listManaged()
      .filter((s) => s.data.role === 'zombie' && s.sprite.active);
    if (!zombies.length) return;

    for (const m of this.subjects.listManaged()) {
      if (!isMilitaryRole(m.data.role) || m.data.sick || m.data.onWall) continue;
      if (m.interrupt) continue;
      const target = zombies
        .filter((z) => z.sprite.active)
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, a.sprite.x, a.sprite.y) -
            Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, b.sprite.x, b.sprite.y)
        )[0];
      if (!target) continue;
      const d = Phaser.Math.Distance.Between(
        m.sprite.x,
        m.sprite.y,
        target.sprite.x,
        target.sprite.y
      );
      if (d > CombatBalance.aggroRadius) continue;
      if (d > CombatBalance.guardRange) {
        this.subjects.nudgeToward(m.data.id, target.sprite.x, target.sprite.y, 50);
        m.data.thought = 'A zombie! To arms!';
        continue;
      }
      this.subjects.damageSubject(target.data.id, CombatBalance.zombieMeleeDamage);
      m.data.thought = 'Cut it down!';
    }
  }

  /** Clears the zombie cordon once the outbreak has been put down. */
  private syncZombieCordon(): void {
    if (this.security.activeKind() !== 'zombie') return;
    const stillOut = this.subjects
      .listManaged()
      .some((s) => s.data.role === 'zombie');
    if (!stillOut) this.security.clear();
  }

  // --- Ghosts ---------------------------------------------------------------

  private tickHauntedTenants(): void {
    if (!this.haunts.length) return;
    const safe = this.buildings.getActiveKeepPoint();
    const fleeing: { id: string; houseId: string }[] = [];
    for (const h of this.haunts) {
      for (const s of this.subjects.listManaged()) {
        if (s.data.houseId !== h.houseId) continue;
        if (isMilitaryRole(s.data.role)) continue;
        if (s.data.role === 'bishop' || s.data.role === 'witch_hunter') continue;
        if (s.interrupt && s.interrupt.kind !== 'flee') continue;
        if (!s.interrupt) {
          s.interrupt = { kind: 'flee' };
          s.data.activity = 'flee';
          s.data.activityLabel = 'Fleeing a haunted house';
          s.data.thought = 'A ghost! We must leave!';
        }
        fleeing.push({ id: s.data.id, houseId: h.houseId });
      }
    }
    fleeing.forEach((f, i) => {
      const off = ringOffset(i, fleeing.length, 56);
      const dest = this.subjects.snapToWalkable(
        safe.x + off.x,
        safe.y + off.y + 20
      );
      this.subjects.nudgeToward(f.id, dest.x, dest.y, 55);
    });
  }

  private releaseHauntedTenants(houseId: string): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.houseId !== houseId) continue;
      if (s.interrupt?.kind === 'flee') {
        this.subjects.clearInterrupt(s.data.id);
        s.data.thought = 'The spirit is gone. We can go home.';
      }
    }
  }

  /** Bishops and witch hunters seek out haunted homes and exorcise them. */
  private tickExorcists(): void {
    if (!this.haunts.length) {
      for (const s of this.subjects.withInterrupt('exorcise')) {
        this.subjects.clearInterrupt(s.data.id);
      }
      return;
    }

    const claimed = new Set(
      this.subjects
        .listInterrupts('exorcise')
        .map((i) => i.targetId)
        .filter(Boolean) as string[]
    );
    const free = this.subjects
      .listManaged()
      .filter(
        (s) =>
          (s.data.role === 'bishop' || s.data.role === 'witch_hunter') &&
          !s.interrupt
      );
    for (const h of this.haunts) {
      if (claimed.has(h.houseId)) continue;
      const exorcist = free.shift();
      if (!exorcist) break;
      exorcist.interrupt = { kind: 'exorcise', targetId: h.houseId };
      exorcist.data.activity = 'exorcise';
      exorcist.data.activityLabel = 'Exorcising a haunted home';
      claimed.add(h.houseId);
    }

    for (const managed of this.subjects.withInterrupt('exorcise')) {
      const houseId = managed.interrupt?.targetId;
      if (!houseId || !this.hauntsHouse(houseId)) {
        this.subjects.clearInterrupt(managed.data.id);
        continue;
      }
      const house = this.buildings.getHousePoint(houseId);
      if (!house) {
        this.subjects.clearInterrupt(managed.data.id);
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        managed.sprite.x,
        managed.sprite.y,
        house.x,
        house.y
      );
      if (dist > 30) {
        this.subjects.nudgeToward(managed.data.id, house.x, house.y, 45);
        continue;
      }
      this.exorcise(houseId);
      this.releaseHauntedTenants(houseId);
      this.subjects.appendLifeLog(
        managed.data.id,
        'Cast out a restless spirit',
        'exorcise'
      );
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${managed.data.name} exorcises the haunted home!`,
      });
      this.subjects.clearInterrupt(managed.data.id);
    }
  }

  // --- Vampires ---------------------------------------------------------------

  private spawnVampireCastle(force = false): boolean {
    if (!force && !getSandboxRuntime().undead.kinds.vampire) return false;
    const keep = this.buildings.getActiveKeepPoint();
    for (let attempt = 0; attempt < 40; attempt++) {
      const cx =
        keep.x + (Math.random() < 0.5 ? -1 : 1) * (280 + Math.random() * 200);
      const cy =
        keep.y + (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 160);
      if (!this.buildings.isLandAt(cx, cy - 8)) continue;
      if (!this.buildings.isLandAt(cx, cy - 20)) continue;
      const id = `vamp-castle-${this.nextId++}`;
      const sprite = this.scene.add
        .image(cx, cy, PROP_KEYS.vampireCastle)
        .setDepth(8)
        .setOrigin(0.5, 1);
      const interiorSprite = this.scene.textures.exists(PROP_KEYS.vampireCastleInterior)
        ? this.scene.add
            .image(cx, cy, PROP_KEYS.vampireCastleInterior)
            .setDepth(8)
            .setOrigin(0.5, 1)
            .setVisible(false)
        : null;
      this.castles.push({
        id,
        x: cx,
        y: cy,
        hp: 40,
        sprite,
        interiorSprite,
        lifeMs: 180_000 + Math.random() * 120_000,
      });
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: force
          ? 'Sandbox: a vampire castle appears!'
          : 'A vampire castle appears on the fringe!',
      });
      return true;
    }
    if (force) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Sandbox: no land for a vampire castle',
      });
    }
    return false;
  }

  private tryVampireBite(): void {
    const castle = this.castles[0];
    if (!castle) return;
    const victim = this.subjects.listManaged().find(
      (s) =>
        s.data.gender === 'female' &&
        s.sprite.active &&
        s.data.role !== 'witch' &&
        s.data.role !== 'vampire_wife' &&
        !isRoyalRole(s.data.role) &&
        Phaser.Math.Distance.Between(castle.x, castle.y, s.sprite.x, s.sprite.y) < 320
    );
    if (!victim) return;
    this.subjects.transformRole(victim.data.id, 'vampire_wife');
    this.subjects.clearInterrupt(victim.data.id);
    victim.data.thought = 'A bat… fangs… I am changed.';
    this.subjects.appendLifeLog(victim.data.id, 'Claimed by a vampire', 'curse');
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${victim.data.name} was claimed by a vampire!`,
    });
  }

  /** Knights and witch hunters hunt down vampire castles on the fringe. */
  private tickVampireHunters(): void {
    if (!this.castles.length) return;
    for (const h of this.subjects.listManaged()) {
      if (h.data.role !== 'knight' && h.data.role !== 'witch_hunter') continue;
      if (h.interrupt) continue;
      const castle = [...this.castles].sort(
        (a, b) =>
          Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, a.x, a.y) -
          Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, b.x, b.y)
      )[0];
      if (!castle) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, castle.x, castle.y);
      if (d > CombatBalance.knightHuntRange) continue;
      if (d > 30) {
        this.subjects.nudgeToward(h.data.id, castle.x, castle.y, 48);
        h.data.thought = 'A vampire’s lair… I will end it.';
        continue;
      }
      castle.hp -= h.data.role === 'knight' ? CombatBalance.knightMelee : CombatBalance.guardMelee;
      h.data.thought = 'Striking the castle gates!';
      if (castle.hp <= 0) {
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${h.data.name} brings down the vampire castle!`,
        });
        this.subjects.appendLifeLog(h.data.id, 'Destroyed a vampire castle', 'hunt');
        this.despawnCastle(castle);
        if (!this.castles.length) break;
      }
    }
  }

  private despawnCastle(c: VampireCastle): void {
    c.sprite.destroy();
    c.interiorSprite?.destroy();
    this.castles = this.castles.filter((x) => x !== c);
  }
}

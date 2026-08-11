import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SecuritySystem } from '../security/SecuritySystem';
import { KingdomEvents } from '../subjects/events';
import { pickName } from '../subjects/names';

interface Haunt {
  houseId: string;
  ghostName: string;
}

interface VampireCastle {
  id: string;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  lifeMs: number;
}

/** Necromancers, zombies, ghosts, vampires — Phase 12.5 spooky layer. */
export class UndeadSystem {
  private necroSpawnMs = 90_000;
  private zombieIds = new Set<string>();
  private haunts: Haunt[] = [];
  private castles: VampireCastle[] = [];
  private nextId = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly security: SecuritySystem
  ) {}

  update(deltaMs: number, isNight: boolean): void {
    this.necroSpawnMs -= deltaMs;
    if (isNight && this.necroSpawnMs <= 0) {
      this.necroSpawnMs = 120_000 + Math.random() * 90_000;
      this.tryRaiseZombies();
    }
    for (const c of [...this.castles]) {
      c.lifeMs -= deltaMs;
      if (c.lifeMs <= 0) this.despawnCastle(c);
    }
    if (isNight && Math.random() < 0.0008) this.spawnVampireCastle();
    if (isNight && this.castles.length > 0 && Math.random() < 0.002) {
      this.tryVampireBite();
    }
  }

  onSubjectDied(subjectId: string, houseId: string, name: string): void {
    if (Math.random() > 0.18) return;
    this.haunts.push({ houseId, ghostName: name });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${name}'s ghost haunts their home!`,
    });
    // Tenants flee
    for (const s of this.subjects.listManaged()) {
      if (s.data.houseId !== houseId || s.data.id === subjectId) continue;
      s.data.thought = 'A ghost! We must leave!';
      s.data.activityLabel = 'Fleeing a haunted house';
    }
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
    return this.zombieIds.has(id);
  }

  private tryRaiseZombies(): void {
    const cem = this.buildings.getCemeteryPoint();
    if (!cem) return;
    this.security.begin('zombie', cem.x, cem.y, 160);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A necromancer raises the dead in the cemetery!',
    });
    // Convert a nearby peasant if any
    for (const s of this.subjects.listManaged()) {
      if (s.data.role !== 'peasant') continue;
      const d = Phaser.Math.Distance.Between(
        cem.x,
        cem.y,
        s.sprite.x,
        s.sprite.y
      );
      if (d > 200) continue;
      this.zombieIds.add(s.data.id);
      s.data.thought = 'Braaaaains…';
      s.data.activityLabel = 'Shambling as a zombie';
      s.data.happiness = 0;
      break;
    }
  }

  private spawnVampireCastle(): void {
    if (this.castles.length >= 2) return;
    // place on map fringe using keep-relative offset
    const keep = this.buildings.getActiveKeepPoint();
    const cx = keep.x + (Math.random() < 0.5 ? -1 : 1) * (280 + Math.random() * 200);
    const cy = keep.y + (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 160);
    const id = `vamp-castle-${this.nextId++}`;
    const sprite = this.scene.add
      .image(cx, cy, PROP_KEYS.vampireCastle)
      .setDepth(8)
      .setOrigin(0.5, 1);
    this.castles.push({
      id,
      x: cx,
      y: cy,
      sprite,
      lifeMs: 180_000 + Math.random() * 120_000,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A vampire castle appears on the fringe!',
    });
  }

  private tryVampireBite(): void {
    const castle = this.castles[0];
    if (!castle) return;
    for (const s of this.subjects.listManaged()) {
      if (s.data.gender !== 'female') continue;
      if (s.data.role === 'witch') continue;
      const d = Phaser.Math.Distance.Between(
        castle.x,
        castle.y,
        s.sprite.x,
        s.sprite.y
      );
      if (d > 320) continue;
      s.data.thought = 'A bat… fangs… I am changed.';
      s.data.activityLabel = 'Cursed as a vampire wife';
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${s.data.name || pickName(1)} was claimed by a vampire!`,
      });
      break;
    }
  }

  private despawnCastle(c: VampireCastle): void {
    c.sprite.destroy();
    this.castles = this.castles.filter((x) => x !== c);
  }

  clear(): void {
    for (const c of this.castles) c.sprite.destroy();
    this.castles = [];
    this.zombieIds.clear();
    this.haunts = [];
  }
}

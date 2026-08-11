import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { HungerSystem } from '../economy/HungerSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';

interface Boat {
  id: string;
  kind: 'fishing' | 'warship' | 'pirate';
  sprite: Phaser.GameObjects.Image;
  dockId: string | null;
  foodCooldownMs: number;
}

/** Docks, fishing boats, pirates, and warships. */
export class NavalSystem {
  private boats: Boat[] = [];
  private pirateMs = 100_000;
  private nextId = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly buildings: BuildingSystem,
    private readonly subjects: SubjectSystem,
    private readonly hunger: HungerSystem
  ) {}

  update(deltaMs: number): void {
    this.pirateMs -= deltaMs;
    if (this.pirateMs <= 0) {
      this.pirateMs = 140_000 + Math.random() * 80_000;
      this.tryPirateRaid();
    }
    for (const b of this.boats) {
      if (b.kind !== 'fishing') continue;
      b.foodCooldownMs -= deltaMs;
      if (b.foodCooldownMs > 0) continue;
      b.foodCooldownMs = 25_000;
      // Fishermen at docks contribute food
      const fishers = this.subjects
        .listManaged()
        .filter(
          (s) =>
            s.data.job === 'fisherman' ||
            (s.data.workplaceId &&
              this.buildings.list().some(
                (d) => d.id === s.data.workplaceId && d.kind === 'dock'
              ))
        );
      if (fishers.length === 0) continue;
      this.hunger.addFood(2);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Fishing boats return with a catch!',
      });
    }
    this.ensureBoatsForDocks();
  }

  private ensureBoatsForDocks(): void {
    const docks = this.buildings.list().filter((b) => b.kind === 'dock' && b.hp > 0);
    for (const d of docks) {
      if (this.boats.some((b) => b.dockId === d.id && b.kind === 'fishing')) continue;
      const sprite = this.scene.add
        .image(d.x + 20, d.y + 10, PROP_KEYS.fishingBoat)
        .setDepth(9)
        .setOrigin(0.5, 1);
      this.boats.push({
        id: `boat-${this.nextId++}`,
        kind: 'fishing',
        sprite,
        dockId: d.id,
        foodCooldownMs: 20_000,
      });
    }
  }

  private tryPirateRaid(): void {
    const docks = this.buildings.list().filter((b) => b.kind === 'dock' && b.hp > 0);
    if (docks.length === 0) return;
    const dock = docks[Math.floor(Math.random() * docks.length)]!;
    const sprite = this.scene.add
      .image(dock.x - 40, dock.y + 8, PROP_KEYS.warship)
      .setDepth(9)
      .setTint(0x8b2e2e)
      .setOrigin(0.5, 1);
    const id = `pirate-${this.nextId++}`;
    this.boats.push({
      id,
      kind: 'pirate',
      sprite,
      dockId: dock.id,
      foodCooldownMs: 0,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Pirates raid the dock!',
    });
    this.scene.time.delayedCall(12_000, () => {
      const boat = this.boats.find((b) => b.id === id);
      if (!boat) return;
      boat.sprite.destroy();
      this.boats = this.boats.filter((b) => b !== boat);
      dock.hp = Math.max(1, dock.hp - 8);
    });
  }

  clear(): void {
    for (const b of this.boats) b.sprite.destroy();
    this.boats = [];
  }
}

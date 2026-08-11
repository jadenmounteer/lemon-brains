import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingRecord, BuildingSystem } from '../buildings/BuildingSystem';
import type { HungerSystem } from '../economy/HungerSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';

/** Naval balance — kept local since only NavalSystem consumes these. */
export const NavalBalance = {
  /** Extra boats a single dock can host (the first is free). */
  fishingBoatsPerDock: 2,
  /** Warships a single dock can host. */
  warshipsPerDock: 1,
  /** Guards required to fully crew a warship. */
  crewPerWarship: 2,
  fishTripMs: 9000,
  fishCooldownMs: 6000,
  fishBoardRange: 26,
  foodPerTrip: 3,
  pirateIntervalMinMs: 140_000,
  pirateIntervalRangeMs: 80_000,
  pirateHp: 26,
  warshipMaxHp: 60,
  warshipDamagePerTick: 7,
  pirateDamagePerTick: 5,
  combatTickMs: 500,
  meleeRange: 18,
  chaseStep: 0.45,
  warshipRegenPerSec: 0.4,
  dockRaidDamage: 8,
  sinkBoatChance: 0.3,
} as const;

type BoatKind = 'fishing' | 'warship' | 'pirate';
type FishingState = 'docked' | 'walking' | 'sailing';

interface Boat {
  id: string;
  kind: BoatKind;
  sprite: Phaser.GameObjects.Image;
  dockId: string | null;
  /** Anchor point the boat returns to when docked/idle. */
  homeX: number;
  homeY: number;
  /** Unit-ish direction from the dock out toward open water, used for short sailing loops. */
  dirX: number;
  dirY: number;
  state: FishingState;
  /** Fishing boats only — the peasant currently out on a trip. */
  fishermanId: string | null;
  foodCooldownMs: number;
  /** Warships only — crewing guards; combat boats only — hit points. */
  crew: string[];
  hp: number;
  maxHp: number;
  /** Extra vessels bought by the player aren't auto-replaced by `ensureBoatsForDocks`. */
  purchased: boolean;
  /** Pirates only — the warship id currently giving chase, if any. */
  engagedWarshipId: string | null;
}

/** Docks, fishing boats, pirates, and player-crewed warships. */
export class NavalSystem {
  private boats: Boat[] = [];
  private pirateMs = 100_000;
  private nextId = 1;
  private combatAccumMs = 0;
  private regenAccumMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly buildings: BuildingSystem,
    private readonly subjects: SubjectSystem,
    private readonly hunger: HungerSystem
  ) {}

  update(deltaMs: number): void {
    this.pirateMs -= deltaMs;
    if (this.pirateMs <= 0) {
      this.pirateMs =
        NavalBalance.pirateIntervalMinMs +
        Math.random() * NavalBalance.pirateIntervalRangeMs;
      this.tryPirateRaid();
    }

    this.ensureBoatsForDocks();
    this.assignCrew();
    this.assignFishingTrips();
    this.tickFishing(deltaMs);
    this.tickPirateCombat(deltaMs);
    this.tickWarshipRegen(deltaMs);
  }

  // ---------------------------------------------------------------------
  // Marketplace purchases
  // ---------------------------------------------------------------------

  /** Buy an extra fishing boat for a dock under capacity. Returns success. */
  buyFishingBoat(): boolean {
    const docks = this.activeDocks();
    for (const dock of docks) {
      const count = this.boats.filter(
        (b) => b.kind === 'fishing' && b.dockId === dock.id
      ).length;
      if (count < 1 + NavalBalance.fishingBoatsPerDock) {
        this.spawnFishingBoat(dock, true);
        return true;
      }
    }
    return false;
  }

  /** Buy a warship stationed at a dock under capacity. Returns success. */
  buyWarship(): boolean {
    const docks = this.activeDocks();
    for (const dock of docks) {
      const count = this.boats.filter(
        (b) => b.kind === 'warship' && b.dockId === dock.id
      ).length;
      if (count < NavalBalance.warshipsPerDock) {
        this.spawnWarship(dock);
        return true;
      }
    }
    return false;
  }

  dockCount(): number {
    return this.activeDocks().length;
  }

  fishingBoatCount(): number {
    return this.boats.filter((b) => b.kind === 'fishing').length;
  }

  fishingBoatCapacity(): number {
    return this.dockCount() * (1 + NavalBalance.fishingBoatsPerDock);
  }

  warshipCount(): number {
    return this.boats.filter((b) => b.kind === 'warship').length;
  }

  warshipCapacity(): number {
    return this.dockCount() * NavalBalance.warshipsPerDock;
  }

  clear(): void {
    for (const b of this.boats) {
      this.scene.tweens.killTweensOf(b.sprite);
      b.sprite.destroy();
    }
    this.boats = [];
  }

  // ---------------------------------------------------------------------
  // Fishing boats
  // ---------------------------------------------------------------------

  private activeDocks(): BuildingRecord[] {
    return this.buildings.list().filter((b) => b.kind === 'dock' && b.hp > 0);
  }

  private ensureBoatsForDocks(): void {
    for (const dock of this.activeDocks()) {
      const hasFreeBoat = this.boats.some(
        (b) => b.dockId === dock.id && b.kind === 'fishing' && !b.purchased
      );
      if (!hasFreeBoat) this.spawnFishingBoat(dock, false);
    }
  }

  private spawnFishingBoat(dock: BuildingRecord, purchased: boolean): void {
    const dirX = 0.9;
    const dirY = 0.45;
    const x = dock.x + 20;
    const y = dock.y + 10;
    const sprite = this.scene.add
      .image(x, y, PROP_KEYS.fishingBoat)
      .setDepth(9)
      .setOrigin(0.5, 1);
    this.boats.push({
      id: `boat-${this.nextId++}`,
      kind: 'fishing',
      sprite,
      dockId: dock.id,
      homeX: x,
      homeY: y,
      dirX,
      dirY,
      state: 'docked',
      fishermanId: null,
      foodCooldownMs: 0,
      crew: [],
      hp: 0,
      maxHp: 0,
      purchased,
      engagedWarshipId: null,
    });
  }

  /** Peasants working a dock, free to sail, board an idle boat and head out to sea. */
  private assignFishingTrips(): void {
    for (const dock of this.activeDocks()) {
      const idleBoat = this.boats.find(
        (b) =>
          b.kind === 'fishing' &&
          b.dockId === dock.id &&
          b.state === 'docked' &&
          b.foodCooldownMs <= 0
      );
      if (!idleBoat) continue;
      const fisherman = this.subjects.listManaged().find(
        (s) =>
          s.data.job === 'fisherman' &&
          s.data.workplaceId === dock.id &&
          !s.interrupt &&
          !s.data.onWall &&
          !s.data.sick &&
          s.sprite.active
      );
      if (!fisherman) continue;
      idleBoat.state = 'walking';
      idleBoat.fishermanId = fisherman.data.id;
      this.subjects.beginFish(fisherman.data.id, dock.id);
    }
  }

  private tickFishing(deltaMs: number): void {
    for (const boat of [...this.boats]) {
      if (boat.kind !== 'fishing') continue;
      if (boat.state === 'docked') {
        if (boat.foodCooldownMs > 0) boat.foodCooldownMs -= deltaMs;
        continue;
      }
      const fisherman = boat.fishermanId
        ? this.subjects.getById(boat.fishermanId)
        : undefined;
      if (
        !fisherman ||
        fisherman.interrupt?.kind !== 'fish' ||
        fisherman.interrupt.targetId !== boat.dockId
      ) {
        this.abortFishingBoat(boat, false);
        continue;
      }
      if (boat.state === 'walking') {
        const dist = Phaser.Math.Distance.Between(
          fisherman.sprite.x,
          fisherman.sprite.y,
          boat.homeX,
          boat.homeY
        );
        if (dist > NavalBalance.fishBoardRange) {
          this.subjects.nudgeToward(fisherman.data.id, boat.homeX, boat.homeY, 45);
          continue;
        }
        fisherman.sprite.setPosition(boat.homeX, boat.homeY);
        boat.state = 'sailing';
        this.startSailTween(boat, fisherman.sprite);
      }
      // 'sailing' resolves itself via the tween's onComplete below.
    }
  }

  private startSailTween(boat: Boat, rider: Phaser.GameObjects.Sprite): void {
    const dist = 46 + Math.random() * 26;
    const outX = boat.homeX + boat.dirX * dist;
    const outY = boat.homeY + boat.dirY * dist;
    this.scene.tweens.add({
      targets: [boat.sprite, rider],
      x: outX,
      y: outY,
      duration: NavalBalance.fishTripMs / 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!boat.sprite.active) return;
        this.scene.tweens.add({
          targets: [boat.sprite, rider],
          x: boat.homeX,
          y: boat.homeY,
          duration: NavalBalance.fishTripMs / 2,
          ease: 'Sine.easeInOut',
          onComplete: () => this.finishFishingTrip(boat),
        });
      },
    });
  }

  private finishFishingTrip(boat: Boat): void {
    const fishermanId = boat.fishermanId;
    boat.state = 'docked';
    boat.fishermanId = null;
    boat.foodCooldownMs = NavalBalance.fishCooldownMs;
    if (fishermanId) {
      const managed = this.subjects.getById(fishermanId);
      if (managed?.interrupt?.kind === 'fish') {
        this.subjects.clearInterrupt(fishermanId);
      }
    }
    this.hunger.addFood(NavalBalance.foodPerTrip);
    if (Math.random() < 0.4) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'A fishing boat returns with a fine catch!',
      });
    }
  }

  /** Stop a trip early (sickness clears the interrupt, or the boat is sunk by pirates). */
  private abortFishingBoat(boat: Boat, destroy: boolean): void {
    this.scene.tweens.killTweensOf(boat.sprite);
    if (boat.fishermanId) {
      const managed = this.subjects.getById(boat.fishermanId);
      if (managed) {
        this.scene.tweens.killTweensOf(managed.sprite);
        if (managed.interrupt?.kind === 'fish') {
          this.subjects.clearInterrupt(boat.fishermanId);
        }
        managed.sprite.setPosition(boat.homeX, boat.homeY);
      }
    }
    if (destroy) {
      boat.sprite.destroy();
      this.boats = this.boats.filter((b) => b !== boat);
    } else {
      boat.sprite.setPosition(boat.homeX, boat.homeY);
      boat.state = 'docked';
      boat.fishermanId = null;
      boat.foodCooldownMs = NavalBalance.fishCooldownMs * 0.4;
    }
  }

  // ---------------------------------------------------------------------
  // Warships
  // ---------------------------------------------------------------------

  private spawnWarship(dock: BuildingRecord): void {
    const x = dock.x + 34;
    const y = dock.y + 16;
    const sprite = this.scene.add
      .image(x, y, PROP_KEYS.warship)
      .setDepth(9)
      .setOrigin(0.5, 1);
    this.boats.push({
      id: `warship-${this.nextId++}`,
      kind: 'warship',
      sprite,
      dockId: dock.id,
      homeX: x,
      homeY: y,
      dirX: 0.9,
      dirY: 0.45,
      state: 'docked',
      fishermanId: null,
      foodCooldownMs: 0,
      crew: [],
      hp: NavalBalance.warshipMaxHp,
      maxHp: NavalBalance.warshipMaxHp,
      purchased: true,
      engagedWarshipId: null,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A warship awaits crew at the dock',
    });
  }

  /** Free guards volunteer as crew until a warship is fully staffed. */
  private assignCrew(): void {
    const understaffed = this.boats.filter(
      (b) => b.kind === 'warship' && b.crew.length < NavalBalance.crewPerWarship
    );
    if (!understaffed.length) return;
    const freeGuards = [
      ...this.subjects.listFreeForNaval('guard'),
      ...this.subjects.listFreeForNaval('elite_guard'),
    ];
    for (const ship of understaffed) {
      while (ship.crew.length < NavalBalance.crewPerWarship && freeGuards.length) {
        const guard = freeGuards.shift()!;
        ship.crew.push(guard.data.id);
        this.subjects.beginCrew(guard.data.id, ship.id);
      }
    }
  }

  private tickWarshipRegen(deltaMs: number): void {
    this.regenAccumMs += deltaMs;
    if (this.regenAccumMs < 1000) return;
    const seconds = this.regenAccumMs / 1000;
    this.regenAccumMs = 0;
    for (const ship of this.boats) {
      if (ship.kind !== 'warship') continue;
      if (this.boats.some((p) => p.kind === 'pirate' && p.engagedWarshipId === ship.id)) {
        continue;
      }
      ship.hp = Math.min(
        ship.maxHp,
        ship.hp + NavalBalance.warshipRegenPerSec * seconds
      );
    }
  }

  // ---------------------------------------------------------------------
  // Pirates
  // ---------------------------------------------------------------------

  private tryPirateRaid(): void {
    const docks = this.activeDocks();
    if (docks.length === 0) return;
    const dock = docks[Math.floor(Math.random() * docks.length)]!;
    const x = dock.x - 40;
    const y = dock.y + 8;
    const sprite = this.scene.add
      .image(x, y, PROP_KEYS.warship)
      .setDepth(9)
      .setTint(0x8b2e2e)
      .setOrigin(0.5, 1);
    const id = `pirate-${this.nextId++}`;
    const pirate: Boat = {
      id,
      kind: 'pirate',
      sprite,
      dockId: dock.id,
      homeX: x,
      homeY: y,
      dirX: -1,
      dirY: 0.2,
      state: 'docked',
      fishermanId: null,
      foodCooldownMs: 0,
      crew: [],
      hp: NavalBalance.pirateHp,
      maxHp: NavalBalance.pirateHp,
      purchased: false,
      engagedWarshipId: null,
    };
    this.boats.push(pirate);

    const warship = this.boats.find(
      (b) => b.kind === 'warship' && b.dockId === dock.id && b.crew.length > 0
    );
    if (warship) {
      pirate.engagedWarshipId = warship.id;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Pirates raid the dock — your warship gives chase!',
      });
      return;
    }

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Pirates raid the dock!',
    });
    this.scene.time.delayedCall(12_000, () => {
      const stillHere = this.boats.find((b) => b.id === id);
      if (!stillHere) return;
      this.destroyPirate(stillHere, false);
      const d = this.buildings.getById(dock.id);
      if (d) d.hp = Math.max(1, d.hp - NavalBalance.dockRaidDamage);
      this.maybeSinkBoatAt(dock.id);
    });
  }

  private tickPirateCombat(deltaMs: number): void {
    this.combatAccumMs += deltaMs;
    if (this.combatAccumMs < NavalBalance.combatTickMs) return;
    this.combatAccumMs = 0;

    for (const pirate of [...this.boats]) {
      if (pirate.kind !== 'pirate' || !pirate.engagedWarshipId) continue;
      const warship = this.boats.find((b) => b.id === pirate.engagedWarshipId);
      if (!warship) {
        pirate.engagedWarshipId = null;
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        warship.sprite.x,
        warship.sprite.y,
        pirate.sprite.x,
        pirate.sprite.y
      );
      if (dist > NavalBalance.meleeRange) {
        warship.sprite.x +=
          (pirate.sprite.x - warship.sprite.x) * NavalBalance.chaseStep;
        warship.sprite.y +=
          (pirate.sprite.y - warship.sprite.y) * NavalBalance.chaseStep;
        continue;
      }

      pirate.hp -= NavalBalance.warshipDamagePerTick;
      warship.hp -= NavalBalance.pirateDamagePerTick;

      if (pirate.hp <= 0) {
        this.destroyPirate(pirate, true);
        continue;
      }
      if (warship.hp <= 0) {
        const dockId = warship.dockId;
        this.destroyWarship(warship);
        this.destroyPirate(pirate, false);
        const d = dockId ? this.buildings.getById(dockId) : undefined;
        if (d) d.hp = Math.max(1, d.hp - NavalBalance.dockRaidDamage);
        this.maybeSinkBoatAt(dockId);
      }
    }
  }

  private destroyPirate(pirate: Boat, warshipWon: boolean): void {
    this.scene.tweens.killTweensOf(pirate.sprite);
    pirate.sprite.destroy();
    this.boats = this.boats.filter((b) => b !== pirate);
    if (warshipWon) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Your warship drives off the pirates!',
      });
    }
  }

  private destroyWarship(warship: Boat): void {
    this.scene.tweens.killTweensOf(warship.sprite);
    for (const crewId of warship.crew) {
      this.subjects.clearInterrupt(crewId);
    }
    warship.sprite.destroy();
    this.boats = this.boats.filter((b) => b !== warship);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Pirates sink your warship!',
    });
  }

  private maybeSinkBoatAt(dockId: string | null | undefined): void {
    if (!dockId || Math.random() > NavalBalance.sinkBoatChance) return;
    const boat = this.boats.find((b) => b.kind === 'fishing' && b.dockId === dockId);
    if (!boat) return;
    this.abortFishingBoat(boat, true);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Pirates sink a fishing boat!',
    });
  }
}

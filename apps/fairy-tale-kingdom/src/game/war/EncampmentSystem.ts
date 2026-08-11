import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { Phase12Balance } from '../economy/phase12Balance';
import type { PathGrid } from '../path/PathGrid';
import type { RaidSystem } from '../raids/RaidSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import { randomPointInZone, type WorldBounds } from '../subjects/zones';
import { WarBalance, type CampKind } from './WarBalance';

export interface SavedEncampment {
  id: string;
  kind: CampKind;
  x: number;
  y: number;
  garrison: number;
  away: number;
  supply?: number;
  maxSupply?: number;
  generalName?: string;
}

interface CampRecord {
  id: string;
  kind: CampKind;
  x: number;
  y: number;
  /** Idle units waiting at the camp */
  garrison: number;
  /** Units currently out on raid / aggro */
  away: number;
  spawnMs: number;
  raidCooldownMs: number;
  supply: number;
  maxSupply: number;
  reinforceMs: number;
  sprite: Phaser.GameObjects.Image;
  supplyBg?: Phaser.GameObjects.Rectangle;
  supplyFill?: Phaser.GameObjects.Rectangle;
  generalName?: string;
  supplyToastShown: boolean;
}

const CAMP_LABEL: Record<CampKind, string> = {
  bandit: 'bandit camp',
  giant: 'giant camp',
  goblin: 'goblin camp',
  thief: 'thief den',
  siege: 'siege encampment',
  gypsy: 'gypsy camp',
  coven: 'witch coven',
};

const ENEMY_GENERAL_NAMES = [
  'Lord Blackthorn',
  'Sir Mordane',
  'Captain Vex',
  'Warlord Krag',
  'Baron Ashfeld',
  'Marshal Riven',
];

export class EncampmentSystem {
  private camps: CampRecord[] = [];
  private nextId = 1;
  private campSpawnMs = 25_000;
  private siegeWaveMs = 90_000;
  private buildings: BuildingSystem | null = null;
  private subjects: SubjectSystem | null = null;
  private raids: RaidSystem | null = null;
  private onChanged: (() => void) | null = null;
  private daysPlayed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds,
    private readonly keep: { x: number; y: number }
  ) {}

  setBuildings(b: BuildingSystem): void {
    this.buildings = b;
  }

  setSubjects(s: SubjectSystem): void {
    this.subjects = s;
  }

  setRaids(r: RaidSystem): void {
    this.raids = r;
  }

  setPathGrid(_g: PathGrid): void {
    // Reserved for future path-aware camp placement
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  setDaysPlayed(days: number): void {
    this.daysPlayed = Math.max(0, Math.floor(days));
  }

  listCamps(): { id: string; kind: CampKind; x: number; y: number; label: string }[] {
    return this.camps.map((c) => ({
      id: c.id,
      kind: c.kind,
      x: c.x,
      y: c.y,
      label: CAMP_LABEL[c.kind],
    }));
  }

  nearestCamp(
    x: number,
    y: number,
    radius: number,
    kinds?: CampKind[]
  ): CampRecord | null {
    let best: CampRecord | null = null;
    let bestD = radius;
    for (const c of this.camps) {
      if (kinds && !kinds.includes(c.kind)) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  getCampPoint(id: string): { x: number; y: number } | null {
    const c = this.camps.find((camp) => camp.id === id);
    return c ? { x: c.x, y: c.y } : null;
  }

  serialize(): SavedEncampment[] {
    return this.camps.map((c) => ({
      id: c.id,
      kind: c.kind,
      x: c.x,
      y: c.y,
      garrison: c.garrison,
      away: c.away,
      supply: c.kind === 'siege' ? c.supply : undefined,
      maxSupply: c.kind === 'siege' ? c.maxSupply : undefined,
      generalName: c.generalName,
    }));
  }

  restore(saved: SavedEncampment[]): void {
    this.clear();
    for (const s of saved) {
      this.createCamp(s.kind, s.x, s.y, {
        id: s.id,
        garrison: s.garrison,
        away: s.away,
        supply: s.supply,
        maxSupply: s.maxSupply,
        generalName: s.generalName,
        quiet: true,
      });
    }
  }

  clear(): void {
    for (const c of this.camps) this.destroyVisuals(c);
    this.camps = [];
  }

  /** Called when a raider returns home after looting. */
  onRaiderReturned(campId: string): void {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return;
    camp.away = Math.max(0, camp.away - 1);
    camp.garrison = Math.min(
      WarBalance.garrisonCap(camp.kind, this.daysPlayed),
      camp.garrison + 1
    );
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `Raiders return to the ${CAMP_LABEL[camp.kind]}.`,
    });
    this.onChanged?.();
  }

  /** Called when a camp-linked raider dies away from home. */
  onRaiderLost(campId: string): void {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return;
    camp.away = Math.max(0, camp.away - 1);
    this.tryRemoveEmpty(camp);
    this.onChanged?.();
  }

  /**
   * General commands N military to destroy a camp (or nearest).
   * Returns false if no troops / no camp.
   */
  commandDestroyCamp(generalId: string, troopCount: number, campId?: string): boolean {
    if (!this.subjects) return false;
    const general = this.subjects.getById(generalId);
    if (!general || general.data.role !== 'general') return false;

    const camp = campId
      ? this.camps.find((c) => c.id === campId)
      : this.nearestCamp(general.sprite.x, general.sprite.y, 2000);
    if (!camp) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No encampment to attack.',
      });
      return false;
    }

    const n = Math.max(1, Math.floor(troopCount));
    const assigned = this.subjects.assignAssault(camp.id, n, generalId);
    if (assigned === 0) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No free guards or archers to command.',
      });
      return false;
    }

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${general.data.name} commands ${assigned} troops against the ${CAMP_LABEL[camp.kind]}!`,
    });
    return true;
  }

  commandDestroyMonster(generalId: string, troopCount: number, monsterId: string): boolean {
    if (!this.subjects) return false;
    const general = this.subjects.getById(generalId);
    if (!general || general.data.role !== 'general') return false;
    const n = Math.max(1, Math.floor(troopCount));
    const assigned = this.subjects.assignAssault(`monster:${monsterId}`, n, generalId);
    if (assigned === 0) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No free guards or archers to command.',
      });
      return false;
    }
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${general.data.name} commands ${assigned} troops to hunt a monster!`,
    });
    return true;
  }

  /** Deal assault damage when troops are at the camp. */
  applyAssaultHit(campId: string, damage: number): boolean {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return false;
    // Kill garrison first, then treat as depleting away via combat elsewhere
    let dmg = damage;
    while (dmg >= 8 && camp.garrison > 0) {
      camp.garrison -= 1;
      dmg -= 8;
    }
    if (camp.garrison <= 0 && camp.away <= 0) {
      this.removeCamp(camp, true);
      return true;
    }
    this.onChanged?.();
    return false;
  }

  update(deltaMs: number, isNight: boolean): void {
    const keep = this.buildings?.getActiveKeepPoint();
    if (keep) {
      this.keep.x = keep.x;
      this.keep.y = keep.y;
    }

    this.campSpawnMs -= deltaMs;
    if (this.campSpawnMs <= 0) {
      this.campSpawnMs = WarBalance.campSpawnIntervalMs(this.daysPlayed);
      this.trySpawnFringeCamp();
    }

    this.siegeWaveMs -= deltaMs;
    if (this.siegeWaveMs <= 0) {
      this.siegeWaveMs = WarBalance.siegeWaveIntervalMs(this.daysPlayed);
      this.trySpawnSiegeWave();
    }

    for (const camp of [...this.camps]) {
      this.tickCamp(camp, deltaMs, isNight);
    }
  }

  private tickCamp(camp: CampRecord, deltaMs: number, isNight: boolean): void {
    const cap = WarBalance.garrisonCap(camp.kind, this.daysPlayed);

    if (camp.kind === 'siege') {
      this.tickSiegeCamp(camp, deltaMs);
      return;
    }

    if (camp.kind === 'gypsy') {
      this.tickGypsyCamp(camp, deltaMs);
      return;
    }

    if (camp.kind === 'coven') {
      this.tickCovenCamp(camp, deltaMs);
      return;
    }

    // Produce garrison
    if (camp.garrison + camp.away < cap) {
      camp.spawnMs -= deltaMs;
      if (camp.spawnMs <= 0) {
        camp.spawnMs = WarBalance.garrisonSpawnMs(camp.kind, this.daysPlayed);
        camp.garrison += 1;
        this.onChanged?.();
      }
    }

    // Proximity aggro — send idle units to attack nearby buildings/subjects
    if (camp.garrison > 0 && this.buildings) {
      const near = this.buildings.burnablesNear(
        camp.x,
        camp.y,
        WarBalance.aggroRadius
      );
      const subjectNear = this.subjects?.nearestSubject(
        camp.x,
        camp.y,
        WarBalance.aggroRadius
      );
      if (near || subjectNear) {
        const send = Math.min(camp.garrison, 2);
        if (send > 0) {
          this.launchParty(camp, send, true);
        }
      }
    }

    // Raid when strong enough
    camp.raidCooldownMs = Math.max(0, camp.raidCooldownMs - deltaMs);
    const thresh = WarBalance.raidThreshold(camp.kind, this.daysPlayed);
    const canRaid =
      camp.kind === 'thief' ? isNight : true;
    if (
      canRaid &&
      camp.raidCooldownMs <= 0 &&
      camp.garrison >= thresh &&
      this.raids &&
      !this.raids.isArmySiege()
    ) {
      const size = WarBalance.raidPartySize(
        camp.kind,
        this.daysPlayed,
        camp.garrison
      );
      this.launchParty(camp, size, false);
      camp.raidCooldownMs = 40_000 + Math.random() * 20_000;
    }
  }

  /** Gypsies entertain nearby subjects instead of raiding. */
  private tickGypsyCamp(camp: CampRecord, deltaMs: number): void {
    const cap = WarBalance.garrisonCap(camp.kind, this.daysPlayed);
    if (camp.garrison + camp.away < cap) {
      camp.spawnMs -= deltaMs;
      if (camp.spawnMs <= 0) {
        camp.spawnMs = WarBalance.garrisonSpawnMs(camp.kind, this.daysPlayed);
        camp.garrison += 1;
        this.onChanged?.();
      }
    }

    camp.raidCooldownMs = Math.max(0, camp.raidCooldownMs - deltaMs);
    if (camp.raidCooldownMs > 0 || !this.subjects) return;
    camp.raidCooldownMs = 6_000;

    const range = Phase12Balance.gypsyEntertainRange;
    const bump = Phase12Balance.gypsyEntertainHappiness;
    for (const s of this.subjects.listManaged()) {
      if (s.data.role === 'witch') continue;
      const d = Phaser.Math.Distance.Between(
        camp.x,
        camp.y,
        s.sprite.x,
        s.sprite.y
      );
      if (d > range) continue;
      const adjust = (
        this.subjects as { adjustHappiness?: (id: string, n: number) => void }
      ).adjustHappiness;
      if (typeof adjust === 'function') {
        adjust.call(this.subjects, s.data.id, bump);
      } else if (typeof s.data.happiness === 'number') {
        s.data.happiness = Math.min(100, s.data.happiness + bump);
      }
    }
  }

  /** Covens grow witches; spawn into the world later. */
  private tickCovenCamp(camp: CampRecord, deltaMs: number): void {
    const cap = WarBalance.garrisonCap(camp.kind, this.daysPlayed);
    if (camp.garrison + camp.away >= cap) return;
    camp.spawnMs -= deltaMs;
    if (camp.spawnMs > 0) return;
    camp.spawnMs = WarBalance.garrisonSpawnMs(camp.kind, this.daysPlayed);
    camp.garrison += 1;
    // Stub: witches spawn into SubjectSystem when that API lands
    this.onChanged?.();
  }

  private tickSiegeCamp(camp: CampRecord, deltaMs: number): void {
    this.refreshSupplyBar(camp);
    if (camp.supply <= 0) {
      if (!camp.supplyToastShown) {
        camp.supplyToastShown = true;
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'Siege camp is out of supplies!',
        });
      }
      if (camp.garrison + camp.away <= 0) {
        this.removeCamp(camp, true);
      }
      return;
    }

    camp.reinforceMs -= deltaMs;
    if (camp.reinforceMs <= 0 && this.raids) {
      camp.reinforceMs = WarBalance.siegeReinforceMs(this.daysPlayed);
      const cost = WarBalance.siegeReinforceCost;
      if (camp.supply >= cost) {
        camp.supply -= cost;
        camp.away += 1;
        this.raids.launchCampRaiders({
          kind: 'enemy_army',
          x: camp.x + Phaser.Math.Between(-16, 16),
          y: camp.y + Phaser.Math.Between(-16, 16),
          count: 1,
          homeCampId: camp.id,
          homeX: camp.x,
          homeY: camp.y,
          isReinforce: true,
        });
        this.refreshSupplyBar(camp);
        this.onChanged?.();
      }
    }

    if (camp.garrison + camp.away <= 0 && camp.supply <= 0) {
      this.removeCamp(camp, true);
    }
  }

  private launchParty(camp: CampRecord, count: number, aggroOnly: boolean): void {
    if (!this.raids || count <= 0) return;
    const send = Math.min(count, camp.garrison);
    if (send <= 0) return;
    camp.garrison -= send;
    camp.away += send;

    const raidKind =
      camp.kind === 'thief'
        ? 'bandit'
        : camp.kind === 'siege'
          ? 'enemy_army'
          : camp.kind === 'goblin'
            ? 'goblin'
            : camp.kind === 'giant'
              ? 'giant'
              : 'bandit';

    this.raids.launchCampRaiders({
      kind: raidKind,
      x: camp.x,
      y: camp.y,
      count: send,
      homeCampId: camp.id,
      homeX: camp.x,
      homeY: camp.y,
      stealKind: camp.kind === 'thief' ? 'thief' : camp.kind === 'goblin' ? 'goblin' : undefined,
      aggroOnly,
      label:
        camp.kind === 'thief'
          ? 'Thieves'
          : camp.kind === 'goblin'
            ? 'Goblins'
            : camp.kind === 'giant'
              ? 'Giants'
              : 'Bandits',
    });

    if (!aggroOnly) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${CAMP_LABEL[camp.kind]} launches a raid!`,
      });
    }
    this.onChanged?.();
  }

  private trySpawnFringeCamp(): void {
    const nonSiege = this.camps.filter((c) => c.kind !== 'siege').length;
    if (nonSiege >= WarBalance.maxCamps(this.daysPlayed)) return;

    const kinds = WarBalance.campKindsWeighted(this.daysPlayed);
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const pos = this.pickFringePoint();
    if (!pos) return;

    // Keep clear of keep and existing camps
    if (Phaser.Math.Distance.Between(pos.x, pos.y, this.keep.x, this.keep.y) < 180) {
      return;
    }
    for (const c of this.camps) {
      if (Phaser.Math.Distance.Between(pos.x, pos.y, c.x, c.y) < 80) return;
    }

    this.createCamp(kind, pos.x, pos.y, { garrison: 1 });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `A ${CAMP_LABEL[kind]} appears on the frontier!`,
    });
  }

  private trySpawnSiegeWave(): void {
    if (this.daysPlayed < 2) return;
    if (this.camps.some((c) => c.kind === 'siege')) return;
    if (this.raids?.isArmySiege()) return;

    const edge = this.pickEdgePoint();
    const supply = WarBalance.siegeMaxSupply(this.daysPlayed);
    const count = WarBalance.siegeArmyCount(this.daysPlayed);
    const generalName =
      ENEMY_GENERAL_NAMES[Math.floor(Math.random() * ENEMY_GENERAL_NAMES.length)]!;

    const camp = this.createCamp('siege', edge.x, edge.y, {
      garrison: 0,
      away: count,
      supply,
      maxSupply: supply,
      generalName,
    });
    if (!camp || !this.raids) return;

    this.raids.beginSiegeFromCamp({
      x: camp.x,
      y: camp.y,
      count,
      homeCampId: camp.id,
      generalName,
    });

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${generalName} plants a siege encampment!`,
    });
  }

  private pickFringePoint(): { x: number; y: number } | null {
    const zone = Math.random() < 0.5 ? 'forest' : 'mountain';
    const p = randomPointInZone(zone, this.world, null);
    // Push toward map edge a bit
    const cx = this.world.width / 2;
    const cy = this.world.height / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: Phaser.Math.Clamp(p.x + (dx / len) * 40, 40, this.world.width - 40),
      y: Phaser.Math.Clamp(p.y + (dy / len) * 40, 40, this.world.height - 40),
    };
  }

  private pickEdgePoint(): { x: number; y: number } {
    const pad = 36;
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
      case 0:
        return {
          x: Phaser.Math.Between(pad, this.world.width - pad),
          y: pad,
        };
      case 1:
        return {
          x: Phaser.Math.Between(pad, this.world.width - pad),
          y: this.world.height - pad,
        };
      case 2:
        return {
          x: pad,
          y: Phaser.Math.Between(pad, this.world.height - pad),
        };
      default:
        return {
          x: this.world.width - pad,
          y: Phaser.Math.Between(pad, this.world.height - pad),
        };
    }
  }

  private createCamp(
    kind: CampKind,
    x: number,
    y: number,
    opts?: {
      id?: string;
      garrison?: number;
      away?: number;
      supply?: number;
      maxSupply?: number;
      generalName?: string;
      quiet?: boolean;
    }
  ): CampRecord | null {
    const id = opts?.id ?? `camp-${this.nextId++}`;
    const match = /^camp-(\d+)$/.exec(id);
    if (match) this.nextId = Math.max(this.nextId, Number(match[1]) + 1);

    const tex =
      kind === 'siege'
        ? PROP_KEYS.siegeCamp
        : kind === 'thief'
          ? PROP_KEYS.thiefDen
          : kind === 'gypsy'
            ? PROP_KEYS.gypsyCamp
            : kind === 'coven'
              ? PROP_KEYS.covenCamp
              : PROP_KEYS.banditCamp;

    const sprite = this.scene.add.image(x, y, tex);
    sprite.setDepth(8);
    sprite.setOrigin(0.5, 1);

    const maxSupply = opts?.maxSupply ?? (kind === 'siege' ? WarBalance.siegeMaxSupply(this.daysPlayed) : 0);
    const supply = opts?.supply ?? maxSupply;

    const camp: CampRecord = {
      id,
      kind,
      x,
      y,
      garrison: opts?.garrison ?? 1,
      away: opts?.away ?? 0,
      spawnMs: WarBalance.garrisonSpawnMs(kind, this.daysPlayed),
      raidCooldownMs: 20_000,
      supply,
      maxSupply,
      reinforceMs: WarBalance.siegeReinforceMs(this.daysPlayed),
      sprite,
      generalName: opts?.generalName,
      supplyToastShown: supply <= 0,
    };

    if (kind === 'siege') {
      camp.supplyBg = this.scene.add
        .rectangle(x, y - 28, 28, 4, 0x1a1010, 0.85)
        .setDepth(30)
        .setOrigin(0.5, 0.5);
      camp.supplyFill = this.scene.add
        .rectangle(x - 13, y - 28, 26, 3, 0xc4a35a, 1)
        .setDepth(31)
        .setOrigin(0, 0.5);
      this.refreshSupplyBar(camp);
    }

    this.camps.push(camp);
    if (!opts?.quiet) this.onChanged?.();
    return camp;
  }

  private refreshSupplyBar(camp: CampRecord): void {
    if (!camp.supplyBg || !camp.supplyFill) return;
    const ratio =
      camp.maxSupply > 0 ? Phaser.Math.Clamp(camp.supply / camp.maxSupply, 0, 1) : 0;
    camp.supplyFill.width = 26 * ratio;
    camp.supplyFill.setFillStyle(ratio > 0.25 ? 0xc4a35a : 0xb85450);
    const visible = camp.supply > 0 || camp.away > 0 || camp.garrison > 0;
    camp.supplyBg.setVisible(visible);
    camp.supplyFill.setVisible(visible && ratio > 0);
  }

  private tryRemoveEmpty(camp: CampRecord): void {
    if (camp.garrison <= 0 && camp.away <= 0) {
      this.removeCamp(camp, true);
    }
  }

  private removeCamp(camp: CampRecord, toast: boolean): void {
    this.destroyVisuals(camp);
    this.camps = this.camps.filter((c) => c !== camp);
    if (toast) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `The ${CAMP_LABEL[camp.kind]} is destroyed!`,
      });
    }
    this.onChanged?.();
  }

  private destroyVisuals(camp: CampRecord): void {
    camp.sprite.destroy();
    camp.supplyBg?.destroy();
    camp.supplyFill?.destroy();
  }
}

import Phaser from 'phaser';
import { PROP_KEYS, TILE_SIZE, isTerrainBlocked } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { Phase12Balance } from '../economy/phase12Balance';
import type { PathGrid } from '../path/PathGrid';
import type { RaidSystem } from '../raids/RaidSystem';
import { pickName } from '../subjects/names';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { CampRosterEntry, CampSnapshot } from '../subjects/types';
import { KingdomEvents } from '../subjects/events';
import { randomPointInZone, type WorldBounds } from '../subjects/zones';
import { pickCampRaidLine, planSiege } from './GeneralStrategy';
import { WarBalance, type CampKind } from './WarBalance';
import { getSandboxRuntime } from '../sandboxRuntime';

export type { CampSnapshot };

/** Camp kinds whose garrison is made of real, wandering SubjectSystem entities. */
const LIVING_CAMP_KINDS: CampKind[] = ['bandit', 'thief', 'gypsy'];

function isLivingCampKind(
  kind: CampKind
): kind is 'bandit' | 'thief' | 'gypsy' {
  return LIVING_CAMP_KINDS.includes(kind);
}

/** Roughly how far a camp's garrison wanders / how far its aggro reaches. */
const LIVING_CAMP_INFLUENCE_RADIUS = 140;

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
  leaderHome?: boolean;
  roster?: CampRosterEntry[];
  demoralizedMs?: number;
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
  /** Named living garrison, kept in lockstep with garrison/away counts */
  roster: CampRosterEntry[];
  /** Whether the camp leader is currently at home (vs. out with a raid/siege) */
  leaderHome: boolean;
  /** How many of the away roster still belong to the leader's current party */
  leaderPartySize: number;
  /** ms remaining leaderless after a leader falls — no new raids until a successor rises */
  demoralizedMs: number;
  activityMs: number;
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

/** Title prefixed to a picked first/last name for each camp kind's leader */
const LEADER_TITLE: Record<CampKind, string> = {
  bandit: 'Chief',
  giant: 'Warlord',
  goblin: 'Warboss',
  thief: 'Boss',
  siege: '',
  gypsy: 'Baroness',
  coven: 'Matron',
};

/** Rank-and-file role label shown in the camp roster */
const ROSTER_ROLE: Record<CampKind, string> = {
  bandit: 'Raider',
  giant: 'Brute',
  goblin: 'Skirmisher',
  thief: 'Cutpurse',
  siege: 'Soldier',
  gypsy: 'Wanderer',
  coven: 'Acolyte',
};

/** Rotating flavor activities for idle (home) roster units during daylight */
const HOME_ACTIVITIES: Record<CampKind, string[]> = {
  bandit: [
    'Sharpening a blade by the fire',
    'Drinking by the fire',
    'Mending a cloak',
    'Counting stolen coin',
    'Patrolling the perimeter',
  ],
  giant: [
    'Gnawing a bone by the fire',
    'Napping in the sun',
    'Sharpening a club',
    'Patrolling the perimeter',
    'Grumbling',
  ],
  goblin: [
    'Squabbling over scraps',
    'Sharpening spears by the fire',
    'Gnawing on scraps',
    'Patrolling the perimeter',
    'Cackling',
  ],
  thief: [
    'Casing the road',
    'Cleaning lockpicks by the fire',
    'Counting coin',
    'Patrolling the perimeter',
    'Lurking in shadow',
  ],
  siege: [
    'Drilling formation',
    'Sharpening pikes by the fire',
    'Repairing a wagon wheel',
    'Patrolling the perimeter',
    'Standing watch',
  ],
  gypsy: [
    'Playing a fiddle',
    'Telling fortunes by the fire',
    'Mending a wagon',
    'Dancing by the fire',
  ],
  coven: [
    'Brewing a potion',
    'Muttering a hex over the cauldron',
    'Reading an old tome',
    'Tending a ritual circle',
  ],
};

/** Night-time flavor activities — mostly sleep, with a wakeful sentry or two */
const NIGHT_ACTIVITIES: Record<CampKind, string[]> = {
  bandit: ['Sleeping off a raid', 'Sleeping by the fire', 'Standing night watch'],
  giant: ['Snoring loudly', 'Sleeping by the fire', 'Standing night watch'],
  goblin: ['Curled up asleep', 'Sleeping by the fire', 'Standing night watch'],
  thief: ['Casing the road', 'Lurking in shadow', 'Patrolling the perimeter'],
  siege: ['Sleeping in the wagon', 'Standing night watch', 'Sharpening pikes by torchlight'],
  gypsy: ['Sleeping by the fire', 'Telling fortunes by moonlight'],
  coven: ['Chanting a midnight ritual', 'Tending a ritual circle', 'Reading an old tome'],
};

export class EncampmentSystem {
  private camps: CampRecord[] = [];
  private nextId = 1;
  private nextUnitSeq = 1;
  private campSpawnMs = 90_000;
  private siegeWaveMs = 90_000;
  private buildings: BuildingSystem | null = null;
  private subjects: SubjectSystem | null = null;
  private raids: RaidSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private onChanged: (() => void) | null = null;
  private daysPlayed = 0;
  private selectedId: string | null = null;
  private mapData: number[][] | null = null;

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

  setPathGrid(g: PathGrid): void {
    this.pathGrid = g;
  }

  setMapData(mapData: number[][]): void {
    this.mapData = mapData;
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  /** Seed fringe camps for a new / migrated kingdom (count from sandbox). */
  seedStarterCamps(count = 1): void {
    const n = Math.max(0, Math.min(4, count));
    for (let i = 0; i < n; i++) {
      const kinds = WarBalance.campKindsWeighted(this.daysPlayed);
      if (!kinds.length) return;
      const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
      const pos = this.pickFringePoint();
      if (!pos) continue;
      if (
        Phaser.Math.Distance.Between(pos.x, pos.y, this.keep.x, this.keep.y) <
        this.keepClearance()
      ) {
        continue;
      }
      let tooClose = false;
      for (const c of this.camps) {
        if (Phaser.Math.Distance.Between(pos.x, pos.y, c.x, c.y) < this.campClearance()) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      this.createCamp(kind, pos.x, pos.y, {
        garrison: 1 + Math.floor(Math.random() * 2),
        raidCooldownMs: 90_000 + Math.random() * 120_000,
      });
    }
    this.onChanged?.();
  }

  private keepClearance(): number {
    return Math.max(180, Math.min(this.world.width, this.world.height) * 0.12);
  }

  private campClearance(): number {
    return Math.max(80, Math.min(this.world.width, this.world.height) * 0.05);
  }

  private population(): number {
    return this.subjects?.count() ?? 0;
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

  getCampKind(id: string): CampKind | null {
    return this.camps.find((camp) => camp.id === id)?.kind ?? null;
  }

  /** How far a camp's garrison wanders / how far its aggro & overlay sphere reaches. */
  influenceRadius(kind: CampKind): number {
    return isLivingCampKind(kind)
      ? LIVING_CAMP_INFLUENCE_RADIUS
      : WarBalance.aggroRadius;
  }

  influenceContains(campId: string, x: number, y: number): boolean {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return false;
    return (
      Phaser.Math.Distance.Between(camp.x, camp.y, x, y) <=
      this.influenceRadius(camp.kind)
    );
  }

  /** Nearest living camp of the given kinds with room for another garrison member. */
  nearestCampWithCapacity(
    x: number,
    y: number,
    kinds: CampKind[]
  ): { id: string; kind: CampKind; x: number; y: number } | null {
    let best: CampRecord | null = null;
    let bestD = Infinity;
    for (const c of this.camps) {
      if (!kinds.includes(c.kind)) continue;
      if (c.garrison + c.away >= WarBalance.garrisonCap(c.kind, this.daysPlayed)) {
        continue;
      }
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { id: best.id, kind: best.kind, x: best.x, y: best.y } : null;
  }

  /** Founds a fresh, empty fringe camp of the given kind (e.g. for a lone defector). */
  createFringeCamp(
    kind: CampKind
  ): { id: string; kind: CampKind; x: number; y: number } | null {
    const pos = this.pickFringePoint();
    if (!pos) return null;
    if (
      Phaser.Math.Distance.Between(pos.x, pos.y, this.keep.x, this.keep.y) <
      this.keepClearance()
    ) {
      return null;
    }
    const camp = this.createCamp(kind, pos.x, pos.y, { garrison: 0 });
    if (!camp) return null;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `A ${CAMP_LABEL[kind]} appears on the frontier!`,
    });
    return { id: camp.id, kind: camp.kind, x: camp.x, y: camp.y };
  }

  /** A subject has walked in and joined this camp's garrison — id must already be a real subject. */
  registerDefector(campId: string, subjectId: string, name: string): void {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return;
    camp.garrison += 1;
    const acts = HOME_ACTIVITIES[camp.kind];
    camp.roster.push({
      id: subjectId,
      name,
      role: ROSTER_ROLE[camp.kind],
      status: 'home',
      activity: acts[Math.floor(Math.random() * acts.length)]!,
    });
    this.onChanged?.();
  }

  /** A living garrison member died (combat, old age, arrest) — reconcile counts/roster. */
  onGarrisonMemberDied(campId: string, subjectId: string): void {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return;
    const idx = camp.roster.findIndex((u) => u.id === subjectId);
    if (idx >= 0) {
      const wasHome = camp.roster[idx]!.status === 'home';
      camp.roster.splice(idx, 1);
      if (wasHome) camp.garrison = Math.max(0, camp.garrison - 1);
      else camp.away = Math.max(0, camp.away - 1);
    } else {
      camp.garrison = Math.max(0, camp.garrison - 1);
    }
    this.tryRemoveEmpty(camp);
    this.onChanged?.();
  }

  /**
   * After a save restore, living-camp garrisons are rebuilt straight from the
   * real SubjectSystem entities that came back with matching campId/allegiance
   * (any that were "away" mid-raid have no raid to resume, so they're brought home).
   */
  reconcileLivingCamps(): void {
    if (!this.subjects) return;
    let changed = false;
    for (const camp of this.camps) {
      if (!isLivingCampKind(camp.kind)) continue;
      const members = this.subjects
        .listManaged()
        .filter(
          (m) => m.data.allegiance === 'camp' && m.data.campId === camp.id
        );
      const acts = HOME_ACTIVITIES[camp.kind];
      camp.roster = members.map((m) => {
        this.subjects!.setCampMemberAway(m.data.id, false);
        return {
          id: m.data.id,
          name: m.data.name,
          role: ROSTER_ROLE[camp.kind],
          status: 'home' as const,
          activity: acts[Math.floor(Math.random() * acts.length)]!,
        };
      });
      camp.garrison = members.length;
      camp.away = 0;
      changed = true;
    }
    if (changed) this.onChanged?.();
  }

  /** World-space pick against each camp's sprite bounds (click-to-inspect). */
  pickAt(worldX: number, worldY: number): string | null {
    for (const c of this.camps) {
      const b = c.sprite.getBounds();
      if (Phaser.Geom.Rectangle.Contains(b, worldX, worldY)) {
        return c.id;
      }
    }
    return null;
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(id: string | null): CampSnapshot | null {
    this.selectedId = id;
    if (!id) return null;
    const camp = this.camps.find((c) => c.id === id);
    return camp ? this.toSnapshot(camp) : null;
  }

  refreshSelectedSnapshot(): CampSnapshot | null {
    if (!this.selectedId) return null;
    const camp = this.camps.find((c) => c.id === this.selectedId);
    if (!camp) {
      this.selectedId = null;
      return null;
    }
    return this.toSnapshot(camp);
  }

  /** Whether a dungeon + nearby guard/archer can arrest a raider from this camp. */
  canArrest(campId: string): boolean {
    if (!this.subjects || !this.buildings?.hasDungeon()) return false;
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp || camp.garrison <= 0) return false;
    return Boolean(
      this.subjects.nearestMilitary(camp.x, camp.y, WarBalance.campArrestRange)
    );
  }

  /** Player-ordered militia assault: mobilizes free guards/archers kingdom-wide. */
  requestDestroy(campId: string): boolean {
    if (!this.subjects) return false;
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return false;
    const assigned = this.subjects.assignAssault(camp.id, 99, 'militia');
    if (assigned === 0) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No free guards or archers to send.',
      });
      return false;
    }
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${assigned} troops march on the ${CAMP_LABEL[camp.kind]}!`,
    });
    return true;
  }

  /** Arrest one idle raider from a camp — needs a dungeon + a nearby guard/archer. */
  requestArrest(campId: string): boolean {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp || !this.canArrest(campId)) return false;
    const guard = this.subjects!.nearestMilitary(
      camp.x,
      camp.y,
      WarBalance.campArrestRange
    );
    if (!guard) return false;
    this.shrinkGarrison(camp, 1);
    const bounty = Phase12Balance.arrestBountyGold;
    this.scene.game.events.emit(KingdomEvents.GOLD_RECOVERED, {
      amount: bounty,
      kind: camp.kind,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${guard.data.name} arrests a raider from the ${CAMP_LABEL[camp.kind]} — recovered ${bounty} gold!`,
    });
    this.tryRemoveEmpty(camp);
    this.onChanged?.();
    return true;
  }

  private toSnapshot(camp: CampRecord): CampSnapshot {
    return {
      id: camp.id,
      kind: camp.kind,
      x: camp.x,
      y: camp.y,
      label: CAMP_LABEL[camp.kind],
      leaderName: camp.generalName ?? null,
      leaderHome: camp.leaderHome,
      demoralized: camp.demoralizedMs > 0,
      garrison: camp.garrison,
      away: camp.away,
      supply: camp.kind === 'siege' ? camp.supply : undefined,
      maxSupply: camp.kind === 'siege' ? camp.maxSupply : undefined,
      canArrest: this.canArrest(camp.id),
      roster: camp.roster.map((u) => ({ ...u })),
    };
  }

  private generateLeaderName(kind: CampKind): string {
    if (kind === 'siege') {
      return ENEMY_GENERAL_NAMES[
        Math.floor(Math.random() * ENEMY_GENERAL_NAMES.length)
      ]!;
    }
    const title = LEADER_TITLE[kind];
    const name = pickName(Math.floor(Math.random() * 1_000_000));
    return `${title} ${name}`;
  }

  private makeRosterUnit(camp: CampRecord, status: CampRosterEntry['status']): CampRosterEntry {
    const id = `${camp.id}-u${this.nextUnitSeq++}`;
    const name = pickName(Math.floor(Math.random() * 1_000_000));
    const acts = HOME_ACTIVITIES[camp.kind];
    const activity =
      status === 'home'
        ? acts[Math.floor(Math.random() * acts.length)]!
        : camp.kind === 'siege'
          ? 'Marching on the keep'
          : 'Out raiding';
    return { id, name, role: ROSTER_ROLE[camp.kind], status, activity };
  }

  /** Adds one member to a camp's home garrison, spawning a real subject for living camps. */
  private growGarrison(camp: CampRecord): void {
    camp.garrison += 1;
    if (isLivingCampKind(camp.kind) && this.subjects) {
      const id = this.subjects.spawnCampMember(camp.id, camp.kind, camp.x, camp.y);
      const managed = this.subjects.getById(id);
      const acts = HOME_ACTIVITIES[camp.kind];
      camp.roster.push({
        id,
        name: managed?.data.name ?? 'Unknown',
        role: ROSTER_ROLE[camp.kind],
        status: 'home',
        activity: acts[Math.floor(Math.random() * acts.length)]!,
      });
    } else {
      this.syncRoster(camp);
    }
  }

  /** Removes `amount` home garrison members, destroying their subjects for living camps. */
  private shrinkGarrison(camp: CampRecord, amount: number): void {
    camp.garrison = Math.max(0, camp.garrison - amount);
    if (isLivingCampKind(camp.kind) && this.subjects) {
      const home = camp.roster.filter((u) => u.status === 'home');
      for (let i = 0; i < amount && home.length; i++) {
        const u = home.pop()!;
        const idx = camp.roster.indexOf(u);
        if (idx >= 0) camp.roster.splice(idx, 1);
        this.subjects.removeCampMember(u.id);
      }
    } else {
      this.syncRoster(camp);
    }
  }

  /** Keep named roster entries in lockstep with garrison/away counts. */
  private syncRoster(camp: CampRecord): void {
    const home = camp.roster.filter((u) => u.status === 'home');
    const away = camp.roster.filter((u) => u.status === 'away');
    while (home.length < camp.garrison) {
      const u = this.makeRosterUnit(camp, 'home');
      camp.roster.push(u);
      home.push(u);
    }
    while (home.length > camp.garrison) {
      const u = home.pop()!;
      const idx = camp.roster.indexOf(u);
      if (idx >= 0) camp.roster.splice(idx, 1);
    }
    while (away.length < camp.away) {
      const u = this.makeRosterUnit(camp, 'away');
      camp.roster.push(u);
      away.push(u);
    }
    while (away.length > camp.away) {
      const u = away.pop()!;
      const idx = camp.roster.indexOf(u);
      if (idx >= 0) camp.roster.splice(idx, 1);
    }
  }

  /** Rotate flavor activities for idle roster units (camp-life labels). */
  private tickRosterActivity(camp: CampRecord, deltaMs: number, isNight: boolean): void {
    camp.activityMs -= deltaMs;
    if (camp.activityMs > 0) return;
    camp.activityMs = 7_000 + Math.random() * 8_000;
    const acts = isNight ? NIGHT_ACTIVITIES[camp.kind] : HOME_ACTIVITIES[camp.kind];
    for (const u of camp.roster) {
      if (u.status !== 'home') continue;
      if (Math.random() < 0.5) {
        u.activity = acts[Math.floor(Math.random() * acts.length)]!;
      }
    }
  }

  /** Marks the leader's raid party as home once all of it has returned/died. */
  private settleLeaderParty(camp: CampRecord): void {
    if (camp.leaderPartySize <= 0) return;
    camp.leaderPartySize -= 1;
    if (camp.leaderPartySize <= 0) camp.leaderHome = true;
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
      leaderHome: c.leaderHome,
      roster: c.roster.map((u) => ({ ...u })),
      demoralizedMs: c.demoralizedMs > 0 ? c.demoralizedMs : undefined,
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
        leaderHome: s.leaderHome,
        roster: s.roster,
        demoralizedMs: s.demoralizedMs,
        quiet: true,
      });
    }
  }

  clear(): void {
    for (const c of this.camps) this.destroyVisuals(c);
    this.camps = [];
    this.selectedId = null;
  }

  /** Called when a raider returns home after looting. */
  onRaiderReturned(campId: string, rosterSubjectId?: string | null): void {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return;
    camp.away = Math.max(0, camp.away - 1);
    camp.garrison = Math.min(
      WarBalance.garrisonCap(camp.kind, this.daysPlayed),
      camp.garrison + 1
    );
    this.settleLeaderParty(camp);
    if (rosterSubjectId && isLivingCampKind(camp.kind)) {
      const entry = camp.roster.find((u) => u.id === rosterSubjectId);
      if (entry) {
        entry.status = 'home';
        const acts = HOME_ACTIVITIES[camp.kind];
        entry.activity = acts[Math.floor(Math.random() * acts.length)]!;
      }
      this.subjects?.setCampMemberAway(rosterSubjectId, false);
    } else {
      this.syncRoster(camp);
    }
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `Raiders return to the ${CAMP_LABEL[camp.kind]}.`,
    });
    this.onChanged?.();
  }

  /** Called when a camp-linked raider dies (or is arrested) away from home. */
  onRaiderLost(
    campId: string,
    wasGeneral = false,
    rosterSubjectId?: string | null
  ): void {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp) return;
    camp.away = Math.max(0, camp.away - 1);
    this.settleLeaderParty(camp);
    if (wasGeneral && camp.generalName && camp.kind !== 'siege') {
      const fallen = camp.generalName;
      camp.generalName = undefined;
      camp.leaderHome = false;
      camp.leaderPartySize = 0;
      camp.demoralizedMs = WarBalance.demoralizedRecoverMs(this.daysPlayed);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${fallen} has fallen! The ${CAMP_LABEL[camp.kind]} reels without a leader...`,
      });
    }
    if (rosterSubjectId && isLivingCampKind(camp.kind)) {
      const idx = camp.roster.findIndex((u) => u.id === rosterSubjectId);
      if (idx >= 0) camp.roster.splice(idx, 1);
      this.subjects?.removeCampMember(rosterSubjectId);
    } else {
      this.syncRoster(camp);
    }
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
    let kills = 0;
    while (dmg >= 8 && camp.garrison - kills > 0) {
      kills += 1;
      dmg -= 8;
    }
    if (kills > 0) this.shrinkGarrison(camp, kills);
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
      this.tickRosterActivity(camp, deltaMs, isNight);
      this.tickCamp(camp, deltaMs, isNight);
    }
  }

  /** Ticks down leaderlessness and installs a successor once the camp recovers. */
  private tickDemoralization(camp: CampRecord, deltaMs: number): void {
    if (camp.demoralizedMs <= 0) return;
    camp.demoralizedMs = Math.max(0, camp.demoralizedMs - deltaMs);
    if (camp.demoralizedMs <= 0 && !camp.generalName && camp.garrison > 0) {
      camp.generalName = this.generateLeaderName(camp.kind);
      camp.leaderHome = true;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${camp.generalName} rises to lead the ${CAMP_LABEL[camp.kind]}!`,
      });
      this.onChanged?.();
    }
  }

  private tickCamp(camp: CampRecord, deltaMs: number, isNight: boolean): void {
    const cap = WarBalance.garrisonCap(camp.kind, this.daysPlayed);
    this.tickDemoralization(camp, deltaMs);

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
        this.growGarrison(camp);
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

    // Raid when strong enough — staggered per-camp with random jitter
    camp.raidCooldownMs = Math.max(0, camp.raidCooldownMs - deltaMs);
    const thresh = WarBalance.raidThreshold(camp.kind, this.daysPlayed);
    const canRaid =
      (camp.kind === 'thief' ? isNight : true) && camp.demoralizedMs <= 0;
    const pressure = WarBalance.earlyPressureFactor(
      this.daysPlayed,
      this.population()
    );
    if (
      canRaid &&
      camp.raidCooldownMs <= 0 &&
      camp.garrison >= thresh &&
      this.raids &&
      !this.raids.isArmySiege() &&
      getSandboxRuntime().war.kinds[camp.kind] &&
      Math.random() < pressure
    ) {
      const size = WarBalance.raidPartySize(
        camp.kind,
        this.daysPlayed,
        camp.garrison
      );
      this.launchParty(camp, size, false);
      camp.raidCooldownMs = WarBalance.raidCooldownMs(pressure);
    }
  }

  /** Gypsies entertain nearby subjects instead of raiding. */
  private tickGypsyCamp(camp: CampRecord, deltaMs: number): void {
    const cap = WarBalance.garrisonCap(camp.kind, this.daysPlayed);
    if (camp.garrison + camp.away < cap) {
      camp.spawnMs -= deltaMs;
      if (camp.spawnMs <= 0) {
        camp.spawnMs = WarBalance.garrisonSpawnMs(camp.kind, this.daysPlayed);
        this.growGarrison(camp);
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
    this.syncRoster(camp);
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
        this.syncRoster(camp);
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

    let rosterSubjectIds: string[] | undefined;
    if (isLivingCampKind(camp.kind) && this.subjects) {
      const homeEntries = camp.roster
        .filter((u) => u.status === 'home')
        .slice(0, send);
      rosterSubjectIds = homeEntries.map((u) => u.id);
      for (const u of homeEntries) {
        u.status = 'away';
        u.activity = 'Out raiding';
        this.subjects.setCampMemberAway(u.id, true);
      }
      camp.garrison -= send;
      camp.away += send;
    } else {
      camp.garrison -= send;
      camp.away += send;
      this.syncRoster(camp);
    }

    // The leader joins a real raid (not proximity aggro) when they're home.
    const leaderLeads =
      !aggroOnly &&
      camp.kind !== 'siege' &&
      camp.leaderHome &&
      Boolean(camp.generalName);
    if (leaderLeads) {
      camp.leaderHome = false;
      camp.leaderPartySize = send;
    }

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
      hasGeneral: leaderLeads,
      rosterSubjectIds,
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
      // A leader-led raid consults the same battlefield logic enemy generals
      // use for sieges, so the toast reflects a smart choice of target.
      const plan =
        leaderLeads && this.buildings
          ? planSiege(this.buildings, { x: camp.x, y: camp.y }, camp.generalName)
          : null;
      const message =
        plan?.orderLabel ??
        (leaderLeads
          ? `${camp.generalName} orders: "${pickCampRaidLine(camp.kind)}"`
          : `${CAMP_LABEL[camp.kind]} launches a raid!`);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, { message });
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
    if (
      Phaser.Math.Distance.Between(pos.x, pos.y, this.keep.x, this.keep.y) <
      this.keepClearance()
    ) {
      return;
    }
    for (const c of this.camps) {
      if (
        Phaser.Math.Distance.Between(pos.x, pos.y, c.x, c.y) < this.campClearance()
      )
        return;
    }

    this.createCamp(kind, pos.x, pos.y, { garrison: 1 });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `A ${CAMP_LABEL[kind]} appears on the frontier!`,
    });
  }

  private trySpawnSiegeWave(): void {
    if (this.daysPlayed < 3) return;
    if (!getSandboxRuntime().war.kinds.siege) return;
    const siegeCount = this.camps.filter((c) => c.kind === 'siege').length;
    if (siegeCount >= WarBalance.maxSiegeCamps(this.daysPlayed)) return;
    if (this.raids?.isArmySiege()) return;
    const pressure = WarBalance.earlyPressureFactor(
      this.daysPlayed,
      this.population()
    );
    if (Math.random() > pressure) {
      this.siegeWaveMs = 30_000 + Math.random() * 40_000;
      return;
    }

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
      raidCooldownMs: 20_000 + Math.random() * 60_000,
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
    // Prefer forest fringe — mountain pockets often have no land path to the keep.
    for (let attempt = 0; attempt < 72; attempt++) {
      const zone = Math.random() < 0.75 ? 'forest' : 'mountain';
      const p = randomPointInZone(zone, this.world, null);
      // Push toward map edge a bit
      const cx = this.world.width / 2;
      const cy = this.world.height / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const pos = {
        x: Phaser.Math.Clamp(p.x + (dx / len) * 40, 40, this.world.width - 40),
        y: Phaser.Math.Clamp(p.y + (dy / len) * 40, 40, this.world.height - 40),
      };
      const land = this.snapToLand(pos.x, pos.y);
      if (land && this.canRaidFrom(land.x, land.y)) return land;
    }
    return null;
  }

  /** True if a raid party can path from this camp to the keep over land. */
  private canRaidFrom(x: number, y: number): boolean {
    if (!this.pathGrid) return true;
    const path = this.pathGrid.findPath(
      { x, y },
      { x: this.keep.x, y: this.keep.y + 20 }
    );
    return Boolean(path && path.length > 0);
  }

  private pickEdgePoint(): { x: number; y: number } {
    const pad = 36;
    for (let attempt = 0; attempt < 48; attempt++) {
      const side = Phaser.Math.Between(0, 3);
      let x = 0;
      let y = 0;
      switch (side) {
        case 0:
          x = Phaser.Math.Between(pad, this.world.width - pad);
          y = pad;
          break;
        case 1:
          x = Phaser.Math.Between(pad, this.world.width - pad);
          y = this.world.height - pad;
          break;
        case 2:
          x = pad;
          y = Phaser.Math.Between(pad, this.world.height - pad);
          break;
        default:
          x = this.world.width - pad;
          y = Phaser.Math.Between(pad, this.world.height - pad);
          break;
      }
      // Walk inland from the ocean fringe until we hit dry land.
      const cx = this.world.width / 2;
      const cy = this.world.height / 2;
      for (let step = 0; step < 50; step++) {
        if (this.isCampLandOk(x, y)) {
          return { x, y };
        }
        x += Math.sign(cx - x) * TILE_SIZE;
        y += Math.sign(cy - y) * TILE_SIZE;
        x = Phaser.Math.Clamp(x, pad, this.world.width - pad);
        y = Phaser.Math.Clamp(y, pad, this.world.height - pad);
      }
    }
    // Last resort: land near keep but outside clearance
    const ang = Math.random() * Math.PI * 2;
    const dist = this.keepClearance() + 40;
    return (
      this.snapToLand(
        this.keep.x + Math.cos(ang) * dist,
        this.keep.y + Math.sin(ang) * dist
      ) ?? { x: this.keep.x + dist, y: this.keep.y }
    );
  }

  /** Sample the camp footprint — origin is bottom-center of the sprite. */
  private isCampLandOk(x: number, y: number): boolean {
    if (!this.mapData && this.buildings) {
      // Prefer BuildingSystem if map was only wired there
      const samples: [number, number][] = [
        [0, -8],
        [0, -16],
        [-16, -8],
        [16, -8],
        [0, -24],
        [-12, -20],
        [12, -20],
      ];
      return samples.every(([dx, dy]) => this.buildings!.isLandAt(x + dx, y + dy));
    }
    if (!this.mapData) return true;
    const samples: [number, number][] = [
      [0, -8],
      [0, -16],
      [-16, -8],
      [16, -8],
      [0, -24],
      [-12, -20],
      [12, -20],
    ];
    for (const [dx, dy] of samples) {
      const t = this.tileAt(x + dx, y + dy);
      if (t !== null && isTerrainBlocked(t)) return false;
    }
    return true;
  }

  private tileAt(worldX: number, worldY: number): number | null {
    if (!this.mapData) return null;
    const r = Math.floor(worldY / TILE_SIZE);
    const c = Math.floor(worldX / TILE_SIZE);
    return this.mapData[r]?.[c] ?? null;
  }

  /** Spiral out from a point until the camp footprint is on land. */
  private snapToLand(
    x: number,
    y: number,
    maxRadius = 24
  ): { x: number; y: number } | null {
    if (this.isCampLandOk(x, y)) return { x, y };
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const nx = x + Math.cos(ang) * radius * TILE_SIZE;
        const ny = y + Math.sin(ang) * radius * TILE_SIZE;
        if (
          nx < 40 ||
          ny < 40 ||
          nx > this.world.width - 40 ||
          ny > this.world.height - 40
        ) {
          continue;
        }
        if (this.isCampLandOk(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
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
      leaderHome?: boolean;
      roster?: CampRosterEntry[];
      demoralizedMs?: number;
      quiet?: boolean;
      raidCooldownMs?: number;
    }
  ): CampRecord | null {
    const land = this.snapToLand(x, y);
    if (!land) return null;
    x = land.x;
    y = land.y;

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
              : kind === 'goblin'
                ? PROP_KEYS.goblinCamp
                : kind === 'giant'
                  ? PROP_KEYS.giantCamp
                  : PROP_KEYS.banditCamp;

    const sprite = this.scene.add.image(x, y, tex);
    sprite.setDepth(8);
    sprite.setOrigin(0.5, 1);

    const maxSupply = opts?.maxSupply ?? (kind === 'siege' ? WarBalance.siegeMaxSupply(this.daysPlayed) : 0);
    const supply = opts?.supply ?? maxSupply;
    const garrison = opts?.garrison ?? 1;
    const away = opts?.away ?? 0;

    const camp: CampRecord = {
      id,
      kind,
      x,
      y,
      garrison,
      away,
      spawnMs: WarBalance.garrisonSpawnMs(kind, this.daysPlayed),
      raidCooldownMs: opts?.raidCooldownMs ?? 20_000 + Math.random() * 40_000,
      supply,
      maxSupply,
      reinforceMs: WarBalance.siegeReinforceMs(this.daysPlayed),
      sprite,
      generalName: opts?.generalName ?? this.generateLeaderName(kind),
      supplyToastShown: supply <= 0,
      roster: opts?.roster ? opts.roster.map((u) => ({ ...u })) : [],
      leaderHome: opts?.leaderHome ?? garrison > 0,
      leaderPartySize: 0,
      demoralizedMs: opts?.demoralizedMs ?? 0,
      activityMs: 4_000 + Math.random() * 4_000,
    };

    this.camps.push(camp);

    if (!opts?.roster) {
      if (isLivingCampKind(kind) && this.subjects) {
        const acts = HOME_ACTIVITIES[kind];
        for (let i = 0; i < garrison; i++) {
          const spawnId = this.subjects.spawnCampMember(camp.id, kind, x, y);
          const managed = this.subjects.getById(spawnId);
          camp.roster.push({
            id: spawnId,
            name: managed?.data.name ?? 'Unknown',
            role: ROSTER_ROLE[kind],
            status: 'home',
            activity: acts[Math.floor(Math.random() * acts.length)]!,
          });
        }
      } else {
        this.syncRoster(camp);
      }
    }

    if (kind === 'siege') {
      const barY = y - sprite.displayHeight - 6;
      camp.supplyBg = this.scene.add
        .rectangle(x, barY, 28, 4, 0x1a1010, 0.85)
        .setDepth(30)
        .setOrigin(0.5, 0.5);
      camp.supplyFill = this.scene.add
        .rectangle(x - 13, barY, 26, 3, 0xc4a35a, 1)
        .setDepth(31)
        .setOrigin(0, 0.5);
      this.refreshSupplyBar(camp);
    }

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
    if (this.selectedId === camp.id) this.selectedId = null;
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

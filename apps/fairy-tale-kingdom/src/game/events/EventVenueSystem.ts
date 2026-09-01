import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { RaidSystem } from '../raids/RaidSystem';
import { KingdomEvents } from '../subjects/events';
import { ringOffset } from '../subjects/zones';
import type { FestivalKind } from './festivalRequirements';

export type VenueKind = 'festival' | 'wedding' | 'joust' | 'funeral';

function festivalVenueTexture(kind: FestivalKind | null): string {
  switch (kind) {
    case 'harvest':
      return PROP_KEYS.venueFestivalHarvest;
    case 'harbor':
      return PROP_KEYS.venueFestivalHarbor;
    case 'cathedral':
      return PROP_KEYS.venueFestivalCathedral;
    case 'market':
      return PROP_KEYS.venueFestivalMarket;
    default:
      return PROP_KEYS.venueFestival;
  }
}

interface ActiveVenue {
  kind: VenueKind;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  hp: number;
  remainingMs: number;
  guardIds: string[];
}

const VENUE_TEX: Record<VenueKind, string> = {
  festival: PROP_KEYS.venueFestival,
  wedding: PROP_KEYS.venueWedding,
  joust: PROP_KEYS.venueJoust,
  funeral: PROP_KEYS.venueFuneral,
};

const DANGER_R = 70;

/** Temporary animated event props with burn/flee under attack. */
export class EventVenueSystem {
  private venues: ActiveVenue[] = [];
  private festivalAnchor: { kind: FestivalKind; x: number; y: number } | null =
    null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly buildings: BuildingSystem,
    private readonly subjects: SubjectSystem,
    private readonly raids: RaidSystem
  ) {}

  /** Where the current/next festival tent should rise, from RoyaltySystem's pick. */
  setFestivalAnchor(
    pick: { kind: FestivalKind; x: number; y: number } | null
  ): void {
    this.festivalAnchor = pick;
  }

  update(deltaMs: number, opts: {
    festivalActive: boolean;
    weddingActive: boolean;
    peacetime: boolean;
  }): void {
    // Festival/joust venues are triggered explicitly by RoyaltySystem's
    // unified, eligibility-gated festival timer (see startFestivalAt /
    // startJoustAt below), so only weddings are spawned reactively here.
    // `opts.festivalActive` is kept for callers that still pass it, but a
    // stray true value won't double-spawn thanks to the guard.
    if (
      opts.festivalActive &&
      !this.venues.some((v) => v.kind === 'festival')
    ) {
      this.spawn('festival');
    }
    if (
      opts.weddingActive &&
      !this.venues.some((v) => v.kind === 'wedding')
    ) {
      this.spawn('wedding');
    }

    for (const v of [...this.venues]) {
      v.remainingMs -= deltaMs;
      this.assignGuards(v);
      if (this.raids.hasActiveRaiders()) {
        // burn if raiders near
        // RaidSystem doesn't expose positions easily — use hasActiveRaiders + random risk when siege
        if (Math.random() < 0.002) {
          this.burn(v, 'Raiders');
          continue;
        }
      }
      if (v.remainingMs <= 0) this.despawn(v);
    }
  }

  startFuneral(nearX?: number, nearY?: number): void {
    if (!this.buildings.hasCemetery()) return;
    if (this.venues.some((v) => v.kind === 'funeral')) return;
    this.spawn('funeral', nearX, nearY);
  }

  startFestivalAt(x: number, y: number): void {
    if (this.venues.some((v) => v.kind === 'festival')) return;
    this.spawn('festival', x, y);
  }

  startJoustAt(x: number, y: number): void {
    if (this.venues.some((v) => v.kind === 'joust')) return;
    this.spawn('joust', x, y);
  }

  private spawn(kind: VenueKind, x?: number, y?: number): void {
    const anchor = this.anchorFor(kind);
    if (!anchor && x == null) return;
    const px = x ?? anchor!.x + 28;
    const py = y ?? anchor!.y + 10;
    const tex =
      kind === 'festival'
        ? festivalVenueTexture(this.festivalAnchor?.kind ?? null)
        : VENUE_TEX[kind];
    if (!this.scene.textures.exists(tex)) return;
    const sprite = this.scene.add
      .image(px, py, tex)
      .setDepth(4)
      .setOrigin(0.5, 0.85);
    this.venues.push({
      kind,
      sprite,
      x: px,
      y: py,
      hp: 40,
      remainingMs: kind === 'funeral' ? 35_000 : 45_000,
      guardIds: [],
    });
    if (kind !== 'festival') {
      // Festival toasts are kind-specific and already sent by RoyaltySystem.
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message:
          kind === 'wedding'
            ? 'A wedding arch blooms by the cathedral!'
            : kind === 'joust'
              ? 'Jousting lists open by the barracks!'
              : 'A funeral gathers at the cemetery.',
      });
    }
    // Cap attendance: nearby subjects get happiness
    for (const s of this.subjects.listManaged()) {
      const d = Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, px, py);
      if (d < 120 && this.venues[this.venues.length - 1]!.guardIds.length < 8) {
        this.subjects.adjustHappiness(s.data.id, kind === 'funeral' ? 4 : 6);
        this.subjects.appendLifeLog(
          s.data.id,
          `Attended the ${kind}`,
          kind
        );
      }
    }
    if (kind === 'joust') {
      const king = this.subjects.firstByRole('king');
      const queen = this.subjects.firstByRole('queen');
      if (king) {
        this.subjects.nudgeToward(king.data.id, px, py, 40);
        this.subjects.appendLifeLog(king.data.id, 'Attended the joust', 'joust');
      }
      if (queen) {
        this.subjects.nudgeToward(queen.data.id, px + 10, py, 40);
        this.subjects.appendLifeLog(queen.data.id, 'Attended the joust', 'joust');
      }
    }
  }

  private anchorFor(
    kind: VenueKind
  ): { x: number; y: number } | null {
    if (kind === 'festival') {
      if (this.festivalAnchor) {
        return { x: this.festivalAnchor.x, y: this.festivalAnchor.y };
      }
      const market = this.buildings
        .serialize()
        .find((b) => b.kind === 'market' || b.kind === 'house');
      if (market) return { x: market.x, y: market.y };
      return this.buildings.getKeepPoint();
    }
    if (kind === 'wedding') {
      return this.buildings.getCathedralPoint?.() ?? null;
    }
    if (kind === 'joust') {
      const barracks = this.buildings
        .serialize()
        .find((b) => b.kind === 'barracks');
      return barracks
        ? { x: barracks.x, y: barracks.y }
        : this.buildings.getKeepPoint();
    }
    if (kind === 'funeral') {
      const cem = this.buildings.serialize().find((b) => b.kind === 'cemetery');
      return cem ? { x: cem.x, y: cem.y } : null;
    }
    return null;
  }

  private assignGuards(v: ActiveVenue): void {
    const guards = this.subjects
      .listManaged()
      .filter(
        (s) =>
          (s.data.role === 'guard' ||
            s.data.role === 'archer' ||
            s.data.role === 'soldier' ||
            s.data.role === 'elite_guard' ||
            s.data.role === 'elite_archer') &&
          !s.interrupt
      )
      .slice(0, 3);
    guards.forEach((g, i) => {
      g.interrupt = { kind: 'guard_event', remainingMs: 3000 };
      const off = ringOffset(i, guards.length, 40);
      const dest = this.subjects.snapToWalkable(v.x + off.x, v.y + off.y);
      this.subjects.nudgeToward(g.data.id, dest.x, dest.y, 50);
      if (!v.guardIds.includes(g.data.id)) v.guardIds.push(g.data.id);
    });
  }

  private burn(v: ActiveVenue, by: string): void {
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${by} burned the ${v.kind}!`,
    });
    for (const s of this.subjects.listManaged()) {
      const d = Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, v.x, v.y);
      if (d < DANGER_R) {
        this.subjects.beginFleeFromMonster(s.data.id, v.x, v.y);
        this.subjects.adjustHappiness(s.data.id, -8);
        this.subjects.appendLifeLog(
          s.data.id,
          `Fled when the ${v.kind} was sacked`,
          'sacked'
        );
      }
    }
    this.despawn(v);
  }

  private despawn(v: ActiveVenue): void {
    v.sprite.destroy();
    this.venues = this.venues.filter((x) => x !== v);
  }

  clear(): void {
    for (const v of this.venues) v.sprite.destroy();
    this.venues = [];
  }
}

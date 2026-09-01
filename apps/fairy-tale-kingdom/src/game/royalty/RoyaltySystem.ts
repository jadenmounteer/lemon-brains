import Phaser from 'phaser';
import { EconomyBalance } from '../economy/economy';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import { ParadeSystem } from './ParadeSystem';
import {
  listEligibleFestivals,
  type FestivalKind,
} from '../events/festivalRequirements';
import { EventCoordinator } from '../events/EventCoordinator';

/** Prince spawn, FGM ball bless, weddings, balls/festivals, prince+princess wave buffs. */
export class RoyaltySystem {
  private princeSpawnMs = 0;
  private fgmCooldownMs = 0;
  private waveCooldownMs = EconomyBalance.waveIntervalMs;
  private waveRemainingMs = 0;
  private inspired = false;
  private readonly events: EventCoordinator;
  private onFestivalStart:
    | ((pick: { kind: FestivalKind; x: number; y: number }) => void)
    | null = null;
  private onBallStart: ((pt: { x: number; y: number }) => void) | null = null;
  private onBallEnd: (() => void) | null = null;
  private onWeddingStart:
    | ((opts: {
        a: string;
        b: string;
        bishop: string;
        x: number;
        y: number;
      }) => boolean)
    | null = null;
  private lastMorningHour = -1;
  private weddingCooldownMs = 0;
  private readonly parade: ParadeSystem;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {
    this.parade = new ParadeSystem(scene, subjects, buildings);
    this.events = new EventCoordinator({
      listEligibleFestivals: () =>
        listEligibleFestivals({
          buildings: this.buildings.list().map((b) => ({
            kind: b.kind,
            x: b.x,
            y: b.y,
            hp: b.hp,
          })),
          countRole: (role) => this.subjects.countRole(role),
          countJob: (job) =>
            this.subjects
              .listManaged()
              .filter((s) => s.data.job === job).length,
          hasKingOrQueen:
            this.subjects.hasRole('king') || this.subjects.hasRole('queen'),
          hasKingAndQueen:
            this.subjects.hasRole('king') && this.subjects.hasRole('queen'),
        }),
      hasRoyalCourt: () =>
        this.subjects.hasRole('king') &&
        this.subjects.hasRole('queen') &&
        this.subjects.hasRole('prince'),
      markBallGather: () => this.subjects.markBallGather(),
      markFestivalGather: (venue) => this.subjects.markFestivalGather(venue),
      clearGatherActivities: (kinds) => this.subjects.clearGatherActivities(kinds),
      toast: (message) =>
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, { message }),
    });
    this.events.setOnBallStart((pt) => this.onBallStart?.(pt));
    this.events.setOnBallEnd(() => this.onBallEnd?.());
    this.events.setOnFestivalStart((pick) => this.onFestivalStart?.(pick));
  }

  setOnBallStart(cb: (pt: { x: number; y: number }) => void): void {
    this.onBallStart = cb;
    this.events.setOnBallStart(cb);
  }

  setOnBallEnd(cb: () => void): void {
    this.onBallEnd = cb;
    this.events.setOnBallEnd(cb);
  }

  setOnWeddingStart(
    cb: (opts: {
      a: string;
      b: string;
      bishop: string;
      x: number;
      y: number;
    }) => boolean
  ): void {
    this.onWeddingStart = cb;
  }

  isInspired(): boolean {
    return this.inspired;
  }

  isBallActive(): boolean {
    return this.events.isBallActive();
  }

  isFestivalActive(): boolean {
    return this.events.isFestivalActive();
  }

  festivalHarvestMult(): number {
    return this.isFestivalActive() ? EconomyBalance.festivalHarvestMult : 1;
  }

  fgmReady(): boolean {
    return (
      this.fgmCooldownMs <= 0 &&
      this.isBallActive() &&
      this.subjects.hasRole('fairy_godmother')
    );
  }

  serializeTimers(): {
    princeSpawnMs: number;
    fgmCooldownMs: number;
    ballRemainingMs: number;
    ballCooldownMs: number;
    festivalRemainingMs: number;
    festivalCooldownMs: number;
    paradeCooldownMs: number;
    paradeRemainingMs: number;
  } {
    const parade = this.parade.serialize();
    const ball = this.events.legacyBallTimers();
    const festival = this.events.legacyFestivalTimers();
    return {
      princeSpawnMs: this.princeSpawnMs,
      fgmCooldownMs: this.fgmCooldownMs,
      ballRemainingMs: ball.ballRemainingMs,
      ballCooldownMs: ball.ballCooldownMs,
      festivalRemainingMs: festival.festivalRemainingMs,
      festivalCooldownMs: festival.festivalCooldownMs,
      paradeCooldownMs: parade.paradeCooldownMs,
      paradeRemainingMs: parade.paradeRemainingMs,
    };
  }

  restoreTimers(timers: {
    princeSpawnMs?: number;
    fgmCooldownMs?: number;
    ballRemainingMs?: number;
    ballCooldownMs?: number;
    festivalRemainingMs?: number;
    festivalCooldownMs?: number;
    paradeCooldownMs?: number;
    paradeRemainingMs?: number;
  }): void {
    if (typeof timers.princeSpawnMs === 'number') {
      this.princeSpawnMs = timers.princeSpawnMs;
    }
    if (typeof timers.fgmCooldownMs === 'number') {
      this.fgmCooldownMs = timers.fgmCooldownMs;
    }
    this.events.restoreLegacyTimers(timers);
    this.parade.restore(timers.paradeCooldownMs, timers.paradeRemainingMs);
  }

  update(deltaMs: number, peacetime = true): void {
    if (this.fgmCooldownMs > 0) this.fgmCooldownMs -= deltaMs;
    if (this.weddingCooldownMs > 0) this.weddingCooldownMs -= deltaMs;

    const hour = Math.floor(this.subjects.clock.hour);
    if (hour === 6 && this.lastMorningHour !== 6) {
      this.subjects.revertUnmarriedBallPrincesses();
    }
    this.lastMorningHour = hour;

    const hasKing = this.subjects.hasRole('king');
    const hasQueen = this.subjects.hasRole('queen');
    const hasPrince = this.subjects.hasRole('prince');

    if (hasKing && hasQueen && !hasPrince) {
      this.princeSpawnMs += deltaMs;
      if (this.princeSpawnMs >= EconomyBalance.princeSpawnMs) {
        const ok = this.subjects.hire('prince');
        if (ok) {
          this.princeSpawnMs = 0;
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: 'A Prince has been born!',
          });
        }
      }
    } else if (!hasKing || !hasQueen) {
      this.princeSpawnMs = 0;
    }

    if (!peacetime && this.events.isCelebrationActive()) {
      this.events.pauseForThreat();
    }
    this.events.tick(deltaMs, peacetime);
    this.tryAutoWedding();
    this.parade.update(deltaMs, peacetime);

    const hasPrincess = this.subjects.hasRole('princess');
    if (hasPrince && hasPrincess) {
      if (this.waveRemainingMs > 0) {
        this.waveRemainingMs -= deltaMs;
        if (this.waveRemainingMs <= 0) {
          this.inspired = false;
          this.waveRemainingMs = 0;
        }
      } else {
        this.waveCooldownMs -= deltaMs;
        if (this.waveCooldownMs <= 0) {
          this.waveCooldownMs = EconomyBalance.waveIntervalMs;
          this.waveRemainingMs = EconomyBalance.waveDurationMs;
          this.inspired = true;
          this.markRoyalsWaving();
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: 'The prince and princess inspire the realm!',
          });
        }
      }
    } else {
      this.inspired = false;
      this.waveRemainingMs = 0;
      this.waveCooldownMs = EconomyBalance.waveIntervalMs;
    }
  }

  tryTransformPeasant(fgmId: string): boolean {
    if (!this.fgmReady()) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: this.isBallActive()
          ? 'Fairy Godmother needs a moment'
          : 'Blessings only work during a royal ball',
      });
      return false;
    }
    const fgm = this.subjects.getById(fgmId);
    if (!fgm || fgm.data.role !== 'fairy_godmother') return false;
    if (fgm.data.sick) return false;

    const peasant = this.subjects.nearestFemalePeasant(
      fgm.sprite.x,
      fgm.sprite.y,
      EconomyBalance.fgmTransformRange
    );
    if (!peasant) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No female peasant nearby to bless',
      });
      return false;
    }

    const ok = this.subjects.transformRole(peasant.data.id, 'princess', {
      temporaryPrincess: true,
    });
    if (!ok) return false;
    this.fgmCooldownMs = EconomyBalance.fgmTransformCooldownMs;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${peasant.data.name} is a Princess for the ball!`,
    });
    return true;
  }

  royaltyUnlocked(): boolean {
    return this.subjects.hasRole('king') && this.subjects.hasRole('queen');
  }

  getActiveFestivalKind(): FestivalKind | null {
    return this.events.getActiveFestivalKind();
  }

  setOnFestivalStart(
    cb: (pick: { kind: FestivalKind; x: number; y: number }) => void
  ): void {
    this.onFestivalStart = cb;
    this.events.setOnFestivalStart(cb);
  }

  private tryAutoWedding(): void {
    if (this.weddingCooldownMs > 0) return;
    if (!this.buildings.hasCathedral()) return;
    if (!this.subjects.hasRole('bishop')) return;
    const prince = this.subjects.firstByRole('prince');
    const princess = this.subjects.unmarriedPrincess();
    const bishop = this.subjects.firstByRole('bishop');
    if (!prince || !princess || !bishop) return;

    const cat = this.buildings.getCathedralPoint();
    if (!cat) return;

    const near =
      Phaser.Math.Distance.Between(
        prince.sprite.x,
        prince.sprite.y,
        princess.sprite.x,
        princess.sprite.y
      ) < CombatBalance.marriageRange ||
      (Phaser.Math.Distance.Between(
        prince.sprite.x,
        prince.sprite.y,
        cat.x,
        cat.y
      ) < 80 &&
        Phaser.Math.Distance.Between(
          princess.sprite.x,
          princess.sprite.y,
          cat.x,
          cat.y
        ) < 80);

    if (!near) return;

    this.weddingCooldownMs = 45_000;
    const started = this.onWeddingStart?.({
      a: prince.data.id,
      b: princess.data.id,
      bishop: bishop.data.id,
      x: cat.x,
      y: cat.y,
    });
    if (!started) {
      this.subjects.beginWedding(
        prince.data.id,
        princess.data.id,
        bishop.data.id,
        cat,
        CombatBalance.weddingDurationMs
      );
    }
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${prince.data.name} and ${princess.data.name} wed at the cathedral!`,
    });
  }

  private markRoyalsWaving(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.role === 'prince' || s.data.role === 'princess') {
        s.data.activity = 'wave';
        s.data.activityLabel = 'Waving to the people';
      }
    }
  }
}

import Phaser from 'phaser';
import { EconomyBalance } from '../economy/economy';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import { ParadeSystem } from './ParadeSystem';

/** Prince spawn, FGM ball bless, weddings, balls/festivals, prince+princess wave buffs. */
export class RoyaltySystem {
  private princeSpawnMs = 0;
  private fgmCooldownMs = 0;
  private waveCooldownMs = EconomyBalance.waveIntervalMs;
  private waveRemainingMs = 0;
  private inspired = false;
  private ballCooldownMs = EconomyBalance.ballMinIntervalMs * 0.4;
  private ballRemainingMs = 0;
  private festivalCooldownMs = EconomyBalance.festivalMinIntervalMs * 0.5;
  private festivalRemainingMs = 0;
  private lastMorningHour = -1;
  private weddingCooldownMs = 0;
  private readonly parade: ParadeSystem;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {
    this.parade = new ParadeSystem(scene, subjects, buildings);
  }

  isInspired(): boolean {
    return this.inspired;
  }

  isBallActive(): boolean {
    return this.ballRemainingMs > 0;
  }

  isFestivalActive(): boolean {
    return this.festivalRemainingMs > 0;
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
    return {
      princeSpawnMs: this.princeSpawnMs,
      fgmCooldownMs: this.fgmCooldownMs,
      ballRemainingMs: this.ballRemainingMs,
      ballCooldownMs: this.ballCooldownMs,
      festivalRemainingMs: this.festivalRemainingMs,
      festivalCooldownMs: this.festivalCooldownMs,
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
    if (typeof timers.ballRemainingMs === 'number') {
      this.ballRemainingMs = timers.ballRemainingMs;
    }
    if (typeof timers.ballCooldownMs === 'number') {
      this.ballCooldownMs = timers.ballCooldownMs;
    }
    if (typeof timers.festivalRemainingMs === 'number') {
      this.festivalRemainingMs = timers.festivalRemainingMs;
    }
    if (typeof timers.festivalCooldownMs === 'number') {
      this.festivalCooldownMs = timers.festivalCooldownMs;
    }
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

    this.updateBall(deltaMs, hasKing, hasQueen, hasPrince);
    this.updateFestival(deltaMs);
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

  private updateBall(
    deltaMs: number,
    hasKing: boolean,
    hasQueen: boolean,
    hasPrince: boolean
  ): void {
    if (this.ballRemainingMs > 0) {
      this.ballRemainingMs -= deltaMs;
      if (this.ballRemainingMs <= 0) {
        this.ballRemainingMs = 0;
        this.ballCooldownMs = EconomyBalance.ballMinIntervalMs;
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'The royal ball has ended',
        });
      }
      return;
    }
    if (!(hasKing && hasQueen && hasPrince)) return;
    this.ballCooldownMs -= deltaMs;
    if (this.ballCooldownMs <= 0) {
      this.ballRemainingMs = EconomyBalance.ballDurationMs;
      this.ballCooldownMs = EconomyBalance.ballMinIntervalMs;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'A royal ball begins at the keep!',
      });
      this.subjects.markBallGather();
    }
  }

  private updateFestival(deltaMs: number): void {
    if (this.festivalRemainingMs > 0) {
      this.festivalRemainingMs -= deltaMs;
      if (this.festivalRemainingMs <= 0) {
        this.festivalRemainingMs = 0;
        this.festivalCooldownMs = EconomyBalance.festivalMinIntervalMs;
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'The festival winds down',
        });
      }
      return;
    }
    this.festivalCooldownMs -= deltaMs;
    if (this.festivalCooldownMs <= 0) {
      this.festivalRemainingMs = EconomyBalance.festivalDurationMs;
      this.festivalCooldownMs = EconomyBalance.festivalMinIntervalMs;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'A festival fills the streets with cheer!',
      });
      this.subjects.markFestivalGather();
    }
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

    this.weddingCooldownMs = 12_000;
    this.subjects.beginWedding(
      prince.data.id,
      princess.data.id,
      bishop.data.id,
      cat,
      CombatBalance.weddingDurationMs
    );
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

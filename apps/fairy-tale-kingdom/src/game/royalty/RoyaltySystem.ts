import Phaser from 'phaser';
import { isRoyalRole } from '../art/assetManifest';
import { EconomyBalance } from '../economy/economy';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';

/** Prince spawn, FGM transform cooldown, prince+princess wave buffs. */
export class RoyaltySystem {
  private princeSpawnMs = 0;
  private fgmCooldownMs = 0;
  private waveCooldownMs = EconomyBalance.waveIntervalMs;
  private waveRemainingMs = 0;
  private inspired = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem
  ) {}

  isInspired(): boolean {
    return this.inspired;
  }

  fgmReady(): boolean {
    return this.fgmCooldownMs <= 0 && this.subjects.hasRole('fairy_godmother');
  }

  serializeTimers(): { princeSpawnMs: number; fgmCooldownMs: number } {
    return {
      princeSpawnMs: this.princeSpawnMs,
      fgmCooldownMs: this.fgmCooldownMs,
    };
  }

  restoreTimers(princeSpawnMs?: number, fgmCooldownMs?: number): void {
    if (typeof princeSpawnMs === 'number') this.princeSpawnMs = princeSpawnMs;
    if (typeof fgmCooldownMs === 'number') this.fgmCooldownMs = fgmCooldownMs;
  }

  update(deltaMs: number): void {
    if (this.fgmCooldownMs > 0) this.fgmCooldownMs -= deltaMs;

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
    if (!this.fgmReady()) return false;
    const fgm = this.subjects.getById(fgmId);
    if (!fgm || fgm.data.role !== 'fairy_godmother') return false;
    if (fgm.data.sick) return false;

    const peasant = this.subjects.nearestPeasant(
      fgm.sprite.x,
      fgm.sprite.y,
      EconomyBalance.fgmTransformRange
    );
    if (!peasant) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No peasant nearby to bless',
      });
      return false;
    }

    const ok = this.subjects.transformRole(peasant.data.id, 'princess');
    if (!ok) return false;
    this.fgmCooldownMs = EconomyBalance.fgmTransformCooldownMs;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${peasant.data.name} is now a Princess!`,
    });
    return true;
  }

  royaltyUnlocked(): boolean {
    return this.subjects.hasRole('king') && this.subjects.hasRole('queen');
  }

  private markRoyalsWaving(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.role === 'prince' || s.data.role === 'princess') {
        if (s.interrupt) continue;
        s.data.activity = 'wave';
        s.data.activityLabel = 'Waving to the people';
      }
    }
  }
}

export function isCapturableRole(role: string): boolean {
  return isRoyalRole(role as Parameters<typeof isRoyalRole>[0]);
}

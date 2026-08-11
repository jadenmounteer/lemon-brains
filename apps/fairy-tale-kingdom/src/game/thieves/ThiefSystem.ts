import type { BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type Phaser from 'phaser';

interface Thief {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  stealCooldownMs: number;
}

/**
 * Legacy night thieves — free edge pops disabled in Phase 11.
 * Capture helpers remain for any leftover sprites; new thieves come from dens via RaidSystem.
 */
export class ThiefSystem {
  private thieves: Thief[] = [];
  private captured = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  capturedCount(): number {
    return this.captured;
  }

  update(deltaMs: number, _isNight: boolean, _raidActive: boolean): void {
    for (const thief of [...this.thieves]) {
      const keep = this.buildings.getActiveKeepPoint();
      const dx = keep.x - thief.sprite.x;
      const dy = keep.y - thief.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      thief.stealCooldownMs -= deltaMs;
      if (dist > 28) {
        const step = 40 * (deltaMs / 1000);
        thief.sprite.x += (dx / dist) * step;
        thief.sprite.y += (dy / dist) * step;
      } else if (thief.stealCooldownMs <= 0) {
        thief.stealCooldownMs = 8000;
        this.scene.game.events.emit(KingdomEvents.GOLD_STOLEN, {
          amount: CombatBalance.thiefStealGold,
          kind: 'thief',
          label: 'a thief',
        });
      }

      const guard = this.subjects.nearestMilitary(
        thief.sprite.x,
        thief.sprite.y,
        CombatBalance.thiefCaptureRange
      );
      if (guard && this.buildings.hasDungeon()) {
        this.capture(thief);
      }
    }
  }

  private capture(thief: Thief): void {
    thief.sprite.destroy();
    this.thieves = this.thieves.filter((t) => t !== thief);
    this.captured += 1;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Guards locked a thief in the dungeon!',
    });
  }

  clear(): void {
    for (const t of this.thieves) t.sprite.destroy();
    this.thieves = [];
  }
}

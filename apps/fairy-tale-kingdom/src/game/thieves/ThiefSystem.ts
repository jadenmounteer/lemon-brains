import Phaser from 'phaser';
import { idleAnimKey } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import { EconomyBalance } from '../economy/economy';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { pickName } from '../subjects/names';

interface Thief {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  stealCooldownMs: number;
}

/** Night thieves steal gold; guards can capture them into a dungeon. */
export class ThiefSystem {
  private thieves: Thief[] = [];
  private checkMs = EconomyBalance.thiefCheckMs * 0.3;
  private nextId = 0;
  private captured = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  capturedCount(): number {
    return this.captured;
  }

  update(deltaMs: number, isNight: boolean, raidActive: boolean): void {
    this.checkMs -= deltaMs;
    if (
      this.checkMs <= 0 &&
      isNight &&
      !raidActive &&
      this.thieves.length < 2
    ) {
      this.checkMs = EconomyBalance.thiefCheckMs;
      this.spawnThief();
    } else if (this.checkMs <= 0) {
      this.checkMs = EconomyBalance.thiefCheckMs * 0.5;
    }

    const keep = this.buildings.getActiveKeepPoint();
    for (const thief of [...this.thieves]) {
      thief.stealCooldownMs -= deltaMs;
      const dx = keep.x - thief.sprite.x;
      const dy = keep.y - thief.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 28) {
        const step = 40 * (deltaMs / 1000);
        thief.sprite.x += (dx / dist) * step;
        thief.sprite.y += (dy / dist) * step;
        thief.sprite.setDepth(20);
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

  private spawnThief(): void {
    const keep = this.buildings.getActiveKeepPoint();
    const angle = Math.random() * Math.PI * 2;
    const x = keep.x + Math.cos(angle) * 220;
    const y = keep.y + Math.sin(angle) * 180;
    const id = `thief-${this.nextId++}`;
    const sprite = this.scene.add.sprite(x, y, 'bandit', 0);
    sprite.setDepth(20);
    sprite.setOrigin(0.5, 1);
    sprite.play(idleAnimKey('bandit'));
    this.thieves.push({
      id,
      sprite,
      stealCooldownMs: 2000,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${pickName(5000 + this.nextId)} the thief prowls the night!`,
    });
  }

  private capture(thief: Thief): void {
    thief.sprite.destroy();
    this.thieves = this.thieves.filter((t) => t !== thief);
    this.captured += 1;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: this.buildings.hasDungeon()
        ? 'Guards locked a thief in the dungeon!'
        : 'Guards drove off a thief!',
    });
  }

  clear(): void {
    for (const t of this.thieves) t.sprite.destroy();
    this.thieves = [];
  }
}

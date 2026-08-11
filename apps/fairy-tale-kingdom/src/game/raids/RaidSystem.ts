import Phaser from 'phaser';
import {
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type EnemyRole,
} from '../art/assetManifest';
import { KingdomEvents } from '../subjects/events';

export interface KeepPoint {
  x: number;
  y: number;
}

type RaidKind = EnemyRole;

interface ActiveRaider {
  kind: RaidKind;
  sprite: Phaser.GameObjects.Sprite;
  tween?: Phaser.Tweens.Tween;
}

const STEAL_AMOUNTS: Record<Exclude<RaidKind, 'enemy_army'>, number> = {
  bandit: 5,
  giant: 12,
};

const LABELS: Record<RaidKind, string> = {
  bandit: 'Bandits',
  giant: 'Giants',
  enemy_army: 'a rival kingdom’s army',
};

/** First raid after grace period; then on a timer with escalating army chance. */
const GRACE_MS = 40_000;
const RAID_INTERVAL_MS = 55_000;
const KEEP_REACH_PX = 28;

export class RaidSystem {
  private raiders: ActiveRaider[] = [];
  private elapsedMs = 0;
  private nextRaidAt = GRACE_MS;
  private gameOver = false;
  private raidCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: { width: number; height: number },
    private readonly keep: KeepPoint
  ) {}

  get isGameOver(): boolean {
    return this.gameOver;
  }

  update(deltaMs: number): void {
    if (this.gameOver) return;

    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.nextRaidAt) {
      this.nextRaidAt = this.elapsedMs + RAID_INTERVAL_MS;
      this.spawnRaid();
    }
  }

  clear(): void {
    for (const r of this.raiders) {
      r.tween?.stop();
      r.sprite.destroy();
    }
    this.raiders = [];
  }

  private spawnRaid(): void {
    this.raidCount += 1;
    // Every 3rd raid after the first, or 25% chance: enemy army (lose if they reach keep)
    const army =
      this.raidCount >= 3 &&
      (this.raidCount % 3 === 0 || Math.random() < 0.25);
    const kind: RaidKind = army
      ? 'enemy_army'
      : Math.random() < 0.4
        ? 'giant'
        : 'bandit';

    const count =
      kind === 'enemy_army' ? Phaser.Math.Between(3, 5) : Phaser.Math.Between(1, 2);

    this.scene.game.events.emit(KingdomEvents.RAID_WARNING, {
      kind,
      label: LABELS[kind],
    });

    const edge = this.randomEdgeSpawn();
    for (let i = 0; i < count; i++) {
      const ox = edge.x + Phaser.Math.Between(-20, 20);
      const oy = edge.y + Phaser.Math.Between(-20, 20);
      this.launchRaider(kind, ox, oy, i * 180);
    }
  }

  private launchRaider(
    kind: RaidKind,
    x: number,
    y: number,
    delayMs: number
  ): void {
    const sprite = this.scene.add.sprite(x, y, kind, 0);
    sprite.setDepth(25);
    sprite.setOrigin(0.5, 1);
    if (kind === 'giant') {
      sprite.setScale(1.4);
    }
    sprite.play(idleAnimKey(kind));

    const raider: ActiveRaider = { kind, sprite };
    this.raiders.push(raider);

    this.scene.time.delayedCall(delayMs, () => {
      if (this.gameOver || !sprite.active) return;
      this.marchToKeep(raider);
    });
  }

  private marchToKeep(raider: ActiveRaider): void {
    const { sprite, kind } = raider;
    if (!sprite.active) return;

    const dx = this.keep.x - sprite.x;
    const dy = this.keep.y - sprite.y;
    const dir = facingFromDelta(dx, dy);
    sprite.play(walkAnimKey(kind, dir), true);

    const dist = Math.hypot(dx, dy);
    const speed = kind === 'giant' ? 28 : kind === 'enemy_army' ? 36 : 42;
    const duration = Math.max(4000, (dist / speed) * 1000);

    raider.tween = this.scene.tweens.add({
      targets: sprite,
      x: this.keep.x + Phaser.Math.Between(-8, 8),
      y: this.keep.y + 20 + Phaser.Math.Between(-6, 6),
      duration,
      ease: 'Linear',
      onUpdate: () => {
        sprite.setDepth(25 + sprite.y * 0.01);
        if (
          !this.gameOver &&
          Phaser.Math.Distance.Between(
            sprite.x,
            sprite.y,
            this.keep.x,
            this.keep.y
          ) < KEEP_REACH_PX
        ) {
          raider.tween?.stop();
          this.onReachedKeep(raider);
        }
      },
      onComplete: () => {
        if (!this.gameOver && sprite.active) {
          this.onReachedKeep(raider);
        }
      },
    });
  }

  private onReachedKeep(raider: ActiveRaider): void {
    if (!raider.sprite.active) return;

    if (raider.kind === 'enemy_army') {
      this.triggerGameOver();
      return;
    }

    const amount = STEAL_AMOUNTS[raider.kind];
    this.scene.game.events.emit(KingdomEvents.GOLD_STOLEN, {
      amount,
      kind: raider.kind,
      label: LABELS[raider.kind],
    });

    raider.sprite.play(idleAnimKey(raider.kind));
    this.scene.tweens.add({
      targets: raider.sprite,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        raider.sprite.destroy();
        this.raiders = this.raiders.filter((r) => r !== raider);
      },
    });
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    for (const r of this.raiders) {
      r.tween?.stop();
      if (r.sprite.active) {
        r.sprite.play(idleAnimKey(r.kind));
      }
    }
    this.scene.game.events.emit(KingdomEvents.GAME_OVER, {
      reason:
        'A rival kingdom’s army stormed your keep. Your kingdom has fallen.',
    });
  }

  private randomEdgeSpawn(): { x: number; y: number } {
    const pad = 24;
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
      case 0:
        return { x: Phaser.Math.Between(pad, this.world.width - pad), y: pad };
      case 1:
        return {
          x: Phaser.Math.Between(pad, this.world.width - pad),
          y: this.world.height - pad,
        };
      case 2:
        return { x: pad, y: Phaser.Math.Between(pad, this.world.height - pad) };
      default:
        return {
          x: this.world.width - pad,
          y: Phaser.Math.Between(pad, this.world.height - pad),
        };
    }
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

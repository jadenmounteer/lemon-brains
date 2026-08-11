import Phaser from 'phaser';
import { UNIT_HEIGHT } from '../art/assetManifest';

interface Bubble {
  sprite: Phaser.GameObjects.Sprite;
  text: Phaser.GameObjects.Text;
  remainingMs: number;
}

const DEFAULT_DURATION_MS = 2500;
const FADE_MS = 500;
const BUBBLE_DEPTH = 50;

/** Small text bubbles that float above a sprite's head, follow it, and fade out. */
export class SpeechBubbleSystem {
  private bubbles = new Map<Phaser.GameObjects.Sprite, Bubble>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Show (or replace) a bubble above `sprite` for ~2.5s. */
  say(
    sprite: Phaser.GameObjects.Sprite,
    message: string,
    durationMs = DEFAULT_DURATION_MS
  ): void {
    this.clear(sprite);
    const text = this.scene.add
      .text(sprite.x, sprite.y - UNIT_HEIGHT - 6, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#2b1d0e',
        backgroundColor: '#fff6dcdd',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(BUBBLE_DEPTH);
    this.bubbles.set(sprite, { sprite, text, remainingMs: durationMs });
  }

  clear(sprite: Phaser.GameObjects.Sprite): void {
    const existing = this.bubbles.get(sprite);
    if (!existing) return;
    existing.text.destroy();
    this.bubbles.delete(sprite);
  }

  update(deltaMs: number): void {
    if (!this.bubbles.size) return;
    for (const [sprite, b] of [...this.bubbles]) {
      if (!sprite.active) {
        b.text.destroy();
        this.bubbles.delete(sprite);
        continue;
      }
      b.remainingMs -= deltaMs;
      if (b.remainingMs <= 0) {
        b.text.destroy();
        this.bubbles.delete(sprite);
        continue;
      }
      b.text.setPosition(sprite.x, sprite.y - UNIT_HEIGHT - 6);
      if (b.remainingMs <= FADE_MS) {
        b.text.setAlpha(Math.max(0, b.remainingMs / FADE_MS));
      }
    }
  }

  clearAll(): void {
    for (const b of this.bubbles.values()) b.text.destroy();
    this.bubbles.clear();
  }
}

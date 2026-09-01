import Phaser from 'phaser';

const CONFETTI_COLORS = [
  0xc04545, 0xc4a35a, 0x3a5a9a, 0x5a7a3a, 0xd4a8a8, 0xf0e878,
];

/** Capped particle bursts for festivals, balls, and weddings. */
export class CelebrationVfx {
  private activeParticles = 0;
  private readonly maxParticles = 48;

  constructor(private readonly scene: Phaser.Scene) {}

  confettiBurst(x: number, y: number): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      if (this.activeParticles >= this.maxParticles) break;
      this.activeParticles += 1;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
      const p = this.scene.add
        .rectangle(
          x + Phaser.Math.Between(-8, 8),
          y - Phaser.Math.Between(4, 12),
          2,
          2,
          color
        )
        .setDepth(50);
      this.scene.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-20, 20),
        y: p.y + Phaser.Math.Between(12, 28),
        alpha: 0,
        duration: 600 + i * 40,
        ease: 'Quad.easeIn',
        onComplete: () => {
          p.destroy();
          this.activeParticles -= 1;
        },
      });
    }
  }

  fireworkPop(x: number, y: number): void {
    if (this.activeParticles >= this.maxParticles) return;
    const core = this.scene.add
      .circle(x, y - 20, 3, 0xfff0a0, 0.95)
      .setDepth(51);
    this.activeParticles += 1;
    this.scene.tweens.add({
      targets: core,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 420,
      onComplete: () => {
        core.destroy();
        this.activeParticles -= 1;
      },
    });
    for (let i = 0; i < 8; i++) {
      if (this.activeParticles >= this.maxParticles) break;
      this.activeParticles += 1;
      const ang = (i / 8) * Math.PI * 2;
      const spark = this.scene.add
        .rectangle(x, y - 20, 2, 2, CONFETTI_COLORS[i % CONFETTI_COLORS.length]!)
        .setDepth(50);
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(ang) * 18,
        y: y - 20 + Math.sin(ang) * 18,
        alpha: 0,
        duration: 380,
        onComplete: () => {
          spark.destroy();
          this.activeParticles -= 1;
        },
      });
    }
  }

  petalDrift(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      if (this.activeParticles >= this.maxParticles) break;
      this.activeParticles += 1;
      const petal = this.scene.add
        .rectangle(x + Phaser.Math.Between(-10, 10), y - 8, 2, 3, 0xf0a8c8)
        .setDepth(49);
      this.scene.tweens.add({
        targets: petal,
        x: petal.x + Phaser.Math.Between(-12, 12),
        y: petal.y + Phaser.Math.Between(16, 30),
        angle: Phaser.Math.Between(-30, 30),
        alpha: 0,
        duration: 900 + i * 80,
        onComplete: () => {
          petal.destroy();
          this.activeParticles -= 1;
        },
      });
    }
  }

  cheerPulse(x: number, y: number): void {
    if (this.activeParticles >= this.maxParticles) return;
    this.activeParticles += 1;
    const ring = this.scene.add
      .circle(x, y, 6, 0xffffff, 0)
      .setStrokeStyle(2, 0xfff0c0, 0.8)
      .setDepth(48);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 2,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        ring.destroy();
        this.activeParticles -= 1;
      },
    });
  }
}

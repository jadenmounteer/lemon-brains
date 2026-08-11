import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import { SiegeBalance } from './balance';

/**
 * Lightweight procedural siege / combat VFX (tweens + tiny sprites).
 */
export class SiegeVfx {
  private flames = new Map<string, Phaser.GameObjects.Image[]>();
  private projectileCount = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  startBurn(id: string, x: number, y: number): void {
    if (this.flames.has(id)) return;
    if (this.flames.size >= SiegeBalance.vfxMaxFlames) return;
    const sprites: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 2; i++) {
      const flame = this.scene.add
        .image(x + (i === 0 ? -3 : 3), y - i * 2, PROP_KEYS.flame)
        .setDepth(40)
        .setAlpha(0.9);
      sprites.push(flame);
      this.scene.tweens.add({
        targets: flame,
        y: flame.y - 4,
        alpha: { from: 0.95, to: 0.45 },
        duration: 280 + i * 60,
        yoyo: true,
        repeat: -1,
      });
    }
    const smoke = this.scene.add
      .image(x, y - 10, PROP_KEYS.smoke)
      .setDepth(39)
      .setAlpha(0.5);
    sprites.push(smoke);
    this.scene.tweens.add({
      targets: smoke,
      y: smoke.y - 18,
      alpha: 0,
      duration: 900,
      repeat: -1,
    });
    this.flames.set(id, sprites);
  }

  stopBurn(id: string): void {
    const sprites = this.flames.get(id);
    if (!sprites) return;
    for (const s of sprites) {
      this.scene.tweens.killTweensOf(s);
      s.destroy();
    }
    this.flames.delete(id);
  }

  collapse(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const ember = this.scene.add
        .image(x + Phaser.Math.Between(-6, 6), y, PROP_KEYS.flame)
        .setDepth(41)
        .setScale(0.7);
      this.scene.tweens.add({
        targets: ember,
        x: ember.x + Phaser.Math.Between(-12, 12),
        y: ember.y - Phaser.Math.Between(10, 22),
        alpha: 0,
        duration: 420,
        onComplete: () => ember.destroy(),
      });
    }
  }

  breachDust(x: number, y: number): void {
    const dust = this.scene.add
      .image(x, y, PROP_KEYS.dust)
      .setDepth(42)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: dust,
      scaleX: 1.8,
      scaleY: 1.4,
      alpha: 0,
      duration: 380,
      onComplete: () => dust.destroy(),
    });
  }

  hitFlash(
    target?: { setTint: (c: number) => unknown; clearTint: () => unknown; active?: boolean } | null
  ): void {
    if (!target || target.active === false) return;
    target.setTint(0xffffaa);
    this.scene.time.delayedCall(80, () => {
      if (target.active !== false) target.clearTint();
    });
  }

  impactShake(sprite: Phaser.GameObjects.Image): void {
    const ox = sprite.x;
    this.scene.tweens.add({
      targets: sprite,
      x: ox + 2,
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (sprite.active) sprite.setX(ox);
      },
    });
  }

  meleeLunge(
    attacker: Phaser.GameObjects.Sprite,
    tx: number,
    ty: number
  ): void {
    const ox = attacker.x;
    const oy = attacker.y;
    const dx = tx - ox;
    const dy = ty - oy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = ox + (dx / len) * 5;
    const ny = oy + (dy / len) * 5;
    this.scene.tweens.add({
      targets: attacker,
      x: nx,
      y: ny,
      duration: 70,
      yoyo: true,
    });
  }

  projectileArc(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    kind: 'arrow' | 'bolt' | 'rock',
    onHit?: () => void
  ): void {
    if (this.projectileCount >= SiegeBalance.vfxMaxProjectiles) {
      onHit?.();
      return;
    }
    this.projectileCount += 1;
    const key =
      kind === 'arrow'
        ? PROP_KEYS.arrow
        : kind === 'bolt'
          ? PROP_KEYS.bolt
          : PROP_KEYS.rock;
    const proj = this.scene.add.image(fromX, fromY, key).setDepth(45);
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2 - (kind === 'rock' ? 40 : 12);
    const duration = kind === 'rock' ? 550 : kind === 'bolt' ? 220 : 280;
    this.scene.tweens.add({
      targets: proj,
      x: midX,
      y: midY,
      duration: duration / 2,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: proj,
          x: toX,
          y: toY,
          duration: duration / 2,
          ease: 'Sine.easeIn',
          onComplete: () => {
            proj.destroy();
            this.projectileCount -= 1;
            this.breachDust(toX, toY);
            onHit?.();
          },
        });
      },
    });
  }

  engineRecoil(sprite: Phaser.GameObjects.Image, towardX: number, towardY: number): void {
    const ox = sprite.x;
    const oy = sprite.y;
    const dx = towardX - ox;
    const dy = towardY - oy;
    const len = Math.hypot(dx, dy) || 1;
    this.scene.tweens.add({
      targets: sprite,
      x: ox - (dx / len) * 4,
      y: oy - (dy / len) * 3,
      duration: 90,
      yoyo: true,
    });
  }

  clear(): void {
    for (const id of [...this.flames.keys()]) {
      this.stopBurn(id);
    }
  }
}

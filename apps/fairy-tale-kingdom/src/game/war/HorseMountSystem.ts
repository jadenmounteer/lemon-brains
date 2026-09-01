import Phaser from 'phaser';
import {
  horseGallopAnimKey,
  horseTrotAnimKey,
  PROP_KEYS,
} from '../art/assetManifest';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SiegeVfx } from '../siege/SiegeVfx';

type MountMode = 'trot' | 'gallop';

type MountRecord = {
  horse: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  mode: MountMode;
  lance: Phaser.GameObjects.Image | null;
};

/** Shared knight horse mounting for patrol, hunt, and joust. */
export class HorseMountSystem {
  private mounts = new Map<string, MountRecord>();
  private reserved = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly vfx: SiegeVfx | null = null
  ) {}

  reserve(subjectId: string): void {
    this.reserved.add(subjectId);
  }

  unreserve(subjectId: string): void {
    this.reserved.delete(subjectId);
  }

  isMounted(subjectId: string): boolean {
    return this.mounts.has(subjectId);
  }

  attach(subjectId: string, mode: MountMode = 'trot'): void {
    if (this.mounts.has(subjectId)) {
      this.setGallop(subjectId, mode === 'gallop');
      return;
    }
    if (!this.scene.textures.exists(PROP_KEYS.horse)) return;
    const m = this.subjects.getById(subjectId);
    if (!m) return;
    const horse = this.scene.add
      .sprite(m.sprite.x, m.sprite.y + 4, PROP_KEYS.horse, 0)
      .setDepth(m.sprite.depth - 1)
      .setOrigin(0.5, 0.85);
    if (this.scene.anims.exists(horseTrotAnimKey())) {
      horse.play(horseTrotAnimKey(), true);
    }
    this.mounts.set(subjectId, { horse, mode, lance: null });
    m.sprite.y -= 7;
  }

  detach(subjectId: string): void {
    const rec = this.mounts.get(subjectId);
    if (!rec) return;
    const m = this.subjects.getById(subjectId);
    if (m) m.sprite.y += 7;
    rec.lance?.destroy();
    rec.horse.destroy();
    this.mounts.delete(subjectId);
  }

  setGallop(subjectId: string, on: boolean): void {
    const rec = this.mounts.get(subjectId);
    if (!rec) return;
    rec.mode = on ? 'gallop' : 'trot';
    const key = on ? horseGallopAnimKey() : horseTrotAnimKey();
    if (rec.horse instanceof Phaser.GameObjects.Sprite && this.scene.anims.exists(key)) {
      rec.horse.play(key, true);
    }
    if (on && rec.lance) {
      rec.lance.setAngle(-20);
    } else if (rec.lance) {
      rec.lance.setAngle(0);
    }
  }

  setLance(subjectId: string, visible: boolean): void {
    const rec = this.mounts.get(subjectId);
    if (!rec) return;
    if (!visible) {
      rec.lance?.destroy();
      rec.lance = null;
      return;
    }
    if (rec.lance) return;
    if (!this.scene.textures.exists(PROP_KEYS.lance)) return;
    const m = this.subjects.getById(subjectId);
    if (!m) return;
    rec.lance = this.scene.add
      .image(m.sprite.x + 8, m.sprite.y - 10, PROP_KEYS.lance)
      .setDepth(m.sprite.depth + 1)
      .setOrigin(0.2, 0.9);
  }

  syncAll(): void {
    for (const [id, rec] of this.mounts) {
      const m = this.subjects.getById(id);
      if (!m || !m.sprite.active) {
        rec.lance?.destroy();
        rec.horse.destroy();
        this.mounts.delete(id);
        continue;
      }
      rec.horse.setPosition(m.sprite.x - 2, m.sprite.y + 4);
      rec.horse.setDepth(m.sprite.depth - 1);
      rec.horse.setFlipX(m.sprite.flipX);
      if (rec.lance) {
        const side = m.sprite.flipX ? -8 : 8;
        rec.lance.setPosition(m.sprite.x + side, m.sprite.y - 10);
        rec.lance.setDepth(m.sprite.depth + 1);
        rec.lance.setFlipX(m.sprite.flipX);
      }
    }
  }

  /** Knights on patrol or hunt get horses unless reserved for joust. */
  updateKnightMounts(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.role !== 'knight' || !s.sprite.active) continue;
      if (this.reserved.has(s.data.id)) continue;
      const shouldMount =
        s.data.activity === 'patrol' || s.data.activity === 'hunt';
      if (shouldMount) {
        const mode: MountMode =
          s.data.activity === 'hunt' || s.moving ? 'gallop' : 'trot';
        if (!this.isMounted(s.data.id)) {
          this.attach(s.data.id, mode);
        } else {
          this.setGallop(s.data.id, mode === 'gallop');
        }
      } else if (this.isMounted(s.data.id)) {
        this.detach(s.data.id);
      }
    }
    this.syncAll();
  }

  knockOff(subjectId: string): void {
    const m = this.subjects.getById(subjectId);
    if (!m) return;
    this.vfx?.breachDust(m.sprite.x, m.sprite.y);
    this.scene.tweens.add({
      targets: m.sprite,
      angle: 90,
      y: m.sprite.y + 4,
      duration: 350,
      onComplete: () => {
        if (m.sprite.active) m.sprite.setAngle(0);
      },
    });
    this.detach(subjectId);
  }
}

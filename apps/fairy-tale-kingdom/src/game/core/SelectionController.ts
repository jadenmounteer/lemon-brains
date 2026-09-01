import type Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { MonsterSystem } from '../monsters/MonsterSystem';
import type { EncampmentSystem } from '../war/EncampmentSystem';

/** Influence ring rendering when selecting keeps, camps, or monsters. */
export class SelectionController {
  private influenceGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  clearInfluence(): void {
    this.influenceGfx?.destroy();
    this.influenceGfx = null;
  }

  showBuildingInfluence(
    buildings: BuildingSystem,
    snap: ReturnType<BuildingSystem['select']>
  ): void {
    this.clearInfluence();
    if (!snap || !snap.influenceRadius) return;
    if (snap.kind !== 'keep' && snap.kind !== 'barracks' && snap.kind !== 'dungeon') {
      return;
    }
    const pt = buildings.getInfluenceOriginPoint(snap.id);
    if (!pt) return;
    const color = snap.kind === 'keep' ? 0xc4a35a : 0xb5453f;
    this.influenceGfx = this.scene.add.graphics().setDepth(6);
    this.influenceGfx.lineStyle(1, color, 0.55);
    this.influenceGfx.strokeCircle(pt.x, pt.y, snap.influenceRadius);
    this.influenceGfx.fillStyle(color, 0.06);
    this.influenceGfx.fillCircle(pt.x, pt.y, snap.influenceRadius);
  }

  showMonsterInfluence(monsters: MonsterSystem, id: string | null): void {
    this.clearInfluence();
    if (!id) return;
    const inf = monsters.getInfluence(id);
    if (!inf) return;
    const color = 0x7a4fb0;
    this.influenceGfx = this.scene.add.graphics().setDepth(6);
    this.influenceGfx.lineStyle(1, color, 0.55);
    this.influenceGfx.strokeCircle(inf.x, inf.y, inf.radius);
    this.influenceGfx.fillStyle(color, 0.06);
    this.influenceGfx.fillCircle(inf.x, inf.y, inf.radius);
  }

  showCampInfluence(encampments: EncampmentSystem, id: string | null): void {
    this.clearInfluence();
    if (!id) return;
    const camp = encampments.listCamps().find((c) => c.id === id);
    if (!camp) return;
    const radius = encampments.influenceRadius(camp.kind);
    const color = 0x8a6a3a;
    this.influenceGfx = this.scene.add.graphics().setDepth(6);
    this.influenceGfx.lineStyle(1, color, 0.55);
    this.influenceGfx.strokeCircle(camp.x, camp.y, radius);
    this.influenceGfx.fillStyle(color, 0.06);
    this.influenceGfx.fillCircle(camp.x, camp.y, radius);
  }
}

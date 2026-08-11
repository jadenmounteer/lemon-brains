import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  TerrainTile,
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type UnitRole,
} from '../art/assetManifest';

const MAP_COLS = 80;
const MAP_ROWS = 50;
const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const CAMERA_ZOOM = 2;

type DemoUnit = {
  sprite: Phaser.GameObjects.Sprite;
  role: UnitRole;
};

export class KingdomScene extends Phaser.Scene {
  private dragStart: Phaser.Math.Vector2 | null = null;
  private cameraStart: Phaser.Math.Vector2 | null = null;
  private units: DemoUnit[] = [];

  constructor() {
    super('KingdomScene');
  }

  create() {
    const mapData = buildMapData();
    const map = this.make.tilemap({
      data: mapData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(TERRAIN_KEY, TERRAIN_KEY, TILE_SIZE, TILE_SIZE)!;
    const ground = map.createLayer(0, tileset, 0, 0)!;
    ground.setDepth(0);

    this.placeProps();
    this.spawnDemoCast();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(CAMERA_ZOOM);
    cam.setRoundPixels(true);
    cam.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    this.add
      .text(12, 12, 'Drag to look around', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#e8f5e9',
        backgroundColor: '#1b3324aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.dragStart = new Phaser.Math.Vector2(pointer.x, pointer.y);
      this.cameraStart = new Phaser.Math.Vector2(cam.scrollX, cam.scrollY);
    });

    this.input.on('pointerup', () => {
      this.dragStart = null;
      this.cameraStart = null;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragStart || !this.cameraStart) {
        return;
      }
      const zoom = cam.zoom;
      const dx = (pointer.x - this.dragStart.x) / zoom;
      const dy = (pointer.y - this.dragStart.y) / zoom;
      cam.setScroll(this.cameraStart.x - dx, this.cameraStart.y - dy);
    });
  }

  private placeProps() {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;

    this.add.image(cx, cy, PROP_KEYS.keep).setDepth(10).setOrigin(0.5, 0.85);

    this.add
      .image(cx - 64, cy + 8, PROP_KEYS.house)
      .setDepth(8)
      .setOrigin(0.5, 0.85);
    this.add
      .image(cx + 72, cy + 16, PROP_KEYS.house)
      .setDepth(8)
      .setOrigin(0.5, 0.85);

    // Short wall segments near the keep
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      this.add
        .image(cx + i * 18, cy - 40, PROP_KEYS.wall)
        .setDepth(9)
        .setOrigin(0.5, 0.9);
    }
  }

  private spawnDemoCast() {
    const roles: UnitRole[] = [
      'peasant',
      'peasant',
      'guard',
      'guard',
      'archer',
      'archer',
    ];
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;

    roles.forEach((role, index) => {
      const angle = (index / roles.length) * Math.PI * 2;
      const x = cx + Math.cos(angle) * 90;
      const y = cy + Math.sin(angle) * 70 + 40;
      const sprite = this.add.sprite(x, y, role, 0);
      sprite.setDepth(20);
      sprite.setOrigin(0.5, 1);
      sprite.play(idleAnimKey(role));
      const unit: DemoUnit = { sprite, role };
      this.units.push(unit);
      this.scheduleWander(unit);
    });
  }

  private scheduleWander(unit: DemoUnit) {
    const delay = Phaser.Math.Between(400, 1800);
    this.time.delayedCall(delay, () => this.wanderOnce(unit));
  }

  private wanderOnce(unit: DemoUnit) {
    if (!unit.sprite.active) {
      return;
    }

    const range = 80;
    const targetX = Phaser.Math.Clamp(
      unit.sprite.x + Phaser.Math.Between(-range, range),
      TILE_SIZE * 4,
      WORLD_WIDTH - TILE_SIZE * 4
    );
    const targetY = Phaser.Math.Clamp(
      unit.sprite.y + Phaser.Math.Between(-range, range),
      TILE_SIZE * 4,
      WORLD_HEIGHT - TILE_SIZE * 4
    );

    const dir = facingFromDelta(targetX - unit.sprite.x, targetY - unit.sprite.y);
    unit.sprite.play(walkAnimKey(unit.role, dir), true);

    const dist = Phaser.Math.Distance.Between(
      unit.sprite.x,
      unit.sprite.y,
      targetX,
      targetY
    );
    const duration = Math.max(400, dist * 12);

    this.tweens.add({
      targets: unit.sprite,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        unit.sprite.setDepth(20 + unit.sprite.y * 0.01);
      },
      onComplete: () => {
        unit.sprite.play(idleAnimKey(unit.role));
        this.time.delayedCall(Phaser.Math.Between(600, 2200), () =>
          this.wanderOnce(unit)
        );
      },
    });
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

function buildMapData(): number[][] {
  const data: number[][] = [];
  const midCol = Math.floor(MAP_COLS / 2);
  const midRow = Math.floor(MAP_ROWS / 2);

  for (let r = 0; r < MAP_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      const onCross =
        Math.abs(c - midCol) <= 2 || Math.abs(r - midRow) <= 1;
      const nearKeep =
        Math.abs(c - midCol) <= 5 && Math.abs(r - midRow) <= 4;

      if (onCross) {
        row.push(
          Math.abs(c - midCol) === 2 || Math.abs(r - midRow) === 1
            ? TerrainTile.dirtEdge
            : TerrainTile.dirt
        );
      } else if (nearKeep) {
        row.push(TerrainTile.grassAlt);
      } else {
        row.push((r + c) % 7 === 0 ? TerrainTile.grassAlt : TerrainTile.grass);
      }
    }
    data.push(row);
  }
  return data;
}

import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  TerrainTile,
} from '../art/assetManifest';
import { KingdomEvents } from '../subjects/events';
import { SubjectSystem } from '../subjects/SubjectSystem';

const MAP_COLS = 80;
const MAP_ROWS = 50;
const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const CAMERA_ZOOM = 2;
const PAN_THRESHOLD_PX = 6;

export class KingdomScene extends Phaser.Scene {
  private dragStart: Phaser.Math.Vector2 | null = null;
  private cameraStart: Phaser.Math.Vector2 | null = null;
  private pointerMoved = false;
  private subjects!: SubjectSystem;

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
    const tileset = map.addTilesetImage(
      TERRAIN_KEY,
      TERRAIN_KEY,
      TILE_SIZE,
      TILE_SIZE
    )!;
    const ground = map.createLayer(0, tileset, 0, 0)!;
    ground.setDepth(0);

    this.placeProps();

    this.subjects = new SubjectSystem(this, {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });
    this.subjects.spawn();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(CAMERA_ZOOM);
    cam.setRoundPixels(true);
    cam.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    this.add
      .text(12, 12, 'Drag to look · click a subject', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#e8f5e9',
        backgroundColor: '#1b3324aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.pointerMoved = false;
      this.dragStart = new Phaser.Math.Vector2(pointer.x, pointer.y);
      this.cameraStart = new Phaser.Math.Vector2(cam.scrollX, cam.scrollY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragStart || !this.cameraStart) return;
      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.dragStart.x,
        this.dragStart.y
      );
      if (dist > PAN_THRESHOLD_PX) {
        this.pointerMoved = true;
      }
      if (!this.pointerMoved) return;

      const zoom = cam.zoom;
      const dx = (pointer.x - this.dragStart.x) / zoom;
      const dy = (pointer.y - this.dragStart.y) / zoom;
      cam.setScroll(this.cameraStart.x - dx, this.cameraStart.y - dy);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const wasPan = this.pointerMoved;
      const hitId = this.resolveHitSubject(pointer);
      this.dragStart = null;
      this.cameraStart = null;
      this.pointerMoved = false;

      if (wasPan) return;

      if (hitId) {
        this.publishSelection(this.subjects.select(hitId));
      } else {
        this.publishSelection(this.subjects.select(null));
      }
    });

    this.game.events.on(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);

    // Initial day tick for HUD
    this.game.events.emit(KingdomEvents.DAY_TICK, {
      dayPhase: this.subjects.clock.phase,
      hour: this.subjects.clock.hour,
    });

    // Refresh inspector activity while selected
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.subjects.getSelectedId()) return;
        const snap = this.subjects.refreshSelectedSnapshot();
        if (snap) this.publishSelection(snap);
      },
    });
  }

  update(_time: number, delta: number) {
    this.subjects?.update(delta);
  }

  shutdown() {
    this.game.events.off(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
  }

  private onClearSelection = () => {
    this.publishSelection(this.subjects.select(null));
  };

  private publishSelection(
    snap: ReturnType<SubjectSystem['select']>
  ): void {
    this.registry.set('selectedSubjectId', snap?.id ?? null);
    this.game.events.emit(KingdomEvents.SUBJECT_SELECTED, snap);
  }

  private resolveHitSubject(pointer: Phaser.Input.Pointer): string | null {
    const hits = this.input.hitTestPointer(pointer);
    for (const obj of hits) {
      const id = obj.getData('subjectId') as string | undefined;
      if (id) return id;
    }
    return null;
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

    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      this.add
        .image(cx + i * 18, cy - 40, PROP_KEYS.wall)
        .setDepth(9)
        .setOrigin(0.5, 0.9);
    }
  }
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

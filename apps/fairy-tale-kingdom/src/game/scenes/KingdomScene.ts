import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  TerrainTile,
} from '../art/assetManifest';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { LayoutRepository } from '../../kingdom/LayoutRepository';
import { RaidSystem } from '../raids/RaidSystem';
import {
  KingdomEvents,
  type BeginPlacePayload,
  type HireSubjectPayload,
} from '../subjects/events';
import { nightAlphaForHour } from '../subjects/nightAlpha';
import { SubjectSystem } from '../subjects/SubjectSystem';

const MAP_COLS = 80;
const MAP_ROWS = 50;
const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const CAMERA_ZOOM = 2;
const PAN_THRESHOLD_PX = 6;
const NIGHT_TINT = 0x0a1520;

export class KingdomScene extends Phaser.Scene {
  private dragStart: Phaser.Math.Vector2 | null = null;
  private cameraStart: Phaser.Math.Vector2 | null = null;
  private pointerMoved = false;
  private subjects!: SubjectSystem;
  private buildings!: BuildingSystem;
  private raids!: RaidSystem;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private layoutRepo = new LayoutRepository();
  private saveTimer: Phaser.Time.TimerEvent | null = null;

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
    map.createLayer(0, tileset, 0, 0)!.setDepth(0);

    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    this.add.image(cx, cy, PROP_KEYS.keep).setDepth(10).setOrigin(0.5, 0.85);

    this.subjects = new SubjectSystem(this, {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });
    this.buildings = new BuildingSystem(this, { x: cx, y: cy }, () =>
      this.subjects.unitBodies()
    );
    this.subjects.setBuildings(this.buildings);

    this.raids = new RaidSystem(
      this,
      { width: WORLD_WIDTH, height: WORLD_HEIGHT },
      { x: cx, y: cy }
    );
    this.raids.setBuildings(this.buildings);

    const saved = this.layoutRepo.loadSync();
    if (saved && saved.buildings.length > 0) {
      this.buildings.restore(saved.buildings);
      if (saved.subjects.length > 0) {
        this.subjects.restore(saved.subjects);
      } else {
        this.subjects.spawnSeed();
      }
    } else {
      this.buildings.seedStarters(WORLD_WIDTH, WORLD_HEIGHT);
      this.subjects.spawnSeed();
      this.persistLayout();
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(CAMERA_ZOOM);
    cam.setRoundPixels(true);
    cam.centerOn(cx, cy);

    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, NIGHT_TINT, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.scale.on('resize', this.onResize, this);
    this.applyNightOverlay();

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
      if (this.buildings.isPlacing()) {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        this.buildings.updateGhost(world.x, world.y);
      }

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

      if (this.buildings.isPlacing()) {
        if (this.buildings.tryCommitPlace()) {
          this.emitPlaceMode();
          this.emitStats();
          this.schedulePersist();
          this.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: 'Building placed',
          });
        } else {
          this.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: 'Cannot place on another object',
          });
        }
        return;
      }

      if (hitId) {
        this.publishSelection(this.subjects.select(hitId));
      } else {
        this.publishSelection(this.subjects.select(null));
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.buildings.isPlacing()) {
        this.buildings.cancelPlace();
        this.emitPlaceMode();
        this.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'Placement cancelled',
        });
      }
    });

    this.game.events.on(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
    this.game.events.on(KingdomEvents.HIRE_SUBJECT, this.onHire);
    this.game.events.on(KingdomEvents.BEGIN_PLACE, this.onBeginPlace);
    this.game.events.on(KingdomEvents.CANCEL_PLACE, this.onCancelPlace);

    this.game.events.emit(KingdomEvents.DAY_TICK, {
      dayPhase: this.subjects.clock.phase,
      hour: this.subjects.clock.hour,
    });
    this.emitStats();
    this.emitPlaceMode();

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
    this.raids?.update(delta);
    this.applyNightOverlay();
  }

  shutdown() {
    this.raids?.clear();
    this.scale.off('resize', this.onResize, this);
    this.game.events.off(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
    this.game.events.off(KingdomEvents.HIRE_SUBJECT, this.onHire);
    this.game.events.off(KingdomEvents.BEGIN_PLACE, this.onBeginPlace);
    this.game.events.off(KingdomEvents.CANCEL_PLACE, this.onCancelPlace);
  }

  private onHire = (payload: HireSubjectPayload) => {
    const ok = this.subjects.hire(payload.role);
    if (ok) {
      this.emitStats();
      this.schedulePersist();
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `Hired a ${payload.role}`,
      });
    }
  };

  private onBeginPlace = (payload: BeginPlacePayload) => {
    this.buildings.beginPlace(payload.kind);
    this.emitPlaceMode();
  };

  private onCancelPlace = () => {
    this.buildings.cancelPlace();
    this.emitPlaceMode();
  };

  private emitPlaceMode() {
    this.game.events.emit(KingdomEvents.PLACE_MODE_CHANGED, {
      active: this.buildings.isPlacing(),
      kind: this.buildings.placingKind(),
    });
  }

  private emitStats() {
    const population = this.subjects.count();
    const capacity = this.buildings.bedCapacity();
    this.game.events.emit(KingdomEvents.KINGDOM_STATS, {
      population,
      capacity,
      freeBeds: Math.max(0, capacity - population),
      houseCount: this.buildings.houseCount(),
      wallCount: this.buildings.wallCount(),
      tavernCount: this.buildings.tavernCount(),
    });
  }

  private schedulePersist() {
    this.saveTimer?.remove(false);
    this.saveTimer = this.time.delayedCall(400, () => this.persistLayout());
  }

  private persistLayout() {
    void this.layoutRepo.save({
      subjects: this.subjects.serialize(),
      buildings: this.buildings.serialize(),
    });
  }

  private onResize = (gameSize: Phaser.Structs.Size) => {
    this.nightOverlay?.setSize(gameSize.width, gameSize.height);
  };

  private applyNightOverlay() {
    if (!this.nightOverlay || !this.subjects) return;
    const alpha = nightAlphaForHour(this.subjects.clock.hour);
    this.nightOverlay.setFillStyle(NIGHT_TINT, alpha);
    this.nightOverlay.setVisible(alpha > 0.01);
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

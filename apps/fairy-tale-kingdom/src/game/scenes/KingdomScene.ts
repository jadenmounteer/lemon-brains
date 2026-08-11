import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  TerrainTile,
} from '../art/assetManifest';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { CombatSystem } from '../combat/CombatSystem';
import { HungerSystem } from '../economy/HungerSystem';
import {
  CaptivesRepository,
  type CaptiveRecord,
} from '../../kingdom/CaptivesRepository';
import { LayoutRepository } from '../../kingdom/LayoutRepository';
import { PathGrid } from '../path/PathGrid';
import { RaidSystem } from '../raids/RaidSystem';
import { RoyaltySystem } from '../royalty/RoyaltySystem';
import {
  KingdomEvents,
  type BeginPlacePayload,
  type HireSubjectPayload,
  type PayRansomPayload,
  type TransformPeasantPayload,
} from '../subjects/events';
import { nightAlphaForHour } from '../subjects/nightAlpha';
import { SubjectSystem } from '../subjects/SubjectSystem';
import { TaskSystem } from '../subjects/TaskSystem';

const MAP_COLS = 80;
const MAP_ROWS = 50;
const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const CAMERA_ZOOM = 2;
const PAN_THRESHOLD_PX = 6;
const NIGHT_TINT = 0x0a1520;
const PATH_TILE = 16;

export class KingdomScene extends Phaser.Scene {
  private dragStart: Phaser.Math.Vector2 | null = null;
  private cameraStart: Phaser.Math.Vector2 | null = null;
  private pointerMoved = false;
  private subjects!: SubjectSystem;
  private buildings!: BuildingSystem;
  private raids!: RaidSystem;
  private combat!: CombatSystem;
  private tasks!: TaskSystem;
  private hunger!: HungerSystem;
  private royalty!: RoyaltySystem;
  private pathGrid!: PathGrid;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private layoutRepo = new LayoutRepository();
  private captivesRepo = new CaptivesRepository();
  private captives: CaptiveRecord[] = [];
  private saveTimer: Phaser.Time.TimerEvent | null = null;
  private keepPoint = { x: 0, y: 0 };

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
    this.keepPoint = { x: cx, y: cy };
    const keepSprite = this.add
      .image(cx, cy, PROP_KEYS.keep)
      .setDepth(10)
      .setOrigin(0.5, 0.85);

    this.pathGrid = new PathGrid(WORLD_WIDTH, WORLD_HEIGHT, PATH_TILE);
    this.captives = this.captivesRepo.loadSync();

    this.subjects = new SubjectSystem(this, {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });
    this.buildings = new BuildingSystem(this, { x: cx, y: cy }, () =>
      this.subjects.unitBodies()
    , () => this.schedulePersist());
    this.buildings.setKeepSprite(keepSprite);
    this.buildings.setPathGrid(this.pathGrid);
    this.subjects.setBuildings(this.buildings);
    this.subjects.setOnChanged(() => {
      this.emitStats();
      this.schedulePersist();
    });

    this.buildings.setOnDestroyed((b) => {
      if (b.kind === 'house' || b.kind === 'manor') {
        this.subjects.onHouseDestroyed(b.id);
      }
      if (b.kind === 'wall') {
        this.subjects.dropFromWall(b.id);
      }
      if (this.registry.get('selectedBuildingId') === b.id) {
        this.publishBuildingSelection(null);
      }
      this.emitStats();
    });

    this.raids = new RaidSystem(
      this,
      { width: WORLD_WIDTH, height: WORLD_HEIGHT },
      { x: cx, y: cy }
    );
    this.raids.setBuildings(this.buildings);
    this.raids.setSubjects(this.subjects);
    this.raids.setPathGrid(this.pathGrid);
    this.raids.setOnChanged(() => this.schedulePersist());

    this.combat = new CombatSystem(
      this,
      this.subjects,
      this.buildings,
      this.raids
    );
    this.tasks = new TaskSystem(this.subjects, this.buildings);
    this.hunger = new HungerSystem(this, this.subjects);
    this.tasks.setHunger(this.hunger);
    this.royalty = new RoyaltySystem(this, this.subjects);

    const saved = this.layoutRepo.loadSync();
    if (saved && saved.buildings.length > 0) {
      this.buildings.restore(
        saved.buildings,
        saved.keepHp,
        saved.keepMaxHp
      );
      if (saved.subjects.length > 0) {
        this.subjects.restore(saved.subjects);
      } else {
        this.subjects.spawnSeed();
      }
      this.royalty.restoreTimers(saved.princeSpawnMs, saved.fgmCooldownMs);
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
      .text(12, 12, 'Drag to look · click a subject or building', {
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
            message:
              this.buildings.placingKind() === 'stairs'
                ? 'Stairs must snap to a wall'
                : 'Cannot place on another object',
          });
        }
        return;
      }

      const hit = this.resolveHit(pointer);
      if (hit?.type === 'subject') {
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishSelection(this.subjects.select(hit.id));
      } else if (hit?.type === 'building') {
        this.publishSelection(this.subjects.select(null));
        const residents = this.subjects.residentsOf(hit.id);
        this.publishBuildingSelection(this.buildings.select(hit.id, residents));
      } else {
        this.publishSelection(this.subjects.select(null));
        this.publishBuildingSelection(this.buildings.select(null));
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
    this.game.events.on(KingdomEvents.ROYAL_CAPTURED, this.onRoyalCaptured);
    this.game.events.on(KingdomEvents.PAY_RANSOM, this.onPayRansom);
    this.game.events.on(KingdomEvents.TRANSFORM_PEASANT, this.onTransform);

    this.game.events.emit(KingdomEvents.DAY_TICK, {
      dayPhase: this.subjects.clock.phase,
      hour: this.subjects.clock.hour,
    });
    this.game.events.emit(KingdomEvents.FOOD_CHANGED, {
      food: this.hunger.currentFood(),
    });
    this.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
      count: this.captives.length,
    });
    this.emitStats();
    this.emitPlaceMode();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.subjects.getSelectedId()) {
          const snap = this.subjects.refreshSelectedSnapshot();
          if (snap) this.publishSelection(snap);
        }
        if (this.buildings.getSelectedId()) {
          const id = this.buildings.getSelectedId()!;
          const residents = this.subjects.residentsOf(id);
          const snap = this.buildings.refreshSelectedSnapshot(residents);
          if (snap) this.publishBuildingSelection(snap);
          else this.publishBuildingSelection(null);
        }
      },
    });
  }

  update(_time: number, delta: number) {
    this.subjects?.update(delta);
    this.raids?.update(delta);
    this.royalty?.update(delta);
    const inspired = this.royalty?.isInspired() ?? false;
    this.subjects?.setInspired(inspired);
    this.subjects?.setFgmCanTransform(this.royalty?.fgmReady() ?? false);
    this.combat?.setInspired(inspired);
    this.tasks?.setInspired(inspired);
    this.combat?.update(delta);
    this.tasks?.update(delta, this.raids?.hasActiveRaiders() ?? false);
    this.hunger?.update();
    this.applyNightOverlay();
  }

  shutdown() {
    this.raids?.clear();
    this.scale.off('resize', this.onResize, this);
    this.game.events.off(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
    this.game.events.off(KingdomEvents.HIRE_SUBJECT, this.onHire);
    this.game.events.off(KingdomEvents.BEGIN_PLACE, this.onBeginPlace);
    this.game.events.off(KingdomEvents.CANCEL_PLACE, this.onCancelPlace);
    this.game.events.off(KingdomEvents.ROYAL_CAPTURED, this.onRoyalCaptured);
    this.game.events.off(KingdomEvents.PAY_RANSOM, this.onPayRansom);
    this.game.events.off(KingdomEvents.TRANSFORM_PEASANT, this.onTransform);
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

  private onRoyalCaptured = (payload: CaptiveRecord) => {
    this.captives.push(payload);
    this.captivesRepo.saveSync(this.captives);
    this.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
      count: this.captives.length,
    });
    this.emitStats();
    this.schedulePersist();
  };

  private onPayRansom = (payload: PayRansomPayload) => {
    const idx = this.captives.findIndex((c) => c.id === payload.id);
    if (idx < 0) return;
    const [captive] = this.captives.splice(idx, 1);
    if (!captive) return;
    this.captivesRepo.saveSync(this.captives);
    this.subjects.restoreCaptive(
      {
        id: captive.id,
        name: captive.name,
        role: captive.role,
        houseId: captive.houseId,
        hp: captive.maxHp,
        maxHp: captive.maxHp,
        hunger: 0,
        sick: false,
      },
      {
        x: this.keepPoint.x + Phaser.Math.Between(-30, 30),
        y: this.keepPoint.y + 40,
      }
    );
    this.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
      count: this.captives.length,
    });
    this.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${captive.name} has been ransomed home!`,
    });
    this.emitStats();
    this.schedulePersist();
  };

  private onTransform = (payload: TransformPeasantPayload) => {
    this.royalty.tryTransformPeasant(payload.fgmId);
    this.emitStats();
    this.schedulePersist();
    if (this.subjects.getSelectedId()) {
      const snap = this.subjects.refreshSelectedSnapshot();
      if (snap) this.publishSelection(snap);
    }
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
    let usedBeds = 0;
    for (const n of this.subjects.occupantCounts().values()) {
      usedBeds += n;
    }
    const hasKing = this.subjects.hasRole('king');
    const hasQueen = this.subjects.hasRole('queen');
    this.game.events.emit(KingdomEvents.KINGDOM_STATS, {
      population,
      capacity,
      freeBeds: Math.max(0, capacity - usedBeds),
      houseCount: this.buildings.houseCount(),
      wallCount: this.buildings.wallCount(),
      tavernCount: this.buildings.tavernCount(),
      fieldCount: this.buildings.fieldCount(),
      hasKing,
      hasQueen,
      hasPrince: this.subjects.hasRole('prince'),
      hasPrincess: this.subjects.hasRole('princess'),
      hasFairyGodmother: this.subjects.hasRole('fairy_godmother'),
      royaltyUnlocked: hasKing && hasQueen,
      inspired: this.royalty?.isInspired() ?? false,
      food: this.hunger?.currentFood() ?? 0,
      captiveCount: this.captives.length,
    });
  }

  private schedulePersist() {
    this.saveTimer?.remove(false);
    this.saveTimer = this.time.delayedCall(400, () => this.persistLayout());
  }

  private persistLayout() {
    const keep = this.buildings.serializeKeep();
    const timers = this.royalty.serializeTimers();
    void this.layoutRepo.save({
      subjects: this.subjects.serialize(),
      buildings: this.buildings.serialize(),
      keepHp: keep.keepHp,
      keepMaxHp: keep.keepMaxHp,
      princeSpawnMs: timers.princeSpawnMs,
      fgmCooldownMs: timers.fgmCooldownMs,
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
    this.publishBuildingSelection(this.buildings.select(null));
  };

  private publishSelection(
    snap: ReturnType<SubjectSystem['select']>
  ): void {
    this.registry.set('selectedSubjectId', snap?.id ?? null);
    this.game.events.emit(KingdomEvents.SUBJECT_SELECTED, snap);
  }

  private publishBuildingSelection(
    snap: ReturnType<BuildingSystem['select']>
  ): void {
    this.registry.set('selectedBuildingId', snap?.id ?? null);
    this.game.events.emit(KingdomEvents.BUILDING_SELECTED, snap);
  }

  private resolveHit(
    pointer: Phaser.Input.Pointer
  ): { type: 'subject' | 'building'; id: string } | null {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Direct body hit on a person wins; otherwise buildings use footprints
    // so houses stay clickable even when residents linger nearby.
    const subjectId = this.subjects.pickAt(world.x, world.y);
    if (subjectId) return { type: 'subject', id: subjectId };
    const buildingId = this.buildings.pickAt(world.x, world.y);
    if (buildingId) return { type: 'building', id: buildingId };
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

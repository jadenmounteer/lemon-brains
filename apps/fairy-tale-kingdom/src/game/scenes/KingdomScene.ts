import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  isTerrainBlocked,
} from '../art/assetManifest';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { CombatSystem } from '../combat/CombatSystem';
import { HungerSystem } from '../economy/HungerSystem';
import {
  CaptivesRepository,
  type CaptiveRecord,
} from '../../kingdom/CaptivesRepository';
import { LayoutRepository } from '../../kingdom/LayoutRepository';
import { MonsterSystem } from '../monsters/MonsterSystem';
import { PathGrid } from '../path/PathGrid';
import { RaidSystem } from '../raids/RaidSystem';
import { RoyaltySystem } from '../royalty/RoyaltySystem';
import { SiegeEngineSystem } from '../siege/SiegeEngineSystem';
import { SiegeVfx } from '../siege/SiegeVfx';
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
import { setWorldBiomes } from '../subjects/zones';
import {
  freshMapSeed,
  generateKingdomMap,
} from '../world/generateMap';

const MAP_COLS = 80;
const MAP_ROWS = 50;
const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const CAMERA_ZOOM = 2;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3.5;
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
  private siegeEngines!: SiegeEngineSystem;
  private siegeVfx!: SiegeVfx;
  private monsters!: MonsterSystem;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private mapData: number[][] = [];
  private mapSeed = 0;
  private caveSprites: Phaser.GameObjects.Image[] = [];
  private layoutRepo = new LayoutRepository();
  private captivesRepo = new CaptivesRepository();
  private captives: CaptiveRecord[] = [];
  private saveTimer: Phaser.Time.TimerEvent | null = null;
  private keepPoint = { x: 0, y: 0 };

  constructor() {
    super('KingdomScene');
  }

  create() {
    const saved = this.layoutRepo.loadSync();
    const seed =
      typeof saved?.mapSeed === 'number' ? saved.mapSeed : freshMapSeed();
    this.mapSeed = seed;
    const built = generateKingdomMap(MAP_COLS, MAP_ROWS, seed);
    this.mapData = built.data;
    const map = this.make.tilemap({
      data: this.mapData,
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

    setWorldBiomes({
      caves: built.caves,
      forests: built.forests,
      mountains: built.mountains,
    });
    this.caveSprites = [];
    for (const cave of built.caves) {
      const img = this.add
        .image(cave.x, cave.y, PROP_KEYS.cave)
        .setDepth(7)
        .setOrigin(0.5, 0.85);
      this.caveSprites.push(img);
    }

    this.pathGrid = new PathGrid(WORLD_WIDTH, WORLD_HEIGHT, PATH_TILE);
    this.pathGrid.applyTerrainFromMap(this.mapData, isTerrainBlocked);

    this.siegeVfx = new SiegeVfx(this);
    this.siegeEngines = new SiegeEngineSystem(this);
    this.siegeEngines.setPathGrid(this.pathGrid);
    this.siegeEngines.setVfx(this.siegeVfx);
    this.siegeEngines.setKeep({ x: cx, y: cy });
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
    this.buildings.setVfx(this.siegeVfx);
    this.subjects.setBuildings(this.buildings);
    this.subjects.setPathGrid(this.pathGrid);
    this.subjects.setOnChanged(() => {
      this.emitStats();
      this.schedulePersist();
    });
    this.siegeEngines.setBuildings(this.buildings);

    this.monsters = new MonsterSystem(this, {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });
    this.monsters.setKeep({ x: cx, y: cy });
    this.monsters.setPathGrid(this.pathGrid);
    this.monsters.setVfx(this.siegeVfx);
    this.monsters.setClock(this.subjects.clock);
    this.monsters.setOnChanged(() => this.schedulePersist());

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
    this.raids.setEngines(this.siegeEngines);
    this.raids.setVfx(this.siegeVfx);
    this.raids.setOnChanged(() => this.schedulePersist());

    this.combat = new CombatSystem(
      this,
      this.subjects,
      this.buildings,
      this.raids
    );
    this.combat.setEngines(this.siegeEngines);
    this.combat.setVfx(this.siegeVfx);
    this.combat.setMonsters(this.monsters);
    this.tasks = new TaskSystem(this.subjects, this.buildings);
    this.hunger = new HungerSystem(this, this.subjects);
    this.tasks.setHunger(this.hunger);
    this.royalty = new RoyaltySystem(this, this.subjects);

    this.monsters.setBuildings(this.buildings);
    this.monsters.setSubjects(this.subjects);

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
      if (saved.monsters && saved.monsters.length > 0) {
        this.monsters.restore(saved.monsters);
      } else {
        this.monsters.seedIfEmpty();
      }
      // Migrate older saves that lacked mapSeed
      if (typeof saved.mapSeed !== 'number') {
        this.persistLayout();
      }
    } else {
      this.buildings.seedStarters(WORLD_WIDTH, WORLD_HEIGHT);
      this.subjects.spawnSeed();
      this.monsters.seedIfEmpty();
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
      .text(12, 12, 'Drag to look · scroll to zoom · click a subject, monster, or building', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#e8f5e9',
        backgroundColor: '#1b3324aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gos: unknown,
        _dx: number,
        dy: number
      ) => {
        this.zoomAtPointer(dy);
      }
    );

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
          const kind = this.buildings.placingKind();
          this.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message:
              kind === 'stairs'
                ? 'Stairs must snap to a wall'
                : kind === 'drawbridge'
                  ? 'Drawbridge must snap into a wall gap'
                  : 'Cannot place on another object',
          });
        }
        return;
      }

      const hit = this.resolveHit(pointer);
      if (hit?.type === 'subject') {
        this.monsters.select(null);
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishSelection(this.subjects.select(hit.id));
      } else if (hit?.type === 'monster') {
        this.publishSelection(this.subjects.select(null));
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishSelection(this.monsters.select(hit.id));
      } else if (hit?.type === 'building') {
        this.monsters.select(null);
        this.publishSelection(this.subjects.select(null));
        const residents = this.subjects.residentsOf(hit.id);
        this.publishBuildingSelection(this.buildings.select(hit.id, residents));
      } else {
        this.monsters.select(null);
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
    this.game.events.on(KingdomEvents.DAY_ROLLED, this.onDayRolled);

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
        } else {
          const mSnap = this.monsters.refreshSelectedSnapshot();
          if (mSnap) this.publishSelection(mSnap);
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
    this.monsters?.update(delta);
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
    this.siegeEngines?.clear();
    this.siegeVfx?.clear();
    this.monsters?.clear();
    this.scale.off('resize', this.onResize, this);
    this.game.events.off(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
    this.game.events.off(KingdomEvents.HIRE_SUBJECT, this.onHire);
    this.game.events.off(KingdomEvents.BEGIN_PLACE, this.onBeginPlace);
    this.game.events.off(KingdomEvents.CANCEL_PLACE, this.onCancelPlace);
    this.game.events.off(KingdomEvents.ROYAL_CAPTURED, this.onRoyalCaptured);
    this.game.events.off(KingdomEvents.PAY_RANSOM, this.onPayRansom);
    this.game.events.off(KingdomEvents.TRANSFORM_PEASANT, this.onTransform);
    this.game.events.off(KingdomEvents.DAY_ROLLED, this.onDayRolled);
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
      monsters: this.monsters.serialize(),
      mapSeed: this.mapSeed,
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
    this.monsters?.select(null);
    this.publishSelection(this.subjects.select(null));
    this.publishBuildingSelection(this.buildings.select(null));
  };

  private onDayRolled = () => {
    this.monsters?.onDayRolled();
    this.schedulePersist();
  };

  private zoomAtPointer(dy: number): void {
    const cam = this.cameras.main;
    const pointer = this.input.activePointer;
    const before = cam.getWorldPoint(pointer.x, pointer.y);
    const factor = dy > 0 ? 0.9 : 1.1;
    const next = Phaser.Math.Clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    cam.setZoom(next);
    const after = cam.getWorldPoint(pointer.x, pointer.y);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

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
  ):
    | { type: 'subject' | 'building' | 'monster'; id: string }
    | null {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const subjectId = this.subjects.pickAt(world.x, world.y);
    if (subjectId) return { type: 'subject', id: subjectId };
    const monsterId = this.monsters.pickAt(world.x, world.y);
    if (monsterId) return { type: 'monster', id: monsterId };
    const buildingId = this.buildings.pickAt(world.x, world.y);
    if (buildingId) return { type: 'building', id: buildingId };
    return null;
  }
}

import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  UNIT_HEIGHT,
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
import { ThiefSystem } from '../thieves/ThiefSystem';
import { EncampmentSystem } from '../war/EncampmentSystem';
import { getSandboxRuntime } from '../sandboxRuntime';
import {
  KingdomEvents,
  type ArrestCampPayload,
  type BeginPlacePayload,
  type BeginRelocatePayload,
  type BuyNavalPayload,
  type CareerHirePayload,
  type CommandDetachmentPayload,
  type DestroyCampPayload,
  type DemolishBuildingPayload,
  type AutoGrantFamilyWishPayload,
  type GrantFamilyPayload,
  type FocusCampPayload,
  type CameraZoomPayload,
  type HireSubjectPayload,
  type PayRansomPayload,
  type SandboxSpawnPayload,
  type SetDaysPlayedPayload,
  type TrainAtBuildingPayload,
  type TransformPeasantPayload,
} from '../subjects/events';
import { nightAlphaForHour } from '../subjects/nightAlpha';
import { jobLabel } from '../jobs/capacities';
import { roleLabel } from '../subjects/schedules';
import { SubjectSystem } from '../subjects/SubjectSystem';
import { TaskSystem } from '../subjects/TaskSystem';
import { setWorldBiomes } from '../subjects/zones';
import { ThoughtSystem } from '../thoughts/ThoughtSystem';
import { FamilySystem } from '../family/FamilySystem';
import { FamilyAspirationService } from '../family/FamilyAspirationService';
import { WitchSystem } from '../witches/WitchSystem';
import { EventVenueSystem } from '../events/EventVenueSystem';
import { FestivalFunSystem } from '../events/FestivalFunSystem';
import { BallFunSystem } from '../events/BallFunSystem';
import { WeddingCeremonySystem } from '../events/WeddingCeremonySystem';
import { JoustSpectacleSystem } from '../events/JoustSpectacleSystem';
import { KeepLifeSystem } from '../keep/KeepLifeSystem';
import { JusticeSystem } from '../justice/JusticeSystem';
import { DungeonLifeSystem } from '../dungeon/DungeonLifeSystem';
import { CathedralLifeSystem } from '../cathedral/CathedralLifeSystem';
import { WorkplaceSpectacle } from '../workplace/WorkplaceSpectacle';
import { WishAutomationService } from '../career/WishAutomationService';
import { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import { SecuritySystem } from '../security/SecuritySystem';
import { MilitaryPatrolSystem } from '../security/MilitaryPatrolSystem';
import { UndeadSystem } from '../undead/UndeadSystem';
import { NavalSystem } from '../naval/NavalSystem';
import {
  freshMapSeed,
  generateKingdomMap,
} from '../world/generateMap';
import { GameWorld } from '../core/GameWorld';

const MAP_COLS = 200;
const MAP_ROWS = 128;
export const CURRENT_MAP_COLS = MAP_COLS;
export const CURRENT_MAP_ROWS = MAP_ROWS;
const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const CAMERA_ZOOM = 2;
const FOLLOW_ZOOM = 3;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3.5;
/** Sensitivity after deltaMode normalization (pixel-ish units). */
const ZOOM_SENSITIVITY = 0.0018;
/** Cap zoom change per wheel/pinch step. */
const ZOOM_MAX_STEP = 0.1;
const ZOOM_KEY_FACTOR = 1.12;
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
  private thieves!: ThiefSystem;
  private encampments!: EncampmentSystem;
  private thoughts!: ThoughtSystem;
  private family!: FamilySystem;
  private familyAspirations!: FamilyAspirationService;
  private witches!: WitchSystem;
  private venues!: EventVenueSystem;
  private justice!: JusticeSystem; // used via executeCaptive
  private bubbles!: SpeechBubbleSystem;
  private festivalFun!: FestivalFunSystem;
  private ballFun!: BallFunSystem;
  private weddingCeremony!: WeddingCeremonySystem;
  private joustSpectacle!: JoustSpectacleSystem;
  private keepLife!: KeepLifeSystem;
  private dungeonLife!: DungeonLifeSystem;
  private cathedralLife!: CathedralLifeSystem;
  private workplaceSpectacle!: WorkplaceSpectacle;
  private wishAutomation!: WishAutomationService;
  private security!: SecuritySystem;
  private militaryPatrol!: MilitaryPatrolSystem;
  private undead!: UndeadSystem;
  private naval!: NavalSystem;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private mapData: number[][] = [];
  private mapSeed = 0;
  private caveSprites: Phaser.GameObjects.Image[] = [];
  private layoutRepo = new LayoutRepository();
  private captivesRepo = new CaptivesRepository();
  private captives: CaptiveRecord[] = [];
  private world!: GameWorld;
  private keepPoint = { x: 0, y: 0 };
  private followSubjectId: string | null = null;
  private pinching = false;
  private pinchLastDist = 0;
  private juggleProps = new Map<string, Phaser.GameObjects.Image[]>();
  private jugglePhase = 0;

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

    // Align keep to map center clearing
    const pathCx =
      Math.floor(MAP_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
    const pathCy =
      Math.floor(MAP_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;
    const wallY =
      Math.round((pathCy - 28 - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE +
      TILE_SIZE / 2;
    const cx = pathCx;
    const cy = wallY + 32;
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
    , () => {
      this.subjects.rebalanceCivilianJobs();
      this.subjects.reassignLoyalties();
      this.buildings.reassignBuildingLoyalties();
      this.world.schedulePersist();
    });
    this.buildings.setKeepSprite(keepSprite);
    this.buildings.setPathGrid(this.pathGrid);
    this.buildings.setMapData(this.mapData);
    this.buildings.setVfx(this.siegeVfx);
    this.subjects.setBuildings(this.buildings);
    this.subjects.setPathGrid(this.pathGrid);
    this.subjects.setOnChanged(() => {
      this.world.emitStats();
      this.world.schedulePersist();
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
    this.monsters.setOnChanged(() => this.world.schedulePersist());
    this.subjects.setMonsters(this.monsters);

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
      this.world.emitStats();
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
    this.raids.setOnChanged(() => this.world.schedulePersist());

    this.encampments = new EncampmentSystem(
      this,
      { width: WORLD_WIDTH, height: WORLD_HEIGHT },
      { x: cx, y: cy }
    );
    this.encampments.setMapData(this.mapData);
    this.encampments.setBuildings(this.buildings);
    this.encampments.setSubjects(this.subjects);
    this.encampments.setRaids(this.raids);
    this.encampments.setPathGrid(this.pathGrid);
    this.encampments.setOnChanged(() => this.world.schedulePersist());
    this.raids.setEncampments(this.encampments);
    this.subjects.setEncampments(this.encampments);
    const initialDays =
      typeof this.registry.get('daysPlayed') === 'number'
        ? (this.registry.get('daysPlayed') as number)
        : 0;
    this.encampments.setDaysPlayed(initialDays);
    this.monsters.setDaysPlayed(initialDays);
    this.subjects.setDaysPlayed(initialDays);

    this.combat = new CombatSystem(
      this,
      this.subjects,
      this.buildings,
      this.raids
    );
    this.combat.setEngines(this.siegeEngines);
    this.combat.setVfx(this.siegeVfx);
    this.combat.setMonsters(this.monsters);
    this.combat.setEncampments(this.encampments);
    this.tasks = new TaskSystem(this.subjects, this.buildings);
    this.hunger = new HungerSystem(this, this.subjects);
    this.tasks.setHunger(this.hunger);
    this.royalty = new RoyaltySystem(this, this.subjects, this.buildings);

    this.thieves = new ThiefSystem(this, this.subjects, this.buildings);
    this.thoughts = new ThoughtSystem(this.subjects, this.buildings);
    this.familyAspirations = new FamilyAspirationService(
      this.subjects,
      this.buildings
    );
    this.family = new FamilySystem(
      this,
      this.subjects,
      this.buildings,
      this.familyAspirations
    );
    this.witches = new WitchSystem(this, this.subjects, this.encampments);
    this.venues = new EventVenueSystem(
      this,
      this.buildings,
      this.subjects,
      this.raids
    );
    this.bubbles = new SpeechBubbleSystem(this);
    this.subjects.setBubbles(this.bubbles);
    this.festivalFun = new FestivalFunSystem(this.subjects, this.bubbles);
    this.ballFun = new BallFunSystem(this, this.subjects, this.bubbles);
    this.weddingCeremony = new WeddingCeremonySystem(
      this,
      this.subjects,
      this.buildings,
      this.bubbles
    );
    this.weddingCeremony.setOnRiteComplete(() => {
      const pending = this.family.consumePendingMarriage();
      if (pending) this.family.applyMarriageHome(pending);
    });
    this.dungeonLife = new DungeonLifeSystem(this, this.subjects, this.buildings, {
      getCaptives: () => this.captives,
      addCaptive: (c) => {
        this.captives.push(c);
        this.captivesRepo.saveSync(this.captives);
        this.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
          count: this.captives.length,
        });
      },
      removeCaptive: (id) => {
        this.captives = this.captives.filter((c) => c.id !== id);
        this.captivesRepo.saveSync(this.captives);
        this.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
          count: this.captives.length,
        });
      },
    });
    this.justice = new JusticeSystem(
      this,
      this.subjects,
      this.buildings,
      this.dungeonLife
    );
    this.cathedralLife = new CathedralLifeSystem(
      this,
      this.subjects,
      this.buildings,
      this.bubbles,
      this.weddingCeremony
    );
    this.workplaceSpectacle = new WorkplaceSpectacle(this.subjects, this.buildings);
    this.wishAutomation = new WishAutomationService(
      this,
      this.subjects,
      this.buildings,
      this.family,
      {
        getGold: () => this.game.registry.get('goldBalance') as number ?? 0,
        infiniteGold: () => Boolean(this.game.registry.get('infiniteGold')),
        kingdomGameMode: () => {
          const m = this.game.registry.get('kingdomGameMode');
          return m === 'learning' ? 'learning' : 'normal';
        },
        weddingActive: () => this.weddingCeremony.isActive(),
      }
    );
    this.subjects.setFamilyEvaluator((subjectId) => {
      const gold = (this.game.registry.get('goldBalance') as number) ?? 0;
      const infiniteGold = Boolean(this.game.registry.get('infiniteGold'));
      return this.family.evaluateFor(
        subjectId,
        gold,
        infiniteGold,
        this.weddingCeremony.isActive()
      );
    });
    this.joustSpectacle = new JoustSpectacleSystem(
      this,
      this.subjects,
      this.bubbles
    );
    this.keepLife = new KeepLifeSystem(
      this.subjects,
      this.buildings,
      this.bubbles
    );
    this.security = new SecuritySystem(
      this,
      this.subjects,
      this.buildings,
      this.bubbles
    );
    this.subjects.setSecurity(this.security);
    this.militaryPatrol = new MilitaryPatrolSystem(this.subjects, this.bubbles);
    this.undead = new UndeadSystem(
      this,
      this.subjects,
      this.buildings,
      this.security
    );
    this.subjects.setOnDeath((id, houseId, name) => {
      this.undead.onSubjectDied(id, houseId, name);
      if (houseId.startsWith('camp:')) {
        this.encampments.onGarrisonMemberDied(
          houseId.slice('camp:'.length),
          id
        );
      }
    });
    this.naval = new NavalSystem(
      this,
      this.buildings,
      this.subjects,
      this.hunger
    );

    const registryMode = this.game.registry.get('kingdomGameMode');
    const kingdomGameMode =
      saved?.gameMode === 'learning' || saved?.gameMode === 'normal'
        ? saved.gameMode
        : registryMode === 'learning' || registryMode === 'normal'
          ? registryMode
          : 'normal';
    const gameDifficulty = this.game.registry.get('gameDifficulty') as
      | 'easy'
      | 'normal'
      | 'hard'
      | undefined;
    this.world = new GameWorld(
      this,
      this.layoutRepo,
      {
        subjects: this.subjects,
        buildings: this.buildings,
        monsters: this.monsters,
        encampments: this.encampments,
        royalty: this.royalty,
      },
      {
        subjects: this.subjects,
        buildings: this.buildings,
        naval: this.naval,
        justice: this.justice,
        royalty: this.royalty,
        hunger: this.hunger,
        captiveCount: () => this.captives.length,
      },
      kingdomGameMode,
      gameDifficulty
    );
    this.world.persistence.setMapMeta({
      mapSeed: this.mapSeed,
      mapCols: MAP_COLS,
      mapRows: MAP_ROWS,
      daysPlayed: initialDays,
      gameMode: kingdomGameMode,
    });

    this.world.registry.register(this.dungeonLife, 'post');
    this.world.registry.register(this.cathedralLife, 'post');
    this.world.registry.register(this.workplaceSpectacle, 'post');
    this.world.registry.register(this.wishAutomation, 'simulate');
    this.world.registry.register(this.keepLife, 'post');
    this.dungeonLife.syncCaptives();

    this.royalty.setOnFestivalStart((pick) => {
      this.festivalFun.start(pick.x, pick.y);
      this.venues.setFestivalAnchor?.(pick);
      if (pick.kind === 'joust') {
        this.venues.startJoustAt?.(pick.x, pick.y);
        this.joustSpectacle.start(pick.x, pick.y);
      } else {
        this.venues.startFestivalAt?.(pick.x, pick.y);
        this.joustSpectacle.stop();
      }
    });
    this.royalty.setOnBallStart((pt) => {
      this.ballFun.start(pt.x, pt.y);
    });
    this.royalty.setOnBallEnd(() => {
      this.ballFun.stop();
    });
    this.royalty.setOnWeddingStart((opts) =>
      this.weddingCeremony.start(opts.a, opts.b, opts.bishop, {
        x: opts.x,
        y: opts.y,
      })
    );

    this.monsters.setBuildings(this.buildings);
    this.monsters.setSubjects(this.subjects);

    const mapMismatch =
      !saved ||
      saved.mapCols !== MAP_COLS ||
      saved.mapRows !== MAP_ROWS;

    if (saved && saved.buildings.length > 0 && !mapMismatch) {
      this.buildings.restore(
        saved.buildings,
        saved.keepHp,
        saved.keepMaxHp
      );
      if (saved.subjects.length > 0) {
        this.subjects.restore(saved.subjects);
      }
      // else: sparse — no seed subjects
      if (typeof saved.clockHour === 'number') {
        this.subjects.setClockHour(saved.clockHour);
      }
      this.royalty.restoreTimers({
        princeSpawnMs: saved.princeSpawnMs,
        fgmCooldownMs: saved.fgmCooldownMs,
        ...(saved.royaltyState ?? {}),
      });
      if (this.royalty.isBallActive()) {
        const court = this.subjects.markBallGather();
        this.ballFun.start(court.x, court.y);
      }
      if (saved.monsters && saved.monsters.length > 0) {
        this.monsters.restore(saved.monsters);
      } else {
        this.monsters.seedIfEmpty();
      }
      if (saved.encampments && saved.encampments.length > 0) {
        this.encampments.restore(saved.encampments);
        this.encampments.reconcileLivingCamps();
      } else {
        this.encampments.seedStarterCamps(
          kingdomGameMode === 'learning'
            ? 0
            : getSandboxRuntime().war.starterCampCount
        );
      }
      if (typeof saved.mapSeed !== 'number') {
        this.world.persistence.persist();
      }
    } else {
      // New kingdom or map-size migrate: keep only, no units, seed camps
      this.buildings.seedStarters(WORLD_WIDTH, WORLD_HEIGHT);
      const houseIds = this.buildings.seedFamilyHomes();
      if (houseIds.length >= 2) {
        this.subjects.seedStarterFamilies(houseIds);
      }
      this.monsters.seedIfEmpty();
      this.encampments.seedStarterCamps(
        kingdomGameMode === 'learning'
          ? 0
          : getSandboxRuntime().war.starterCampCount
      );
      this.world.persistence.persist();
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
      .text(12, 12, 'Drag to look · pinch or +/− to zoom · tap a subject, monster, camp, or building', {
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
        pointer: Phaser.Input.Pointer,
        _gos: unknown,
        _dx: number,
        dy: number,
        _dz: number,
        event?: WheelEvent
      ) => {
        const raw = event?.deltaY ?? dy;
        const mode = event?.deltaMode ?? 0;
        // Normalize to pixel-ish units: LINE≈16, PAGE≈400
        const normalized =
          mode === 1 ? raw * 16 : mode === 2 ? raw * 400 : raw;
        this.zoomAtPointer(pointer.x, pointer.y, normalized);
      }
    );

    this.input.keyboard?.on('keydown-PLUS', () => {
      this.applyZoomAt(this.cameras.main.width / 2, this.cameras.main.height / 2, ZOOM_KEY_FACTOR);
    });
    this.input.keyboard?.on('keydown-EQUALS', () => {
      this.applyZoomAt(this.cameras.main.width / 2, this.cameras.main.height / 2, ZOOM_KEY_FACTOR);
    });
    this.input.keyboard?.on('keydown-MINUS', () => {
      this.applyZoomAt(this.cameras.main.width / 2, this.cameras.main.height / 2, 1 / ZOOM_KEY_FACTOR);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointerCount() >= 2) {
        this.beginPinch();
        return;
      }
      if (!pointer.leftButtonDown()) return;

      if (this.buildings.isPlacing() && this.buildings.placingKind() === 'wall') {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        this.buildings.beginWallDrag(world.x, world.y);
        this.pointerMoved = false;
        return;
      }

      this.pointerMoved = false;
      this.dragStart = new Phaser.Math.Vector2(pointer.x, pointer.y);
      this.cameraStart = new Phaser.Math.Vector2(cam.scrollX, cam.scrollY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointerCount() >= 2) {
        this.updatePinch();
        return;
      }
      if (this.pinching) return;

      if (this.buildings.isPlacing()) {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        this.buildings.updateGhost(world.x, world.y);
        if (this.buildings.placingKind() === 'wall' && this.buildings.isWallDragging()) {
          return;
        }
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
        this.clearFollowCam();
      }
      if (!this.pointerMoved) return;

      const zoom = cam.zoom;
      const dx = (pointer.x - this.dragStart.x) / zoom;
      const dy = (pointer.y - this.dragStart.y) / zoom;
      cam.setScroll(this.cameraStart.x - dx, this.cameraStart.y - dy);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.pinching) {
        if (this.activePointerCount() < 2) {
          this.pinching = false;
          this.pinchLastDist = 0;
        }
        this.dragStart = null;
        this.cameraStart = null;
        this.pointerMoved = false;
        return;
      }

      const wasPan = this.pointerMoved;
      this.dragStart = null;
      this.cameraStart = null;
      this.pointerMoved = false;

      if (wasPan) return;

      if (this.buildings.isPlacing()) {
        const wallDrag =
          this.buildings.placingKind() === 'wall' &&
          this.buildings.isWallDragging();
        if (wallDrag || !wasPan) {
          const relocating = this.buildings.isRelocating();
          const commit = this.buildings.tryCommitPlaceDetailed();
          if (commit.committed) {
            this.emitPlaceMode();
            this.world.emitStats();
            this.world.schedulePersist();
            if (commit.relocated) {
              this.game.events.emit(KingdomEvents.MARKET_TOAST, {
                message: 'Building moved',
              });
            } else if (commit.wallCells > 0) {
              this.game.events.emit(KingdomEvents.WALL_PLACED, {
                cells: commit.wallCells,
              });
            } else {
              this.game.events.emit(KingdomEvents.MARKET_TOAST, {
                message: 'Building placed',
              });
            }
          } else {
            const kind = this.buildings.placingKind();
            this.game.events.emit(KingdomEvents.MARKET_TOAST, {
              message: relocating
                ? 'Cannot move here'
                : kind === 'stairs'
                  ? 'Stairs must snap beside a wall'
                  : kind === 'drawbridge'
                    ? 'Drawbridge must snap to a wall or wall gap'
                    : kind === 'wall'
                      ? 'Cannot place wall on blocked cells'
                      : 'Cannot place on another object',
            });
          }
        }
        return;
      }

      const hit = this.resolveHit(pointer);
      if (hit?.type === 'subject') {
        this.monsters.select(null);
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishCampSelection(this.encampments.select(null));
        this.world.selection.clearInfluence();
        this.publishSelection(this.subjects.select(hit.id));
        this.beginFollowSubject(hit.id);
      } else if (hit?.type === 'monster') {
        this.clearFollowCam();
        this.publishSelection(this.subjects.select(null));
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishCampSelection(this.encampments.select(null));
        this.publishSelection(this.monsters.select(hit.id));
        this.world.selection.showMonsterInfluence(this.monsters, hit.id);
      } else if (hit?.type === 'camp') {
        this.clearFollowCam();
        this.world.selection.clearInfluence();
        this.monsters.select(null);
        this.publishSelection(this.subjects.select(null));
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishCampSelection(this.encampments.select(hit.id));
        this.world.selection.showCampInfluence(this.encampments, hit.id);
      } else if (hit?.type === 'building') {
        this.clearFollowCam();
        this.publishSelection(this.subjects.select(null));
        this.publishCampSelection(this.encampments.select(null));
        const residents = this.subjects.residentsOf(hit.id);
        const workers = this.subjects.workersOf(hit.id);
        const snap = this.buildings.select(hit.id, residents, workers);
        this.publishBuildingSelection(snap);
        this.world.selection.showBuildingInfluence(this.buildings, snap);
      } else {
        this.clearFollowCam();
        this.world.selection.clearInfluence();
        this.monsters.select(null);
        this.publishSelection(this.subjects.select(null));
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishCampSelection(this.encampments.select(null));
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.buildings.isPlacing()) {
        const relocating = this.buildings.isRelocating();
        this.buildings.cancelPlace();
        this.emitPlaceMode();
        this.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: relocating ? 'Move cancelled' : 'Placement cancelled',
        });
      } else {
        this.clearFollowCam();
        this.world.selection.clearInfluence();
        this.monsters.select(null);
        this.publishSelection(this.subjects.select(null));
        this.publishBuildingSelection(this.buildings.select(null));
        this.publishCampSelection(this.encampments.select(null));
      }
    });

    this.input.keyboard?.on('keydown-R', () => {
      if (this.buildings.isPlacing() && this.buildings.placingKind() === 'bridge') {
        this.buildings.rotatePlacement();
        const pointer = this.input.activePointer;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        this.buildings.updateGhost(world.x, world.y);
      }
    });

    this.game.events.on(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
    this.game.events.on(KingdomEvents.HIRE_SUBJECT, this.onHire);
    this.game.events.on(KingdomEvents.TRAIN_AT_BUILDING, this.onTrainAtBuilding);
    this.game.events.on(KingdomEvents.BEGIN_PLACE, this.onBeginPlace);
    this.game.events.on(KingdomEvents.CANCEL_PLACE, this.onCancelPlace);
    this.game.events.on(KingdomEvents.BEGIN_RELOCATE, this.onBeginRelocate);
    this.game.events.on(KingdomEvents.DEMOLISH_BUILDING, this.onDemolishBuilding);
    this.game.events.on(KingdomEvents.GRANT_MARRIAGE, this.onGrantMarriage);
    this.game.events.on(KingdomEvents.GRANT_CHILD, this.onGrantChild);
    this.game.events.on(
      KingdomEvents.AUTO_GRANT_FAMILY_WISH,
      this.onAutoGrantFamilyWish
    );
    this.game.events.on(KingdomEvents.ROYAL_CAPTURED, this.onRoyalCaptured);
    this.game.events.on(KingdomEvents.PAY_RANSOM, this.onPayRansom);
    this.game.events.on(KingdomEvents.TRANSFORM_PEASANT, this.onTransform);
    this.game.events.on(KingdomEvents.DAY_ROLLED, this.onDayRolled);
    this.game.events.on(KingdomEvents.COMMAND_DETACHMENT, this.onCommand);
    this.game.events.on(KingdomEvents.SET_DAYS_PLAYED, this.onSetDaysPlayed);
    this.game.events.on(KingdomEvents.CAREER_HIRE, this.onCareerHire);
    this.game.events.on(KingdomEvents.EXECUTE_CAPTIVE, this.onExecuteCaptive);
    this.game.events.on(KingdomEvents.DESTROY_CAMP, this.onDestroyCamp);
    this.game.events.on(KingdomEvents.ARREST_CAMP, this.onArrestCamp);
    this.game.events.on(KingdomEvents.FOCUS_CAMP, this.onFocusCamp);
    this.game.events.on(KingdomEvents.BUY_NAVAL, this.onBuyNaval);
    this.game.events.on(KingdomEvents.SANDBOX_SPAWN, this.onSandboxSpawn);
    this.game.events.on(KingdomEvents.CAMERA_ZOOM, this.onCameraZoom);

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
    this.world.emitStats();
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
          const workers = this.subjects.workersOf(id);
          const snap = this.buildings.refreshSelectedSnapshot(
            residents,
            workers
          );
          if (snap) this.publishBuildingSelection(snap);
          else this.publishBuildingSelection(null);
        }
        if (this.registry.get('selectedCampId')) {
          const snap = this.encampments.refreshSelectedSnapshot();
          this.publishCampSelection(snap);
        }
      },
    });
  }

  update(_time: number, delta: number) {
    this.subjects?.update(delta);
    this.monsters?.update(delta);
    this.raids?.update(delta);
    this.royalty?.update(
      delta,
      !(this.raids?.hasActiveRaiders() ?? false)
    );
    const inspired = this.royalty?.isInspired() ?? false;
    this.subjects?.setInspired(inspired);
    this.subjects?.setFgmCanTransform(this.royalty?.fgmReady() ?? false);
    this.combat?.setInspired(inspired);
    this.tasks?.setInspired(inspired);
    this.tasks?.setFestivalMult(this.royalty?.festivalHarvestMult() ?? 1);
    this.combat?.update(delta);
    this.tasks?.update(delta, this.raids?.hasActiveRaiders() ?? false);
    this.hunger?.update();
    const isNight = this.subjects?.clock.isNight() ?? false;
    this.thieves?.update(
      delta,
      isNight,
      this.raids?.hasActiveRaiders() ?? false
    );
    this.encampments?.update(delta, isNight);
    this.thoughts?.update(delta);
    this.family?.updatePlay(delta);
    this.witches?.update(delta);
    this.venues?.update(delta, {
      festivalActive: false, // Royalty + FestivalFun own festival venues
      weddingActive: false, // WeddingCeremonySystem owns the arch + stages
      peacetime: !(this.raids?.hasActiveRaiders() ?? false),
    });
    this.bubbles?.update(delta);
    this.festivalFun?.update(delta);
    if (!this.royalty?.isFestivalActive()) {
      this.festivalFun?.stop();
      this.joustSpectacle?.stop();
    }
    this.ballFun?.update(delta);
    if (!this.royalty?.isBallActive()) {
      this.ballFun?.stop();
    }
    this.weddingCeremony?.update(delta);
    this.joustSpectacle?.update(delta);
    this.joustSpectacle?.updateMountedPatrol();
    this.world.update(delta);
    this.updateJuggleProps();
    this.security?.update(delta);
    this.militaryPatrol?.update(
      delta,
      this.raids?.hasActiveRaiders() ?? false,
      this.security?.isActive() ?? false
    );
    this.undead?.update(delta, isNight);
    this.naval?.update(delta);
    if (this.raids?.hasActiveRaiders() && !this.security?.isActive()) {
      const keep = this.buildings.getActiveKeepPoint();
      this.security?.begin('raid', keep.x, keep.y, 180);
    } else if (
      !this.raids?.hasActiveRaiders() &&
      this.security?.activeKind() === 'raid'
    ) {
      this.security?.clear();
    }
    this.buildings?.updateInteriors(this.subjects.unitBodies());
    this.undead?.updateCastleInteriors(this.subjects.unitBodies());
    this.applyNightOverlay();
    this.updateFollowCam(delta);
  }

  shutdown() {
    this.raids?.clear();
    this.siegeEngines?.clear();
    this.siegeVfx?.clear();
    this.monsters?.clear();
    this.thieves?.clear();
    this.encampments?.clear();
    this.venues?.clear();
    this.festivalFun?.stop();
    this.ballFun?.stop();
    this.bubbles?.clearAll();
    this.scale.off('resize', this.onResize, this);
    this.game.events.off(KingdomEvents.CLEAR_SELECTION, this.onClearSelection);
    this.game.events.off(KingdomEvents.HIRE_SUBJECT, this.onHire);
    this.game.events.off(KingdomEvents.TRAIN_AT_BUILDING, this.onTrainAtBuilding);
    this.game.events.off(KingdomEvents.BEGIN_PLACE, this.onBeginPlace);
    this.game.events.off(KingdomEvents.CANCEL_PLACE, this.onCancelPlace);
    this.game.events.off(KingdomEvents.BEGIN_RELOCATE, this.onBeginRelocate);
    this.game.events.off(KingdomEvents.DEMOLISH_BUILDING, this.onDemolishBuilding);
    this.game.events.off(KingdomEvents.GRANT_MARRIAGE, this.onGrantMarriage);
    this.game.events.off(KingdomEvents.GRANT_CHILD, this.onGrantChild);
    this.game.events.off(
      KingdomEvents.AUTO_GRANT_FAMILY_WISH,
      this.onAutoGrantFamilyWish
    );
    this.game.events.off(KingdomEvents.ROYAL_CAPTURED, this.onRoyalCaptured);
    this.game.events.off(KingdomEvents.PAY_RANSOM, this.onPayRansom);
    this.game.events.off(KingdomEvents.TRANSFORM_PEASANT, this.onTransform);
    this.game.events.off(KingdomEvents.DAY_ROLLED, this.onDayRolled);
    this.game.events.off(KingdomEvents.COMMAND_DETACHMENT, this.onCommand);
    this.game.events.off(KingdomEvents.SET_DAYS_PLAYED, this.onSetDaysPlayed);
    this.game.events.off(KingdomEvents.CAREER_HIRE, this.onCareerHire);
    this.game.events.off(KingdomEvents.EXECUTE_CAPTIVE, this.onExecuteCaptive);
    this.game.events.off(KingdomEvents.DESTROY_CAMP, this.onDestroyCamp);
    this.game.events.off(KingdomEvents.ARREST_CAMP, this.onArrestCamp);
    this.game.events.off(KingdomEvents.FOCUS_CAMP, this.onFocusCamp);
    this.game.events.off(KingdomEvents.BUY_NAVAL, this.onBuyNaval);
    this.game.events.off(KingdomEvents.SANDBOX_SPAWN, this.onSandboxSpawn);
    this.game.events.off(KingdomEvents.CAMERA_ZOOM, this.onCameraZoom);
  }

  private onCameraZoom = (payload: CameraZoomPayload) => {
    const cam = this.cameras.main;
    const factor =
      payload.direction >= 0 ? ZOOM_KEY_FACTOR : 1 / ZOOM_KEY_FACTOR;
    this.applyZoomAt(cam.width / 2, cam.height / 2, factor);
  };

  private onSandboxSpawn = (payload: SandboxSpawnPayload) => {
    switch (payload.type) {
      case 'camp':
        this.encampments.debugSpawnCamp(payload.campKind);
        break;
      case 'monster':
        this.monsters.debugSpawn(payload.monsterKind);
        break;
      case 'undead':
        if (payload.undeadKind === 'vampire') {
          this.undead.debugSpawnVampireCastle();
        } else if (payload.undeadKind === 'necromancer') {
          this.undead.debugSpawnNecromancer();
        } else {
          this.undead.debugSpawnGhost();
        }
        break;
      case 'witch': {
        const keep = this.buildings.getActiveKeepPoint();
        const id = this.subjects.spawnWitchNear(keep.x + 80, keep.y + 40);
        this.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: id
            ? 'Sandbox: a witch appears near the keep!'
            : 'Sandbox: could not spawn a witch',
        });
        break;
      }
      case 'raid':
        this.raids.debugLaunchRaid(payload.raidKind);
        break;
      case 'unit': {
        const ok = this.subjects.hire(payload.role);
        this.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: ok
            ? `Sandbox: hired a ${payload.role}`
            : `Sandbox: could not hire ${payload.role}`,
        });
        break;
      }
    }
    this.world.emitStats();
    this.world.schedulePersist();
  };

  private onHire = (payload: HireSubjectPayload) => {
    const ok = this.subjects.hire(payload.role);
    if (ok) {
      this.world.emitStats();
      this.world.schedulePersist();
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `Hired a ${payload.role}`,
      });
    }
  };

  private onTrainAtBuilding = (payload: TrainAtBuildingPayload) => {
    const ok = this.subjects.hireAtBuilding(payload.buildingId, payload.role, {
      castleJob: payload.castleJob,
    });
    if (ok) {
      this.world.emitStats();
      this.world.schedulePersist();
      const label = payload.castleJob
        ? jobLabel(payload.castleJob)
        : roleLabel(payload.role);
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `Trained a ${label}`,
      });
    }
  };

  private onBeginPlace = (payload: BeginPlacePayload) => {
    this.buildings.beginPlace(payload.kind, payload.maxWallCells);
    this.emitPlaceMode();
  };

  private onBeginRelocate = (payload: BeginRelocatePayload) => {
    const ok = this.buildings.beginRelocate(payload.buildingId);
    if (ok) {
      this.emitPlaceMode();
    } else {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Cannot move this building',
      });
    }
  };

  private onDemolishBuilding = (payload: DemolishBuildingPayload) => {
    const result = this.buildings.demolishBuilding(payload.buildingId);
    if (result.ok) {
      this.world.emitStats();
      this.world.schedulePersist();
      this.publishBuildingSelection(null);
      this.game.events.emit(KingdomEvents.BUILDING_DEMOLISHED, {
        buildingId: payload.buildingId,
        refund: result.refund,
      });
    } else {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: result.reason ?? 'Cannot demolish',
      });
    }
  };

  private onAutoGrantFamilyWish = (payload: AutoGrantFamilyWishPayload) => {
    if (payload.kind === 'marry') {
      this.onGrantMarriage({ subjectId: payload.subjectId });
      return;
    }
    this.onGrantChild({ subjectId: payload.subjectId });
  };

  private onGrantMarriage = (payload: GrantFamilyPayload) => {
    const gold = (this.game.registry.get('goldBalance') as number) ?? 0;
    const infiniteGold = Boolean(this.game.registry.get('infiniteGold'));
    const result = this.family.tryGrantMarriage(
      payload.subjectId,
      gold,
      infiniteGold,
      this.weddingCeremony.isActive()
    );
    if (!result || 'error' in result) {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message:
          result && 'error' in result ? result.error : 'Cannot grant marriage',
      });
      return;
    }
    const bishop = this.subjects
      .listManaged()
      .find((s) => s.data.role === 'bishop');
    const cathedral = this.buildings.list().find((b) => b.kind === 'cathedral');
    if (!bishop || !cathedral) {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Need a cathedral and bishop',
      });
      return;
    }
    this.family.setPendingMarriage(result);
    const started = this.weddingCeremony.start(
      result.maleId,
      result.femaleId,
      bishop.data.id,
      { x: cathedral.x, y: cathedral.y }
    );
    if (!started) {
      this.family.setPendingMarriage(null);
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Wedding already in progress',
      });
      return;
    }
    if (result.houseCost && !infiniteGold) {
      this.game.events.emit(KingdomEvents.MARRIAGE_HOUSE_SPENT, {
        cost: result.houseCost,
      });
    }
    this.world.emitStats();
    this.world.schedulePersist();
  };

  private onGrantChild = (payload: GrantFamilyPayload) => {
    const gold = (this.game.registry.get('goldBalance') as number) ?? 0;
    const infiniteGold = Boolean(this.game.registry.get('infiniteGold'));
    const ok = this.family.tryGrantChild(
      payload.subjectId,
      gold,
      infiniteGold,
      this.weddingCeremony.isActive()
    );
    if (ok) {
      this.world.emitStats();
      this.world.schedulePersist();
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'A child is on the way!',
      });
    } else {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Cannot grant a child right now',
      });
    }
  };

  private onCancelPlace = () => {
    this.buildings.cancelPlace();
    this.emitPlaceMode();
  };

  private onBuyNaval = (payload: BuyNavalPayload) => {
    const ok =
      payload.kind === 'fishingBoat'
        ? this.naval.buyFishingBoat()
        : this.naval.buyWarship();
    if (ok) {
      this.world.emitStats();
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message:
          payload.kind === 'fishingBoat'
            ? 'A new fishing boat sets out from the dock'
            : 'A warship joins the fleet',
      });
    } else {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No dock has room for that vessel',
      });
    }
  };

  private onRoyalCaptured = (payload: CaptiveRecord) => {
    const ok = this.dungeonLife.requestIntake(payload);
    if (ok) {
      this.world.emitStats();
      this.world.schedulePersist();
    }
  };

  private onPayRansom = (payload: PayRansomPayload) => {
    const idx = this.captives.findIndex((c) => c.id === payload.id);
    if (idx < 0) return;
    const [captive] = this.captives.splice(idx, 1);
    if (!captive) return;
    this.captivesRepo.saveSync(this.captives);
    this.dungeonLife.syncCaptives();
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
    this.world.emitStats();
    this.world.schedulePersist();
  };

  private onTransform = (payload: TransformPeasantPayload) => {
    this.royalty.tryTransformPeasant(payload.fgmId);
    this.world.emitStats();
    this.world.schedulePersist();
    if (this.subjects.getSelectedId()) {
      const snap = this.subjects.refreshSelectedSnapshot();
      if (snap) this.publishSelection(snap);
    }
  };

  private emitPlaceMode() {
    this.game.events.emit(KingdomEvents.PLACE_MODE_CHANGED, {
      active: this.buildings.isPlacing(),
      kind: this.buildings.placingKind(),
      mode: this.buildings.placementMode(),
      buildingId: this.buildings.relocatingBuildingId(),
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
    this.clearFollowCam();
    this.world.selection.clearInfluence();
    this.monsters?.select(null);
    this.publishSelection(this.subjects.select(null));
    this.publishBuildingSelection(this.buildings.select(null));
    this.publishCampSelection(this.encampments?.select(null) ?? null);
  };

  private onCareerHire = (payload: CareerHirePayload) => {
    const ok = this.subjects.promoteCareer(
      payload.subjectId,
      payload.targetRole
    );
    if (ok) {
      this.world.emitStats();
      this.world.schedulePersist();
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `Career hired: ${payload.targetRole.replace(/_/g, ' ')}`,
      });
    } else {
      this.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Could not complete career hire',
      });
    }
  };

  private onExecuteCaptive = (payload: { id: string }) => {
    const captive = this.captives.find((c) => c.id === payload.id);
    if (!captive) return;
    if (this.justice.execute(captive)) {
      this.dungeonLife.syncCaptives();
      this.world.emitStats();
      this.world.schedulePersist();
    }
  };

  /** Orbiting balls above jesters while they juggle. */
  private updateJuggleProps(): void {
    this.jugglePhase += 0.12;
    const active = new Set<string>();
    for (const s of this.subjects.listManaged()) {
      if (s.data.activity !== 'juggle' || !s.sprite.active) continue;
      active.add(s.data.id);
      let balls = this.juggleProps.get(s.data.id);
      if (!balls) {
        balls = [];
        if (this.textures.exists(PROP_KEYS.juggleBall)) {
          for (let i = 0; i < 3; i++) {
            balls.push(
              this.add
                .image(s.sprite.x, s.sprite.y, PROP_KEYS.juggleBall)
                .setDepth(s.sprite.depth + 2)
                .setOrigin(0.5, 0.5)
            );
          }
        }
        this.juggleProps.set(s.data.id, balls);
      }
      balls.forEach((ball, i) => {
        const ang = this.jugglePhase + (i * Math.PI * 2) / 3;
        ball.setPosition(
          s.sprite.x + Math.cos(ang) * 10,
          s.sprite.y - 14 + Math.sin(ang * 2) * 4
        );
        ball.setDepth(s.sprite.depth + 2);
      });
    }
    for (const [id, balls] of this.juggleProps) {
      if (active.has(id)) continue;
      for (const b of balls) b.destroy();
      this.juggleProps.delete(id);
    }
  }

  private beginFollowSubject(id: string): void {
    this.followSubjectId = id;
    const managed = this.subjects.getById(id);
    if (!managed) return;
    const cam = this.cameras.main;
    cam.setZoom(FOLLOW_ZOOM);
    // Phaser scroll is not "top-left / zoom" — use startFollow so midPoint tracks the sprite.
    cam.startFollow(managed.sprite, true, 0.18, 0.18);
    cam.setFollowOffset(0, -UNIT_HEIGHT / 2);
  }

  private clearFollowCam(): void {
    if (!this.followSubjectId) return;
    this.followSubjectId = null;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setZoom(CAMERA_ZOOM);
  }

  private updateFollowCam(_deltaMs: number): void {
    if (!this.followSubjectId) return;
    const managed = this.subjects.getById(this.followSubjectId);
    if (!managed?.sprite.active) {
      this.clearFollowCam();
    }
  }

  private onDayRolled = () => {
    this.subjects?.applyBodyFromHunger();
    this.subjects?.ageOnDayRolled();
    this.familyAspirations?.onDayRolled();
    this.family?.onDayRolled();
    // Funerals for old age deaths handled via toast; cemetery funerals when present
    if (this.buildings?.hasCemetery() && Math.random() < 0.15) {
      this.venues?.startFuneral();
    }
    this.monsters?.onDayRolled();
    this.world.schedulePersist();
  };

  private onSetDaysPlayed = (payload: SetDaysPlayedPayload) => {
    const days = payload.daysPlayed;
    this.registry.set('daysPlayed', days);
    this.encampments?.setDaysPlayed(days);
    this.monsters?.setDaysPlayed(days);
    this.subjects?.setDaysPlayed(days);
  };

  private onCommand = (payload: CommandDetachmentPayload) => {
    if (payload.targetId?.startsWith('monster:')) {
      this.encampments?.commandDestroyMonster(
        payload.generalId,
        payload.troopCount,
        payload.targetId.slice('monster:'.length)
      );
    } else {
      this.encampments?.commandDestroyCamp(
        payload.generalId,
        payload.troopCount,
        payload.targetId
      );
    }
    this.world.emitStats();
  };

  private onDestroyCamp = (payload: DestroyCampPayload) => {
    this.encampments?.requestDestroy(payload.campId);
    this.world.emitStats();
  };

  private onArrestCamp = (payload: ArrestCampPayload) => {
    const result = this.encampments?.requestArrest(payload.campId);
    if (result) {
      this.dungeonLife.requestIntake(result.captive, {
        guardId: result.guardId,
        fromX: result.fromX,
        fromY: result.fromY,
      });
      this.publishCampSelection(this.encampments.refreshSelectedSnapshot());
    }
    this.world.emitStats();
  };

  private onFocusCamp = (payload: FocusCampPayload) => {
    const pt = this.encampments?.getCampPoint(payload.campId);
    if (!pt) return;
    this.clearFollowCam();
    const cam = this.cameras.main;
    cam.pan(pt.x, pt.y, 450, 'Sine.easeInOut');
    cam.zoomTo(FOLLOW_ZOOM, 450);
  };

  private activePointerCount(): number {
    let n = 0;
    for (const p of this.input.manager.pointers) {
      if (p.active && p.isDown) n += 1;
    }
    return n;
  }

  private pinchPointers(): [Phaser.Input.Pointer, Phaser.Input.Pointer] | null {
    const down: Phaser.Input.Pointer[] = [];
    for (const p of this.input.manager.pointers) {
      if (p.active && p.isDown) down.push(p);
      if (down.length === 2) return [down[0]!, down[1]!];
    }
    return null;
  }

  private beginPinch(): void {
    const pair = this.pinchPointers();
    if (!pair) return;
    this.pinching = true;
    this.pinchLastDist = Phaser.Math.Distance.Between(
      pair[0].x,
      pair[0].y,
      pair[1].x,
      pair[1].y
    );
    this.dragStart = null;
    this.cameraStart = null;
    this.pointerMoved = false;
  }

  private updatePinch(): void {
    const pair = this.pinchPointers();
    if (!pair) {
      this.pinching = false;
      return;
    }
    if (!this.pinching) this.beginPinch();
    const dist = Phaser.Math.Distance.Between(
      pair[0].x,
      pair[0].y,
      pair[1].x,
      pair[1].y
    );
    if (this.pinchLastDist > 4 && dist > 4) {
      const factor = dist / this.pinchLastDist;
      const midX = (pair[0].x + pair[1].x) / 2;
      const midY = (pair[0].y + pair[1].y) / 2;
      this.applyZoomAt(midX, midY, factor);
    }
    this.pinchLastDist = dist;
  }

  private zoomAtPointer(screenX: number, screenY: number, normalizedDy: number): void {
    if (normalizedDy === 0) return;
    let factor = Math.exp(-normalizedDy * ZOOM_SENSITIVITY);
    factor = Phaser.Math.Clamp(factor, 1 - ZOOM_MAX_STEP, 1 + ZOOM_MAX_STEP);
    this.applyZoomAt(screenX, screenY, factor);
  }

  private applyZoomAt(screenX: number, screenY: number, factor: number): void {
    const cam = this.cameras.main;
    if (this.followSubjectId) {
      this.followSubjectId = null;
      cam.stopFollow();
    }
    const clamped = Phaser.Math.Clamp(factor, 1 - ZOOM_MAX_STEP, 1 + ZOOM_MAX_STEP);
    const nextZoom = Phaser.Math.Clamp(cam.zoom * clamped, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(nextZoom - cam.zoom) < 0.0005) return;

    // Use the same getWorldPoint path as placement/selection, then refresh the
    // camera matrix so scroll correction stays under the cursor (not diagonal).
    const before = cam.getWorldPoint(screenX, screenY);
    cam.setZoom(nextZoom);
    (
      cam as Phaser.Cameras.Scene2D.Camera & {
        preRender: (resolution?: number) => void;
      }
    ).preRender();
    const after = cam.getWorldPoint(screenX, screenY);
    cam.scrollX -= after.x - before.x;
    cam.scrollY -= after.y - before.y;
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
    const keepId =
      snap && snap.kind === 'keep' ? snap.id : null;
    this.subjects.setLoyaltyHighlight(keepId);
    this.game.events.emit(KingdomEvents.BUILDING_SELECTED, snap);
  }

  private publishCampSelection(
    snap: ReturnType<EncampmentSystem['select']>
  ): void {
    this.registry.set('selectedCampId', snap?.id ?? null);
    this.game.events.emit(KingdomEvents.CAMP_SELECTED, snap);
  }

  private resolveHit(
    pointer: Phaser.Input.Pointer
  ):
    | { type: 'subject' | 'building' | 'monster' | 'camp'; id: string }
    | null {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const subjectId = this.subjects.pickAt(world.x, world.y);
    if (subjectId) return { type: 'subject', id: subjectId };
    const monsterId = this.monsters.pickAt(world.x, world.y);
    if (monsterId) return { type: 'monster', id: monsterId };
    const campId = this.encampments.pickAt(world.x, world.y);
    if (campId) return { type: 'camp', id: campId };
    const buildingId = this.buildings.pickAt(world.x, world.y);
    if (buildingId) return { type: 'building', id: buildingId };
    return null;
  }
}

import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { KEEP_ID } from '../buildings/BuildingSystem';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { ringOffset } from '../subjects/zones';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import { roomPoint } from '../keep/KeepLayout';

type Stage = 'gather' | 'aisle' | 'rite' | 'cheer' | 'banquet' | 'done';

const STAGE_MS: Record<Exclude<Stage, 'done'>, number> = {
  gather: 3500,
  aisle: 4000,
  rite: 5000,
  cheer: 3500,
  banquet: 6000,
};

const MAX_GUESTS = 8;

/**
 * Staged wedding: guests gather → aisle → bishop rite → cheer → keep banquet.
 */
export class WeddingCeremonySystem {
  private active = false;
  private stage: Stage = 'done';
  private stageMs = 0;
  private cathedral = { x: 0, y: 0 };
  private couple: { a: string; b: string; bishop: string } | null = null;
  private guestIds: string[] = [];
  private props: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly bubbles: SpeechBubbleSystem
  ) {}

  isActive(): boolean {
    return this.active;
  }

  /**
   * Begin a full ceremony. Returns false if one is already running.
   * Completes marriage flags at the end of the rite stage.
   */
  start(
    partnerA: string,
    partnerB: string,
    bishopId: string,
    cathedral: { x: number; y: number }
  ): boolean {
    if (this.active) return false;
    this.active = true;
    this.stage = 'gather';
    this.stageMs = STAGE_MS.gather;
    this.cathedral = cathedral;
    this.couple = { a: partnerA, b: partnerB, bishop: bishopId };
    this.guestIds = this.pickGuests([partnerA, partnerB, bishopId]);
    this.spawnArch(cathedral.x, cathedral.y);
    this.applyGather();
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A wedding procession gathers at the cathedral!',
    });
    return true;
  }

  update(deltaMs: number): void {
    if (!this.active || !this.couple) return;
    this.stageMs -= deltaMs;
    if (this.stageMs > 0) return;

    switch (this.stage) {
      case 'gather':
        this.stage = 'aisle';
        this.stageMs = STAGE_MS.aisle;
        this.applyAisle();
        break;
      case 'aisle':
        this.stage = 'rite';
        this.stageMs = STAGE_MS.rite;
        this.applyRite();
        break;
      case 'rite':
        this.completeMarriage();
        this.stage = 'cheer';
        this.stageMs = STAGE_MS.cheer;
        this.applyCheer();
        break;
      case 'cheer':
        this.stage = 'banquet';
        this.stageMs = STAGE_MS.banquet;
        this.applyBanquet();
        break;
      case 'banquet':
        this.finish();
        break;
      default:
        break;
    }
  }

  private pickGuests(exclude: string[]): string[] {
    const ex = new Set(exclude);
    const pool = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          !ex.has(s.data.id) &&
          s.data.allegiance !== 'camp' &&
          s.data.role !== 'zombie' &&
          s.data.role !== 'witch'
      )
      .sort((a, b) => {
        const da = Phaser.Math.Distance.Between(
          a.sprite.x,
          a.sprite.y,
          this.cathedral.x,
          this.cathedral.y
        );
        const db = Phaser.Math.Distance.Between(
          b.sprite.x,
          b.sprite.y,
          this.cathedral.x,
          this.cathedral.y
        );
        return da - db;
      });
    return pool.slice(0, MAX_GUESTS).map((s) => s.data.id);
  }

  private applyGather(): void {
    if (!this.couple) return;
    const ids = [
      this.couple.a,
      this.couple.b,
      this.couple.bishop,
      ...this.guestIds,
    ];
    ids.forEach((id, i) => {
      const m = this.subjects.getById(id);
      if (!m) return;
      m.data.activity = 'wedding';
      m.data.activityLabel =
        id === this.couple!.bishop
          ? 'Officiating a wedding'
          : id === this.couple!.a || id === this.couple!.b
            ? 'Arriving for the wedding'
            : 'Gathering for a wedding';
      const off = ringOffset(i, ids.length, 40);
      const dest = this.subjects.snapToWalkable(
        this.cathedral.x + off.x,
        this.cathedral.y + off.y
      );
      this.subjects.nudgeToward(id, dest.x, dest.y, 55);
    });
  }

  private applyAisle(): void {
    if (!this.couple) return;
    const a = this.subjects.getById(this.couple.a);
    const b = this.subjects.getById(this.couple.b);
    const bishop = this.subjects.getById(this.couple.bishop);
    if (a) {
      a.data.activityLabel = 'Walking the aisle';
      this.subjects.nudgeToward(
        a.data.id,
        this.cathedral.x - 10,
        this.cathedral.y + 8,
        40
      );
    }
    if (b) {
      b.data.activityLabel = 'Walking the aisle';
      this.subjects.nudgeToward(
        b.data.id,
        this.cathedral.x + 10,
        this.cathedral.y + 8,
        40
      );
    }
    if (bishop) {
      bishop.data.activityLabel = 'Waiting at the altar';
      this.subjects.nudgeToward(
        bishop.data.id,
        this.cathedral.x,
        this.cathedral.y - 12,
        40
      );
    }
    this.guestIds.forEach((id, i) => {
      const m = this.subjects.getById(id);
      if (!m) return;
      m.data.activityLabel = 'Watching the procession';
      const off = ringOffset(i, this.guestIds.length, 48);
      this.subjects.nudgeToward(
        id,
        this.cathedral.x + off.x,
        this.cathedral.y + 28 + off.y * 0.3,
        40
      );
    });
  }

  private applyRite(): void {
    if (!this.couple) return;
    const bishop = this.subjects.getById(this.couple.bishop);
    if (bishop) {
      bishop.data.activityLabel = 'Speaking the vows';
      this.bubbles.say(bishop.sprite, 'I now pronounce you wed!');
      bishop.data.thought = 'I now pronounce you wed!';
    }
    for (const id of [this.couple.a, this.couple.b]) {
      const m = this.subjects.getById(id);
      if (!m) continue;
      m.data.activityLabel = 'Exchanging vows';
      this.bubbles.say(m.sprite, 'I do!');
      m.data.thought = 'I do!';
    }
  }

  private applyCheer(): void {
    for (const id of this.guestIds) {
      const m = this.subjects.getById(id);
      if (!m) continue;
      m.data.activityLabel = 'Cheering the newlyweds';
      m.data.happiness = Math.min(100, m.data.happiness + 8);
      if (Math.random() < 0.5) {
        this.bubbles.say(m.sprite, 'Huzzah!');
      }
    }
    if (this.couple) {
      for (const id of [this.couple.a, this.couple.b]) {
        const m = this.subjects.getById(id);
        if (m) m.data.happiness = Math.min(100, m.data.happiness + 12);
      }
    }
  }

  private applyBanquet(): void {
    const keep = this.buildings.getById(KEEP_ID);
    if (!keep || !this.couple) return;
    const ids = [
      this.couple.a,
      this.couple.b,
      this.couple.bishop,
      ...this.guestIds.slice(0, 4),
    ];
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'The wedding feast begins in the banquet hall!',
    });
    ids.forEach((id, i) => {
      const m = this.subjects.getById(id);
      if (!m) return;
      m.data.activity = 'feast';
      m.data.activityLabel = 'Wedding feast in the banquet hall';
      m.data.zone = 'keep';
      const pt = roomPoint(keep, 'banquet', `${id}-${i}`);
      this.subjects.nudgeToward(id, pt.x, pt.y, 55);
    });
  }

  private completeMarriage(): void {
    if (!this.couple) return;
    const a = this.subjects.getById(this.couple.a);
    const b = this.subjects.getById(this.couple.b);
    if (!a || !b) return;
    a.data.married = true;
    b.data.married = true;
    a.data.spouseId = b.data.id;
    b.data.spouseId = a.data.id;
    if (b.data.role === 'princess') {
      b.data.temporaryPrincess = false;
      b.data.houseId = a.data.houseId;
    } else if (a.data.role === 'princess') {
      a.data.temporaryPrincess = false;
      a.data.houseId = b.data.houseId;
    } else {
      // Civilian: share house when possible
      b.data.houseId = a.data.houseId;
    }
    this.subjects.appendLifeLog(
      a.data.id,
      `Married ${b.data.name}`,
      'wedding'
    );
    this.subjects.appendLifeLog(
      b.data.id,
      `Married ${a.data.name}`,
      'wedding'
    );
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${a.data.name} and ${b.data.name} are wed!`,
    });
  }

  private finish(): void {
    const ids = [
      ...(this.couple
        ? [this.couple.a, this.couple.b, this.couple.bishop]
        : []),
      ...this.guestIds,
    ];
    for (const id of ids) {
      this.subjects.clearInterrupt(id);
    }
    for (const p of this.props) p.destroy();
    this.props = [];
    this.active = false;
    this.stage = 'done';
    this.couple = null;
    this.guestIds = [];
  }

  private spawnArch(x: number, y: number): void {
    if (!this.scene.textures.exists(PROP_KEYS.venueWedding)) return;
    const img = this.scene.add
      .image(x, y - 8, PROP_KEYS.venueWedding)
      .setDepth(7)
      .setOrigin(0.5, 0.85);
    this.props.push(img);
  }
}

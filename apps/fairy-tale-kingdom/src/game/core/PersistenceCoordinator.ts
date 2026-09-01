import type Phaser from 'phaser';
import type { KingdomGameMode } from './GameModeProfile';
import type { LayoutRepository } from '../../kingdom/LayoutRepository';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { MonsterSystem } from '../monsters/MonsterSystem';
import type { EncampmentSystem } from '../war/EncampmentSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { RoyaltySystem } from '../royalty/RoyaltySystem';

export interface MapPersistMeta {
  mapSeed: number;
  mapCols: number;
  mapRows: number;
  daysPlayed?: number;
  gameMode?: KingdomGameMode;
}

/** Debounced kingdom layout persistence extracted from KingdomScene. */
export class PersistenceCoordinator {
  private saveTimer: Phaser.Time.TimerEvent | null = null;
  private mapMeta: MapPersistMeta | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layoutRepo: LayoutRepository,
    private readonly deps: {
      subjects: SubjectSystem;
      buildings: BuildingSystem;
      monsters: MonsterSystem;
      encampments: EncampmentSystem;
      royalty: RoyaltySystem;
    }
  ) {}

  setMapMeta(meta: MapPersistMeta): void {
    this.mapMeta = meta;
  }

  schedule(): void {
    this.saveTimer?.remove(false);
    this.saveTimer = this.scene.time.delayedCall(400, () => this.persist());
  }

  flush(): void {
    this.saveTimer?.remove(false);
    this.saveTimer = null;
    this.persist();
  }

  cancel(): void {
    this.saveTimer?.remove(false);
    this.saveTimer = null;
  }

  persist(): void {
    const meta = this.mapMeta;
    if (!meta) return;
    const { subjects, buildings, monsters, encampments, royalty } = this.deps;
    const keep = buildings.serializeKeep();
    const timers = royalty.serializeTimers();
    void this.layoutRepo.save({
      schemaVersion: 4,
      gameMode: meta.gameMode ?? 'normal',
      subjects: subjects.serialize(),
      buildings: buildings.serialize(),
      monsters: monsters.serialize(),
      encampments: encampments.serialize(),
      mapSeed: meta.mapSeed,
      mapCols: meta.mapCols,
      mapRows: meta.mapRows,
      keepHp: keep.keepHp,
      keepMaxHp: keep.keepMaxHp,
      princeSpawnMs: timers.princeSpawnMs,
      fgmCooldownMs: timers.fgmCooldownMs,
      clockHour: subjects.getClockHour(),
      royaltyState: {
        ballRemainingMs: timers.ballRemainingMs,
        ballCooldownMs: timers.ballCooldownMs,
        festivalRemainingMs: timers.festivalRemainingMs,
        festivalCooldownMs: timers.festivalCooldownMs,
        paradeCooldownMs: timers.paradeCooldownMs,
        paradeRemainingMs: timers.paradeRemainingMs,
      },
      daysPlayedSnapshot: meta.daysPlayed,
    });
  }
}

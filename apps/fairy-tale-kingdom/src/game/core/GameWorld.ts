import type Phaser from 'phaser';
import type { LayoutRepository } from '../../kingdom/LayoutRepository';
import {
  resolveGameModeProfile,
  type GameModeProfile,
  type KingdomGameMode,
} from './GameModeProfile';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { SelectionController } from './SelectionController';
import { StatsAggregator, type StatsAggregatorDeps } from './StatsAggregator';
import { SystemRegistry } from './SystemRegistry';
import { ToastService } from './ToastService';
import { setModeRuntime } from './modeRuntime';

export type { GameModeProfile, KingdomGameMode };

/**
 * Composition root — owns cross-cutting services and phased system updates.
 * KingdomScene constructs game systems, registers them here, and delegates.
 */
export class GameWorld {
  readonly registry = new SystemRegistry();
  readonly selection: SelectionController;
  readonly toast: ToastService;
  readonly persistence: PersistenceCoordinator;
  readonly stats: StatsAggregator;

  private modeProfile: GameModeProfile;

  constructor(
    scene: Phaser.Scene,
    layoutRepo: LayoutRepository,
    persistenceDeps: ConstructorParameters<typeof PersistenceCoordinator>[2],
    statsDeps: StatsAggregatorDeps,
    kingdomMode: KingdomGameMode = 'normal',
    gameDifficulty?: Parameters<typeof resolveGameModeProfile>[0]
  ) {
    this.selection = new SelectionController(scene);
    this.toast = new ToastService(scene.game);
    this.persistence = new PersistenceCoordinator(scene, layoutRepo, persistenceDeps);
    this.stats = new StatsAggregator(scene.game, statsDeps);
    this.modeProfile = resolveGameModeProfile(gameDifficulty, kingdomMode);
    setModeRuntime(kingdomMode, gameDifficulty);
  }

  get profile(): GameModeProfile {
    return this.modeProfile;
  }

  setProfile(kingdomMode: KingdomGameMode, gameDifficulty?: Parameters<typeof resolveGameModeProfile>[0]): void {
    this.modeProfile = resolveGameModeProfile(gameDifficulty, kingdomMode);
    setModeRuntime(kingdomMode, gameDifficulty);
  }

  emitStats(): void {
    this.stats.emit();
  }

  schedulePersist(): void {
    this.persistence.schedule();
  }

  update(deltaMs: number): void {
    this.registry.tickAll(deltaMs);
  }
}

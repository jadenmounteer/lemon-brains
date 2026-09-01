import type { CaptiveRecord } from '../../kingdom/CaptivesRepository';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { DungeonLifeSystem } from '../dungeon/DungeonLifeSystem';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type Phaser from 'phaser';

/** Gallows executions by the executioner — hang VFX, no funeral mix-up. */
export class JusticeSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly dungeonLife: DungeonLifeSystem | null
  ) {}

  canExecute(): boolean {
    return (
      this.buildings.hasGallows() && this.subjects.hasRole('executioner')
    );
  }

  execute(captive: CaptiveRecord): boolean {
    if (!this.canExecute()) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Need a gallows and an executioner',
      });
      return false;
    }
    if (this.dungeonLife?.beginHang(captive)) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${captive.name} was executed at the gallows`,
      });
      return true;
    }
    return false;
  }
}

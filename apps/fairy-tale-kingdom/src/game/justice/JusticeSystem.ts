import type { CaptiveRecord } from '../../kingdom/CaptivesRepository';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { DungeonLifeSystem } from '../dungeon/DungeonLifeSystem';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type Phaser from 'phaser';

/** Gallows executions by the executioner — march + hang VFX. */
export class JusticeSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly dungeonLife: DungeonLifeSystem | null
  ) {}

  canExecute(): boolean {
    return (
      this.buildings.hasGallows() &&
      this.subjects.hasRole('executioner') &&
      (this.dungeonLife?.prisonerCount() ?? 0) > 0
    );
  }

  execute(captive: CaptiveRecord): boolean {
    if (!this.buildings.hasGallows() || !this.subjects.hasRole('executioner')) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Need a gallows and an executioner',
      });
      return false;
    }
    if ((this.dungeonLife?.prisonerCount() ?? 0) <= 0) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No prisoners to execute',
      });
      return false;
    }
    if (this.dungeonLife?.beginHang(captive.id)) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `The executioner leads ${captive.name} to the gallows`,
      });
      return true;
    }
    return false;
  }
}

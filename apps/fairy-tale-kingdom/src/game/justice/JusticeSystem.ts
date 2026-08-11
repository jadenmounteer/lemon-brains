import type { CaptiveRecord } from '../../kingdom/CaptivesRepository';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import type { EventVenueSystem } from '../events/EventVenueSystem';
import type Phaser from 'phaser';

/** Gallows executions by the executioner. */
export class JusticeSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly venues: EventVenueSystem | null,
    private readonly removeCaptive: (id: string) => void
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
    const exec = this.subjects.firstByRole('executioner');
    const gallows = this.buildings
      .serialize()
      .find((b) => b.kind === 'gallows');
    if (!exec || !gallows) return false;
    this.subjects.nudgeToward(exec.data.id, gallows.x, gallows.y, 45);
    exec.interrupt = { kind: 'execute', remainingMs: 4000 };
    this.subjects.appendLifeLog(
      exec.data.id,
      `Executed ${captive.name}`,
      'execute'
    );
    this.removeCaptive(captive.id);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${captive.name} was executed at the gallows`,
    });
    this.venues?.startFuneral(gallows.x, gallows.y);
    return true;
  }
}

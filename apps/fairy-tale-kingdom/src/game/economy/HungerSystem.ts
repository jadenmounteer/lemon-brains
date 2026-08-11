import { FoodRepository } from '../../learning/FoodRepository';
import { Phase12Balance } from './phase12Balance';
import { getSandboxRuntime } from '../sandboxRuntime';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import type Phaser from 'phaser';

/** Hourly hunger rise; meals consumed via eat interrupts. */
export class HungerSystem {
  private lastHourFloor = -1;
  private readonly foodRepo = new FoodRepository();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem
  ) {}

  currentFood(): number {
    return this.foodRepo.loadSync();
  }

  addFood(amount: number): number {
    const next = this.foodRepo.addSync(amount);
    this.emitFood(next);
    return next;
  }

  /** Consume `amount` food for a meal; returns true if fully paid. */
  tryConsumeMeal(amount: number): boolean {
    const need = Math.max(1, Math.floor(amount));
    const { eaten, left } = this.foodRepo.consumeSync(need);
    this.emitFood(left);
    return eaten >= need;
  }

  update(): void {
    const hourFloor = Math.floor(this.subjects.clock.hour);
    if (hourFloor === this.lastHourFloor) return;
    if (this.lastHourFloor < 0) {
      this.lastHourFloor = hourFloor;
      this.emitFood(this.foodRepo.loadSync());
      return;
    }
    this.lastHourFloor = hourFloor;

    const pop = this.subjects.count();
    if (pop <= 0) {
      this.emitFood(this.foodRepo.loadSync());
      return;
    }

    this.subjects.raiseHungerAll(
      Phase12Balance.hungerRisePerHour * getSandboxRuntime().sickness.hungerRise
    );
    this.subjects.tickHappiness();
    this.subjects.tryDefectMiserable();
    this.emitFood(this.foodRepo.loadSync());
  }

  private emitFood(food: number): void {
    this.scene.game.events.emit(KingdomEvents.FOOD_CHANGED, { food });
  }
}

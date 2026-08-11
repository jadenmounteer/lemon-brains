import { FoodRepository } from '../../learning/FoodRepository';
import { EconomyBalance } from './economy';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import type Phaser from 'phaser';

/** Consumes food each in-game hour; drives hunger → sick → death. */
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

    const { left } = this.foodRepo.consumeSync(pop);
    this.emitFood(left);

    if (left > 0) {
      this.subjects.recoverHunger(EconomyBalance.hungerRecoverPerHour);
    } else {
      this.subjects.applyStarvation(EconomyBalance.hungerStarvePerHour);
    }
  }

  private emitFood(food: number): void {
    this.scene.game.events.emit(KingdomEvents.FOOD_CHANGED, { food });
  }
}

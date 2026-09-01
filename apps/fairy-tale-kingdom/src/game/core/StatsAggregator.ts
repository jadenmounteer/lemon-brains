import { KingdomEvents } from '../subjects/events';
import type { IBuildingQuery } from './interfaces/IBuildingQuery';
import type { ISubjectQuery } from './interfaces/ISubjectQuery';

export interface NavalStats {
  fishingBoatCount(): number;
  fishingBoatCapacity(): number;
  warshipCount(): number;
  warshipCapacity(): number;
}

export interface JusticeStats {
  canExecute(): boolean;
}

export interface RoyaltyStats {
  isInspired(): boolean;
}

export interface HungerStats {
  currentFood(): number;
}

export interface StatsAggregatorDeps {
  subjects: ISubjectQuery;
  buildings: IBuildingQuery;
  naval?: NavalStats;
  justice?: JusticeStats;
  royalty?: RoyaltyStats;
  hunger?: HungerStats;
  captiveCount: () => number;
}

/** Builds and emits KINGDOM_STATS from narrow query interfaces. */
export class StatsAggregator {
  constructor(
    private readonly game: Phaser.Game,
    private readonly deps: StatsAggregatorDeps
  ) {}

  emit(): void {
    const { subjects, buildings } = this.deps;
    const population = subjects.count();
    const capacity = buildings.bedCapacity();
    let usedBeds = 0;
    for (const n of subjects.occupantCounts().values()) {
      usedBeds += n;
    }
    const hasKing = subjects.hasRole('king');
    const hasQueen = subjects.hasRole('queen');
    this.game.events.emit(KingdomEvents.KINGDOM_STATS, {
      population,
      capacity,
      freeBeds: Math.max(0, capacity - usedBeds),
      houseCount: buildings.houseCount(),
      wallCount: buildings.wallCount(),
      tavernCount: buildings.tavernCount(),
      fieldCount: buildings.fieldCount(),
      granaryCount: buildings.granaryCount(),
      keepCount: buildings.keepCount(),
      hasCathedral: buildings.hasCathedral(),
      hasInfirmary: buildings.hasInfirmary(),
      hasDungeon: buildings.hasDungeon(),
      hasBarracks: buildings.hasBarracks(),
      hasGallows: buildings.hasGallows(),
      hasCemetery: buildings.hasCemetery(),
      hasDock: buildings.hasDock(),
      dockCount: buildings.dockCount(),
      fishingBoatCount: this.deps.naval?.fishingBoatCount() ?? 0,
      fishingBoatCapacity: this.deps.naval?.fishingBoatCapacity() ?? 0,
      warshipCount: this.deps.naval?.warshipCount() ?? 0,
      warshipCapacity: this.deps.naval?.warshipCapacity() ?? 0,
      hasKing,
      hasQueen,
      hasPrince: subjects.hasRole('prince'),
      hasPrincess: subjects.hasRole('princess'),
      hasFairyGodmother: subjects.hasRole('fairy_godmother'),
      hasBishop: subjects.hasRole('bishop'),
      hasGeneral: subjects.hasRole('general'),
      hasExecutioner: subjects.hasRole('executioner'),
      canExecuteCaptive: this.deps.justice?.canExecute() ?? false,
      royaltyUnlocked: hasKing && hasQueen,
      inspired: this.deps.royalty?.isInspired() ?? false,
      food: this.deps.hunger?.currentFood() ?? 0,
      captiveCount: this.deps.captiveCount(),
      kingCount: subjects.countRole('king'),
      queenCount: subjects.countRole('queen'),
      fieldSlots: buildings.fieldSlots(),
      militaryAvailable: subjects.combatants().filter(
        (s) =>
          !s.interrupt &&
          (s.data.role === 'guard' ||
            s.data.role === 'archer' ||
            s.data.role === 'elite_guard' ||
            s.data.role === 'elite_archer')
      ).length,
      careerTodos: subjects.listCareerTodos(),
    });
  }
}

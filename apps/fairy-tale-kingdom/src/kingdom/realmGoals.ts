import { EconomyBalance } from '../game/economy/economy';
import type { KingdomStats } from '../game/subjects/types';
import { BUILD_CATALOG } from '../marketplace/catalog';

export type RealmGoalAction =
  | 'questions'
  | 'market'
  | 'market-granary'
  | 'market-field'
  | 'market-wall'
  | 'select-subject';

export interface RealmGoal {
  id: string;
  label: string;
  action: RealmGoalAction;
  subjectId?: string;
}

const GRANARY_COST =
  BUILD_CATALOG.find((b) => b.kind === 'granary')?.cost ?? 45;

/**
 * Highest-priority “Next for the realm” hint for the HUD strip.
 * Pure — easy to unit test.
 */
export function suggestRealmGoal(input: {
  stats: KingdomStats;
  gold: number;
  food: number;
  infiniteGold?: boolean;
}): RealmGoal | null {
  const { stats, gold, food, infiniteGold } = input;
  const canSpend = infiniteGold || gold >= GRANARY_COST;
  const foodLow =
    stats.population > 0 &&
    food < stats.population * EconomyBalance.lowFoodMult;

  if (!infiniteGold && gold < GRANARY_COST && stats.granaryCount <= 0) {
    return {
      id: 'earn-gold',
      label: 'Earn gold by answering questions',
      action: 'questions',
    };
  }

  if (stats.granaryCount <= 0) {
    return {
      id: 'build-granary',
      label: canSpend
        ? 'Build a granary to unlock fields'
        : 'Earn gold, then build a granary',
      action: canSpend ? 'market-granary' : 'questions',
    };
  }

  if (stats.fieldCount < Math.min(1, stats.fieldSlots) || stats.fieldCount === 0) {
    return {
      id: 'plant-fields',
      label: 'Plant fields for food',
      action: 'market-field',
    };
  }

  if (foodLow) {
    return {
      id: 'food-low',
      label: 'Food is low — farmers needed',
      action: 'market-field',
    };
  }

  const todo = stats.careerTodos?.[0];
  if (todo) {
    return {
      id: `career-${todo.subjectId}`,
      label: `${todo.name} wants to become a ${todo.targetLabel}`,
      action: 'select-subject',
      subjectId: todo.subjectId,
    };
  }

  if (stats.wallCount <= 0) {
    return {
      id: 'raise-walls',
      label: 'Raise walls before the next raid',
      action: 'market-wall',
    };
  }

  return null;
}

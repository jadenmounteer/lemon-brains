import { describe, expect, it, vi } from 'vitest';
import {
  EVENT_GLOBAL_GAP_BASE_MS,
  EVENT_GAP_PER_ELIGIBLE_MS,
  EventCoordinator,
  type EventCoordinatorCallbacks,
} from '../EventCoordinator';

function makeCoordinator(
  overrides: Partial<EventCoordinatorCallbacks> = {}
) {
  const toast = vi.fn();
  const clearGatherActivities = vi.fn();
  const markBallGather = vi.fn(() => ({ x: 100, y: 100 }));
  const markFestivalGather = vi.fn();
  const listEligibleFestivals = vi.fn(() => [
    { kind: 'peasant' as const, x: 50, y: 50 },
    { kind: 'market' as const, x: 60, y: 60 },
  ]);
  const callbacks = {
    listEligibleFestivals,
    hasRoyalCourt: () => true,
    markBallGather,
    markFestivalGather,
    clearGatherActivities,
    toast,
    ...overrides,
  };
  const coordinator = new EventCoordinator(callbacks);
  return { coordinator, toast, clearGatherActivities, markBallGather, markFestivalGather, listEligibleFestivals };
}

describe('EventCoordinator', () => {
  it('runs only one celebration at a time', () => {
    const { coordinator, markBallGather, markFestivalGather } = makeCoordinator();
    coordinator.restore({
      gapRemainingMs: 0,
      ballCooldownMs: 0,
      festivalCooldownMs: 0,
    });
    coordinator.tick(16, true);
    expect(coordinator.isCelebrationActive()).toBe(true);
    const first = coordinator.getActiveEvent();
    expect(first === 'ball' || first === 'festival').toBe(true);
    if (first === 'ball') {
      expect(markBallGather).toHaveBeenCalled();
      expect(markFestivalGather).not.toHaveBeenCalled();
    } else {
      expect(markFestivalGather).toHaveBeenCalled();
      expect(markBallGather).not.toHaveBeenCalled();
    }
    coordinator.tick(16, true);
    expect(coordinator.getActiveEvent()).toBe(first);
  });

  it('defers scheduling while not at peacetime', () => {
    const { coordinator, markFestivalGather } = makeCoordinator();
    coordinator.restore({
      gapRemainingMs: 0,
      ballCooldownMs: 0,
      festivalCooldownMs: 0,
    });
    coordinator.tick(16, false);
    expect(coordinator.isCelebrationActive()).toBe(false);
    expect(markFestivalGather).not.toHaveBeenCalled();
    coordinator.tick(16, true);
    expect(coordinator.isCelebrationActive()).toBe(true);
  });

  it('scales global gap with eligible festival count', () => {
    const { coordinator } = makeCoordinator();
    expect(coordinator.scaledGapMs(0)).toBe(EVENT_GLOBAL_GAP_BASE_MS);
    expect(coordinator.scaledGapMs(3)).toBe(
      EVENT_GLOBAL_GAP_BASE_MS + 3 * EVENT_GAP_PER_ELIGIBLE_MS
    );
  });

  it('pauseForThreat clears active celebration', () => {
    const { coordinator, toast, clearGatherActivities } = makeCoordinator();
    coordinator.restore({
      activeEvent: 'festival',
      eventRemainingMs: 10_000,
      activeFestivalKind: 'peasant',
    });
    coordinator.pauseForThreat();
    expect(coordinator.isCelebrationActive()).toBe(false);
    expect(toast).toHaveBeenCalledWith('The revels scatter!');
    expect(clearGatherActivities).toHaveBeenCalledWith(['ball', 'festival']);
  });
});

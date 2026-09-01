import { EconomyBalance } from '../economy/economy';
import type { FestivalKind } from './festivalRequirements';
import { toastForFestival } from './festivalRequirements';

export type CelebrationKind = 'festival' | 'ball';

export const EVENT_GLOBAL_GAP_BASE_MS = 420_000;
export const EVENT_GAP_PER_ELIGIBLE_MS = 30_000;

export type FestivalPick = { kind: FestivalKind; x: number; y: number };

export type EventCoordinatorCallbacks = {
  listEligibleFestivals: () => FestivalPick[];
  hasRoyalCourt: () => boolean;
  markBallGather: () => { x: number; y: number };
  markFestivalGather: (venue: { x: number; y: number }) => void;
  clearGatherActivities: (kinds: Array<'ball' | 'festival'>) => void;
  onBallStart?: (pt: { x: number; y: number }) => void;
  onBallEnd?: () => void;
  onFestivalStart?: (pick: FestivalPick) => void;
  toast: (message: string) => void;
};

export type EventCoordinatorState = {
  activeEvent: CelebrationKind | null;
  activeFestivalKind: FestivalKind | null;
  eventRemainingMs: number;
  gapRemainingMs: number;
  ballCooldownMs: number;
  festivalCooldownMs: number;
  deferredKind: CelebrationKind | null;
};

/**
 * One major celebration at a time, peacetime deferral, scaled cooldown between events.
 */
export class EventCoordinator {
  private activeEvent: CelebrationKind | null = null;
  private activeFestivalKind: FestivalKind | null = null;
  private eventRemainingMs = 0;
  private gapRemainingMs = EVENT_GLOBAL_GAP_BASE_MS;
  private ballCooldownMs = EconomyBalance.ballMinIntervalMs as number;
  private festivalCooldownMs = EconomyBalance.festivalMinIntervalMs as number;
  private deferredKind: CelebrationKind | null = null;
  private onBallStart: EventCoordinatorCallbacks['onBallStart'];
  private onBallEnd: EventCoordinatorCallbacks['onBallEnd'];
  private onFestivalStart: EventCoordinatorCallbacks['onFestivalStart'];

  constructor(private readonly callbacks: EventCoordinatorCallbacks) {
    this.onBallStart = callbacks.onBallStart;
    this.onBallEnd = callbacks.onBallEnd;
    this.onFestivalStart = callbacks.onFestivalStart;
  }

  setOnBallStart(cb: EventCoordinatorCallbacks['onBallStart']): void {
    this.onBallStart = cb;
  }

  setOnBallEnd(cb: EventCoordinatorCallbacks['onBallEnd']): void {
    this.onBallEnd = cb;
  }

  setOnFestivalStart(cb: EventCoordinatorCallbacks['onFestivalStart']): void {
    this.onFestivalStart = cb;
  }

  isBallActive(): boolean {
    return this.activeEvent === 'ball' && this.eventRemainingMs > 0;
  }

  isFestivalActive(): boolean {
    return this.activeEvent === 'festival' && this.eventRemainingMs > 0;
  }

  isCelebrationActive(): boolean {
    return this.eventRemainingMs > 0;
  }

  getActiveFestivalKind(): FestivalKind | null {
    return this.activeFestivalKind;
  }

  getActiveEvent(): CelebrationKind | null {
    return this.activeEvent;
  }

  serialize(): Pick<
    EventCoordinatorState,
    | 'activeEvent'
    | 'activeFestivalKind'
    | 'eventRemainingMs'
    | 'gapRemainingMs'
    | 'ballCooldownMs'
    | 'festivalCooldownMs'
    | 'deferredKind'
  > {
    return {
      activeEvent: this.activeEvent,
      activeFestivalKind: this.activeFestivalKind,
      eventRemainingMs: this.eventRemainingMs,
      gapRemainingMs: this.gapRemainingMs,
      ballCooldownMs: this.ballCooldownMs,
      festivalCooldownMs: this.festivalCooldownMs,
      deferredKind: this.deferredKind,
    };
  }

  restore(state: Partial<EventCoordinatorState>): void {
    if (state.activeEvent !== undefined) this.activeEvent = state.activeEvent;
    if (state.activeFestivalKind !== undefined) {
      this.activeFestivalKind = state.activeFestivalKind;
    }
    if (typeof state.eventRemainingMs === 'number') {
      this.eventRemainingMs = state.eventRemainingMs;
    }
    if (typeof state.gapRemainingMs === 'number') {
      this.gapRemainingMs = state.gapRemainingMs;
    }
    if (typeof state.ballCooldownMs === 'number') {
      this.ballCooldownMs = state.ballCooldownMs;
    }
    if (typeof state.festivalCooldownMs === 'number') {
      this.festivalCooldownMs = state.festivalCooldownMs;
    }
    if (state.deferredKind !== undefined) {
      this.deferredKind = state.deferredKind;
    }
  }

  /** Legacy timer fields for RoyaltySystem.serializeTimers compatibility. */
  legacyBallTimers(): { ballRemainingMs: number; ballCooldownMs: number } {
    return {
      ballRemainingMs: this.isBallActive() ? this.eventRemainingMs : 0,
      ballCooldownMs: this.ballCooldownMs,
    };
  }

  legacyFestivalTimers(): {
    festivalRemainingMs: number;
    festivalCooldownMs: number;
  } {
    return {
      festivalRemainingMs: this.isFestivalActive() ? this.eventRemainingMs : 0,
      festivalCooldownMs: this.festivalCooldownMs,
    };
  }

  restoreLegacyTimers(timers: {
    ballRemainingMs?: number;
    ballCooldownMs?: number;
    festivalRemainingMs?: number;
    festivalCooldownMs?: number;
  }): void {
    if (typeof timers.ballCooldownMs === 'number') {
      this.ballCooldownMs = timers.ballCooldownMs;
    }
    if (typeof timers.festivalCooldownMs === 'number') {
      this.festivalCooldownMs = timers.festivalCooldownMs;
    }
    if (typeof timers.ballRemainingMs === 'number' && timers.ballRemainingMs > 0) {
      this.activeEvent = 'ball';
      this.eventRemainingMs = timers.ballRemainingMs;
    } else if (
      typeof timers.festivalRemainingMs === 'number' &&
      timers.festivalRemainingMs > 0
    ) {
      this.activeEvent = 'festival';
      this.eventRemainingMs = timers.festivalRemainingMs;
    }
  }

  pauseForThreat(): void {
    if (!this.isCelebrationActive()) return;
    this.callbacks.toast('The revels scatter!');
    this.callbacks.clearGatherActivities(['ball', 'festival']);
    this.endActiveEvent(false);
  }

  tick(deltaMs: number, peacetime: boolean): void {
    if (this.eventRemainingMs > 0) {
      this.eventRemainingMs -= deltaMs;
      if (this.eventRemainingMs <= 0) {
        this.endActiveEvent(true);
      }
      return;
    }

    this.ballCooldownMs = Math.max(0, this.ballCooldownMs - deltaMs);
    this.festivalCooldownMs = Math.max(0, this.festivalCooldownMs - deltaMs);
    this.gapRemainingMs = Math.max(0, this.gapRemainingMs - deltaMs);

    if (!peacetime) {
      if (this.ballCooldownMs <= 0 || this.festivalCooldownMs <= 0) {
        this.deferredKind = this.pickNextKind();
      }
      return;
    }

    if (this.deferredKind) {
      const kind = this.deferredKind;
      this.deferredKind = null;
      if (kind === 'ball') this.tryStartBall();
      else this.tryStartFestival();
      return;
    }

    if (this.gapRemainingMs > 0) return;

    const next = this.pickNextKind();
    if (!next) return;
    if (next === 'ball') this.tryStartBall();
    else this.tryStartFestival();
  }

  scaledGapMs(eligibleCount: number): number {
    return (
      EVENT_GLOBAL_GAP_BASE_MS + eligibleCount * EVENT_GAP_PER_ELIGIBLE_MS
    );
  }

  private pickNextKind(): CelebrationKind | null {
    const ballReady =
      this.callbacks.hasRoyalCourt() && this.ballCooldownMs <= 0;
    const festivalReady = this.festivalCooldownMs <= 0;
    if (ballReady && !festivalReady) return 'ball';
    if (festivalReady && !ballReady) return 'festival';
    if (ballReady && festivalReady) {
      return Math.random() < 0.45 ? 'ball' : 'festival';
    }
    return null;
  }

  private tryStartBall(): void {
    if (!this.callbacks.hasRoyalCourt()) return;
    if (this.ballCooldownMs > 0) return;
    this.activeEvent = 'ball';
    this.eventRemainingMs = EconomyBalance.ballDurationMs;
    this.ballCooldownMs = EconomyBalance.ballMinIntervalMs;
    this.gapRemainingMs = this.scaledGapMs(1);
    this.callbacks.toast('A royal ball begins in the keep courtyard!');
    const court = this.callbacks.markBallGather();
    this.onBallStart?.(court);
  }

  private tryStartFestival(): void {
    if (this.festivalCooldownMs > 0) return;
    const eligible = this.callbacks.listEligibleFestivals();
    this.festivalCooldownMs = EconomyBalance.festivalMinIntervalMs;
    if (eligible.length === 0) {
      this.activeFestivalKind = null;
      return;
    }
    const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
    this.activeEvent = 'festival';
    this.activeFestivalKind = pick.kind;
    this.eventRemainingMs = EconomyBalance.festivalDurationMs;
    this.gapRemainingMs = this.scaledGapMs(eligible.length);
    this.callbacks.toast(toastForFestival(pick.kind));
    this.callbacks.markFestivalGather({ x: pick.x, y: pick.y });
    this.onFestivalStart?.(pick);
  }

  private endActiveEvent(notify: boolean): void {
    const ending = this.activeEvent;
    this.eventRemainingMs = 0;
    this.activeEvent = null;
    if (ending === 'festival') {
      this.activeFestivalKind = null;
      this.festivalCooldownMs = EconomyBalance.festivalMinIntervalMs;
      this.callbacks.clearGatherActivities(['festival']);
      if (notify) {
        this.callbacks.toast('The festival winds down');
      }
    } else if (ending === 'ball') {
      this.ballCooldownMs = EconomyBalance.ballMinIntervalMs;
      this.callbacks.clearGatherActivities(['ball']);
      if (notify) {
        this.callbacks.toast('The royal ball has ended');
        this.onBallEnd?.();
      }
    }
  }
}

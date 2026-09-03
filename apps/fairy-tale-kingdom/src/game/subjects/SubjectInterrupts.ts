import type { ActivityId, InterruptKind } from './types';

/** threat > duty > celebration > schedule */
export type BehaviorLayer = 'schedule' | 'celebration' | 'duty' | 'threat';

const PRIORITY: Record<BehaviorLayer, number> = {
  schedule: 0,
  celebration: 1,
  duty: 2,
  threat: 3,
};

const CELEBRATION_ACTIVITIES = new Set<ActivityId>([
  'ball',
  'festival',
  'joust',
  'wedding',
  'feast',
]);

const DUTY_ACTIVITIES = new Set<ActivityId>(['defend', 'patrol', 'repair', 'harvest']);

const THREAT_ACTIVITIES = new Set<ActivityId>(['flee']);

const DUTY_INTERRUPTS = new Set<InterruptKind>([
  'defend',
  'assault',
  'repair',
  'harvest',
  'fish',
  'crew',
]);

const THREAT_INTERRUPTS = new Set<InterruptKind>([
  'flee',
  'abducted',
  'imprisoned',
  'under_arrest',
]);

const CELEBRATION_INTERRUPTS = new Set<InterruptKind>([
  'wedding',
  'line_street',
  'spectate_hanging',
]);

export function isCelebrationActivity(activity: ActivityId): boolean {
  return CELEBRATION_ACTIVITIES.has(activity);
}

export function behaviorLayerForActivity(activity: ActivityId): BehaviorLayer {
  if (THREAT_ACTIVITIES.has(activity)) return 'threat';
  if (DUTY_ACTIVITIES.has(activity)) return 'duty';
  if (CELEBRATION_ACTIVITIES.has(activity)) return 'celebration';
  return 'schedule';
}

export function behaviorLayerForInterrupt(kind: InterruptKind): BehaviorLayer {
  if (THREAT_INTERRUPTS.has(kind)) return 'threat';
  if (DUTY_INTERRUPTS.has(kind)) return 'duty';
  if (kind === 'eat') return 'schedule';
  if (CELEBRATION_INTERRUPTS.has(kind)) return 'celebration';
  return 'schedule';
}

/** True when `incoming` may replace `current` (higher priority wins). */
export function canPreempt(
  current: BehaviorLayer | null,
  incoming: BehaviorLayer
): boolean {
  const cur = current ?? 'schedule';
  return PRIORITY[incoming] > PRIORITY[cur];
}

export function currentLayer(opts: {
  activity: ActivityId;
  interruptKind?: InterruptKind | null;
}): BehaviorLayer {
  const fromInterrupt = opts.interruptKind
    ? behaviorLayerForInterrupt(opts.interruptKind)
    : null;
  const fromActivity = behaviorLayerForActivity(opts.activity);
  if (!fromInterrupt) return fromActivity;
  return PRIORITY[fromInterrupt] >= PRIORITY[fromActivity]
    ? fromInterrupt
    : fromActivity;
}

/** Meals and schedule sync must not pull guests off a celebration. */
export function blocksMealInterrupt(activity: ActivityId): boolean {
  return isCelebrationActivity(activity);
}

/** Flee/defend should not yank distant celebration guests unless threat is very close. */
export function shouldSkipFleeForCelebration(
  activity: ActivityId,
  raiderDistance: number,
  fleeRadius: number
): boolean {
  if (!isCelebrationActivity(activity)) return false;
  return raiderDistance > fleeRadius;
}

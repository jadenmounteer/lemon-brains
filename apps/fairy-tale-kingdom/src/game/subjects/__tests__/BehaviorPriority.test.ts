import { describe, expect, it } from 'vitest';
import {
  behaviorLayerForActivity,
  behaviorLayerForInterrupt,
  blocksMealInterrupt,
  canPreempt,
  currentLayer,
  shouldSkipFleeForCelebration,
} from '../SubjectInterrupts';

describe('BehaviorPriority', () => {
  it('orders threat > duty > celebration > schedule', () => {
    expect(canPreempt('celebration', 'threat')).toBe(true);
    expect(canPreempt('celebration', 'duty')).toBe(true);
    expect(canPreempt('schedule', 'celebration')).toBe(true);
    expect(canPreempt('celebration', 'schedule')).toBe(false);
    expect(canPreempt('threat', 'duty')).toBe(false);
  });

  it('maps activities to layers', () => {
    expect(behaviorLayerForActivity('festival')).toBe('celebration');
    expect(behaviorLayerForActivity('defend')).toBe('duty');
    expect(behaviorLayerForActivity('flee')).toBe('threat');
    expect(behaviorLayerForActivity('work')).toBe('schedule');
  });

  it('maps interrupts to layers', () => {
    expect(behaviorLayerForInterrupt('flee')).toBe('threat');
    expect(behaviorLayerForInterrupt('defend')).toBe('duty');
    expect(behaviorLayerForInterrupt('eat')).toBe('schedule');
    expect(behaviorLayerForInterrupt('wedding')).toBe('celebration');
  });

  it('picks the higher layer when activity and interrupt disagree', () => {
    expect(
      currentLayer({ activity: 'festival', interruptKind: 'flee' })
    ).toBe('threat');
    expect(
      currentLayer({ activity: 'work', interruptKind: 'harvest' })
    ).toBe('duty');
  });

  it('blocks meals during celebrations', () => {
    expect(blocksMealInterrupt('ball')).toBe(true);
    expect(blocksMealInterrupt('festival')).toBe(true);
    expect(blocksMealInterrupt('work')).toBe(false);
  });

  it('skips flee for distant celebration guests', () => {
    expect(shouldSkipFleeForCelebration('festival', 200, 80)).toBe(true);
    expect(shouldSkipFleeForCelebration('festival', 40, 80)).toBe(false);
    expect(shouldSkipFleeForCelebration('work', 200, 80)).toBe(false);
  });
});

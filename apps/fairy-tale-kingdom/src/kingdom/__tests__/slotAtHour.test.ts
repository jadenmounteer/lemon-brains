import { describe, expect, it } from 'vitest';
import { slotAtHour } from '../../game/subjects/schedules';

describe('slotAtHour', () => {
  it('returns sleep slot at midnight for peasants', () => {
    const slot = slotAtHour('peasant', 2);
    expect(slot.activity).toBe('sleep');
    expect(slot.zone).toBe('home');
  });

  it('returns work slot mid-morning for peasants', () => {
    const slot = slotAtHour('peasant', 9);
    expect(slot.activity).toBe('work');
  });

  it('wraps hours outside 0–23', () => {
    const a = slotAtHour('guard', 25);
    const b = slotAtHour('guard', 1);
    expect(a.activity).toBe(b.activity);
  });
});

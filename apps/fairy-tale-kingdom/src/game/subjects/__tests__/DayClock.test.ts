import { describe, expect, it } from 'vitest';
import { DayClock } from '../DayClock';

describe('DayClock.isNight', () => {
  it('is false during morning and afternoon', () => {
    const clock = new DayClock();
    clock.setHour(8);
    expect(clock.isNight()).toBe(false);
    expect(clock.phase).toBe('Morning');
    clock.setHour(14);
    expect(clock.isNight()).toBe(false);
  });

  it('is false during evening before 21:00', () => {
    const clock = new DayClock();
    clock.setHour(19);
    expect(clock.phase).toBe('Evening');
    expect(clock.isNight()).toBe(false);
  });

  it('is true from 21:00 through before 05:00', () => {
    const clock = new DayClock();
    clock.setHour(22);
    expect(clock.isNight()).toBe(true);
    expect(clock.phase).toBe('Night');
    clock.setHour(3);
    expect(clock.isNight()).toBe(true);
  });

  it('matches phase Night boundary', () => {
    const clock = new DayClock();
    for (const h of [21, 23, 0, 4]) {
      clock.setHour(h);
      expect(clock.isNight()).toBe(clock.phase === 'Night');
    }
  });
});

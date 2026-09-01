import { describe, expect, it } from 'vitest';
import { computeEarlyPressureFactor } from '../../war/computeEarlyPressure';

describe('computeEarlyPressureFactor', () => {
  it('returns 0 when intensity or raid pressure is 0', () => {
    expect(computeEarlyPressureFactor(5, 20, 0, 1)).toBe(0);
    expect(computeEarlyPressureFactor(5, 20, 1, 0)).toBe(0);
  });

  it('ramps early days before day 8', () => {
    expect(computeEarlyPressureFactor(0, 0, 1, 1)).toBeCloseTo(0.12);
    expect(computeEarlyPressureFactor(7, 5, 1, 1)).toBeCloseTo(0.68);
  });

  it('reaches full pressure at day 8+ and pop 12+', () => {
    expect(computeEarlyPressureFactor(8, 12, 1, 1)).toBe(1);
    expect(computeEarlyPressureFactor(20, 30, 1, 1)).toBe(1);
  });

  it('scales by sandbox multipliers', () => {
    expect(computeEarlyPressureFactor(8, 12, 0.5, 1,)).toBe(0.5);
  });
});

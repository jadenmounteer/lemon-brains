import { describe, expect, it } from 'vitest';
import {
  buildingRefundCost,
  isMovableKind,
} from '../buildingManagement';

describe('buildingManagement', () => {
  it('isMovableKind allows standard buildings', () => {
    expect(isMovableKind('house')).toBe(true);
    expect(isMovableKind('bakery')).toBe(true);
    expect(isMovableKind('bridge')).toBe(true);
  });

  it('isMovableKind blocks fort pieces and keep', () => {
    expect(isMovableKind('keep')).toBe(false);
    expect(isMovableKind('wall')).toBe(false);
    expect(isMovableKind('ladder')).toBe(false);
    expect(isMovableKind('drawbridge')).toBe(false);
  });

  it('buildingRefundCost returns catalog cost', () => {
    expect(buildingRefundCost('house')).toBe(30);
    expect(buildingRefundCost('bakery')).toBe(40);
  });

  it('buildingRefundCost returns per-cell wall cost', () => {
    expect(buildingRefundCost('wall')).toBe(3);
  });
});

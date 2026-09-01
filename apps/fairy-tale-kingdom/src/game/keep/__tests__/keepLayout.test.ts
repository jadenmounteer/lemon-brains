import { describe, expect, it } from 'vitest';
import { KEEP_FOOTPRINT, keepAnchorBounds } from '../KeepLayout';

describe('KeepLayout', () => {
  it('room anchors fit inside 320×240 footprint', () => {
    const bounds = keepAnchorBounds();
    const halfW = KEEP_FOOTPRINT.w / 2;
    const halfH = KEEP_FOOTPRINT.h / 2;
    expect(Math.abs(bounds.minX)).toBeLessThan(halfW);
    expect(Math.abs(bounds.maxX)).toBeLessThan(halfW);
    expect(Math.abs(bounds.minY)).toBeLessThan(halfH);
    expect(Math.abs(bounds.maxY)).toBeLessThan(halfH);
  });
});

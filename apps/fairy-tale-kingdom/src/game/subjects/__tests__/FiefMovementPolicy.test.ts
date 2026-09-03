import { describe, expect, it } from 'vitest';
import type { BuildKind } from '../../../marketplace/catalog';
import { FiefMovementPolicy } from '../FiefMovementPolicy';

function mockBuildings(
  overrides: Partial<{
    origin: { x: number; y: number } | null;
    influenceRadius: number;
    militaryRadius: number;
    kind: BuildKind;
    claimed: { x: number; y: number }[];
  }> = {}
) {
  const {
    origin = { x: 100, y: 100 },
    influenceRadius = 200,
    militaryRadius = 170,
    kind = 'keep' as BuildKind,
    claimed = [],
  } = overrides;
  return {
    getInfluenceOriginPoint: (id: string) =>
      id === 'keep-1' || id === 'barracks-1' ? origin : null,
    getInfluenceRadius: () => influenceRadius,
    getMilitaryInfluenceRadius: () => militaryRadius,
    getById: (id: string): { kind: BuildKind } | undefined =>
      id === 'keep-1'
        ? { kind }
        : id === 'barracks-1'
          ? { kind: 'barracks' }
          : undefined,
    inRealmClaim: (x: number, y: number) =>
      claimed.some((p) => Math.hypot(p.x - x, p.y - y) <= 100),
  };
}

describe('FiefMovementPolicy', () => {
  const world = { width: 800, height: 600 };

  it('keeps points inside the influence sphere', () => {
    const policy = new FiefMovementPolicy(mockBuildings(), world);
    const inside = policy.clampToFief('keep-1', { x: 120, y: 110 });
    expect(inside).toEqual({ x: 120, y: 110 });
  });

  it('clamps wander targets to the sphere edge', () => {
    const policy = new FiefMovementPolicy(mockBuildings(), world);
    const clamped = policy.clampToFief('keep-1', { x: 400, y: 100 });
    const dist = Math.hypot(clamped.x - 100, clamped.y - 100);
    expect(dist).toBeCloseTo(200, 5);
  });

  it('uses military radius for barracks centers', () => {
    const policy = new FiefMovementPolicy(
      mockBuildings({ kind: 'barracks' }),
      world
    );
    const clamped = policy.clampToFief('barracks-1', { x: 400, y: 100 });
    const dist = Math.hypot(clamped.x - 100, clamped.y - 100);
    expect(dist).toBeCloseTo(170, 5);
  });

  it('randomPointInFief returns a clamped point inside the fief', () => {
    const policy = new FiefMovementPolicy(mockBuildings(), world);
    const pt = policy.randomPointInFief('keep-1', 'field');
    expect(pt).not.toBeNull();
    const dist = Math.hypot(pt!.x - 100, pt!.y - 100);
    expect(dist).toBeLessThanOrEqual(200.01);
  });

  it('returns null when keep origin is missing', () => {
    const policy = new FiefMovementPolicy(
      mockBuildings({ origin: null }),
      world
    );
    expect(policy.randomPointInFief('keep-1', 'keep')).toBeNull();
  });

  it('does not clamp points already on a claimed holding', () => {
    const policy = new FiefMovementPolicy(
      mockBuildings({ claimed: [{ x: 400, y: 100 }] }),
      world
    );
    const kept = policy.clampToFief('keep-1', { x: 400, y: 100 });
    expect(kept).toEqual({ x: 400, y: 100 });
  });
});

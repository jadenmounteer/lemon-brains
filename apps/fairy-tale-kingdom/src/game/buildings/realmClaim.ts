import type { BuildKind } from '../../marketplace/catalog';

export const REALM_CLAIM_PAD = 100;

export type ClaimCircle = { x: number; y: number; radius: number };

export type ClaimSite = {
  x: number;
  y: number;
  hp: number;
  kind: BuildKind | 'keep';
};

/** Roads and spans are paths, not holdings. */
export function isRealmClaimKind(kind: BuildKind | 'keep'): boolean {
  return kind !== 'road' && kind !== 'bridge' && kind !== 'ladder';
}

export function claimCirclesFromSites(
  sites: ClaimSite[],
  pad = REALM_CLAIM_PAD
): ClaimCircle[] {
  const out: ClaimCircle[] = [];
  for (const s of sites) {
    if (s.hp <= 0) continue;
    if (!isRealmClaimKind(s.kind)) continue;
    out.push({ x: s.x, y: s.y, radius: pad });
  }
  return out;
}

export function inRealmClaim(
  x: number,
  y: number,
  circles: ClaimCircle[]
): boolean {
  for (const c of circles) {
    if (Math.hypot(x - c.x, y - c.y) <= c.radius) return true;
  }
  return false;
}

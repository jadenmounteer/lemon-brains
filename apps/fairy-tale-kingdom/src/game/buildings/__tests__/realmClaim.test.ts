import { describe, expect, it } from 'vitest';
import {
  claimCirclesFromSites,
  inRealmClaim,
  REALM_CLAIM_PAD,
} from '../realmClaim';

describe('realmClaim', () => {
  it('skips roads and includes a far house as an exclave', () => {
    const circles = claimCirclesFromSites([
      { x: 400, y: 300, hp: 200, kind: 'keep' },
      { x: 900, y: 80, hp: 30, kind: 'house' },
      { x: 600, y: 300, hp: 15, kind: 'road' },
    ]);
    expect(circles).toHaveLength(2);
    expect(inRealmClaim(900, 80, circles)).toBe(true);
    expect(inRealmClaim(600, 300, circles)).toBe(false);
    expect(inRealmClaim(400 + REALM_CLAIM_PAD + 20, 300, circles)).toBe(false);
  });
});

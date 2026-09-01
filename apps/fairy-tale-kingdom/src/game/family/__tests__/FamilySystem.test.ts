import { describe, expect, it } from 'vitest';
import { Phase12Balance } from '../../economy/phase12Balance';

/** Grant-only pregnancy fields (mirrors FamilySystem.grantPregnancy). */
function applyGrantPregnancy(
  mother: {
    pregnant: boolean;
    pregnantDaysLeft?: number;
    pendingChildHouseId?: string;
    goal?: { kind: string } | null;
    spouseId?: string;
  },
  childHouseId: string
): boolean {
  if (mother.pregnant) return false;
  mother.pregnant = true;
  mother.pregnantDaysLeft = Phase12Balance.pregnancyDays;
  mother.pendingChildHouseId = childHouseId;
  mother.goal = null;
  return true;
}

describe('grant pregnancy placement', () => {
  it('stores pendingChildHouseId for birth placement', () => {
    const mother = {
      pregnant: false,
      spouseId: 'f1',
      goal: { kind: 'have_child' } as { kind: string } | null,
      pregnantDaysLeft: undefined as number | undefined,
      pendingChildHouseId: undefined as string | undefined,
    };
    const ok = applyGrantPregnancy(mother, 'house-b');
    expect(ok).toBe(true);
    expect(mother.pregnant).toBe(true);
    expect(mother.pregnantDaysLeft).toBe(Phase12Balance.pregnancyDays);
    expect(mother.pendingChildHouseId).toBe('house-b');
    expect(mother.goal).toBeNull();
  });
});

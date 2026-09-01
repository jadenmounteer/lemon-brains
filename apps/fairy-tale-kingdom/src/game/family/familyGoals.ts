/** Family aspiration goal kinds (SubjectGoal.kind). */
export const FAMILY_GOAL_MARRY = 'marry';
export const FAMILY_GOAL_HAVE_CHILD = 'have_child';

export function isFamilyGoalKind(kind: string): boolean {
  return kind === FAMILY_GOAL_MARRY || kind === FAMILY_GOAL_HAVE_CHILD;
}

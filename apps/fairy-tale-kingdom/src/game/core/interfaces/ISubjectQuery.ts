import type { CareerTodoItem, SubjectRole } from '../../subjects/types';

export interface SubjectSnapshot {
  id: string;
  role: SubjectRole;
  name: string;
  houseId: string;
  loyaltyKeepId?: string | null;
}

export interface ManagedSubjectView {
  data: SubjectSnapshot;
  interrupt?: unknown;
}

export type { CareerTodoItem };

/** Read-only subject queries for stats, combat, and UI. */
export interface ISubjectQuery {
  count(): number;
  hasRole(role: SubjectRole): boolean;
  countRole(role: SubjectRole): number;
  hasRolePair?(a: SubjectRole, b: SubjectRole): boolean;
  occupantCounts(): Map<string, number>;
  combatants(): ManagedSubjectView[];
  /** Free troops a general can assign (off-wall, idle, healthy). */
  countAssignableDetachment(): number;
  listCareerTodos(): CareerTodoItem[];
  getClockHour(): number;
}

import type { Aabb } from '../buildings/BuildingSystem';
import { UNIT_HEIGHT, UNIT_WIDTH, livesAtKeep } from '../art/assetManifest';
import type { UnitRole } from '../art/assetManifest';
import type { SavedSubject } from '../../kingdom/LayoutRepository';
import type { BuildingResident, Subject, SubjectInterrupt } from './types';
import type { InterruptKind } from './types';
import { jobLabel } from '../jobs/capacities';
import { roleLabel } from './schedules';
import type { ManagedSubject } from './managedSubject';

function jobDisplayLabel(managed: ManagedSubject): string {
  if (managed.data.job) {
    const label = jobLabel(managed.data.job);
    if (label) return label;
  }
  return roleLabel(managed.data.role);
}

/** Map of subjects, serialization, and read-only queries. */
export class SubjectRegistry {
  private subjects: ManagedSubject[] = [];
  private nextSubjectId = 0;

  get all(): ManagedSubject[] {
    return this.subjects;
  }

  get nextId(): number {
    return this.nextSubjectId;
  }

  set nextId(n: number) {
    this.nextSubjectId = n;
  }

  push(managed: ManagedSubject): void {
    this.subjects.push(managed);
  }

  remove(managed: ManagedSubject): void {
    this.subjects = this.subjects.filter((s) => s !== managed);
  }

  clear(): void {
    this.subjects = [];
  }

  getById(id: string): ManagedSubject | undefined {
    return this.subjects.find((s) => s.data.id === id);
  }

  list(): Subject[] {
    return this.subjects.map((s) => s.data);
  }

  listManaged(): ManagedSubject[] {
    return this.subjects;
  }

  hasRole(role: UnitRole): boolean {
    return this.subjects.some((s) => s.data.role === role);
  }

  countRole(role: UnitRole): number {
    return this.subjects.filter((s) => s.data.role === role).length;
  }

  count(): number {
    return this.subjects.filter((s) => this.countsTowardPopulation(s)).length;
  }

  countAll(): number {
    return this.subjects.length;
  }

  countsTowardPopulation(s: ManagedSubject): boolean {
    if (s.data.allegiance === 'camp') return false;
    if (
      s.data.role === 'zombie' ||
      s.data.role === 'vampire_wife' ||
      s.data.role === 'witch' ||
      s.data.role === 'necromancer'
    ) {
      return false;
    }
    return true;
  }

  royalCounts(): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.subjects) {
      if (!livesAtKeep(s.data.role)) continue;
      map.set(s.data.houseId, (map.get(s.data.houseId) ?? 0) + 1);
    }
    return map;
  }

  occupantCounts(
    hasHouse: (houseId: string) => boolean
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.subjects) {
      if (livesAtKeep(s.data.role)) continue;
      if (!hasHouse(s.data.houseId)) continue;
      map.set(s.data.houseId, (map.get(s.data.houseId) ?? 0) + 1);
    }
    return map;
  }

  unitBodies(): Aabb[] {
    return this.subjects.map((s) => ({
      left: s.sprite.x - UNIT_WIDTH / 2 - 2,
      right: s.sprite.x + UNIT_WIDTH / 2 + 2,
      top: s.sprite.y - UNIT_HEIGHT,
      bottom: s.sprite.y,
    }));
  }

  residentsOf(houseId: string): BuildingResident[] {
    return this.subjects
      .filter((s) => s.data.houseId === houseId)
      .map((s) => ({
        id: s.data.id,
        name: s.data.name,
        role: s.data.role,
        roleLabel: roleLabel(s.data.role),
        jobLabel: jobDisplayLabel(s),
      }));
  }

  workersOf(buildingId: string): BuildingResident[] {
    return this.subjects
      .filter((s) => s.data.workplaceId === buildingId)
      .map((s) => ({
        id: s.data.id,
        name: s.data.name,
        role: s.data.role,
        roleLabel: roleLabel(s.data.role),
        jobLabel: jobDisplayLabel(s),
      }));
  }

  withInterrupt(kind: InterruptKind): ManagedSubject[] {
    return this.subjects.filter((s) => s.interrupt?.kind === kind);
  }

  listInterrupts(kind: InterruptKind): SubjectInterrupt[] {
    return this.subjects
      .filter((s) => s.interrupt?.kind === kind)
      .map((s) => s.interrupt!);
  }

  hasInterrupt(id: string): boolean {
    return Boolean(this.getById(id)?.interrupt);
  }

  serialize(): SavedSubject[] {
    return this.subjects.map((s) => ({
      id: s.data.id,
      name: s.data.name,
      role: s.data.role,
      houseId: s.data.houseId,
      hp: s.data.hp,
      maxHp: s.data.maxHp,
      onWall: s.data.onWall,
      hunger: s.data.hunger,
      sick: s.data.sick,
      gender: s.data.gender,
      temporaryPrincess: s.data.temporaryPrincess,
      married: s.data.married,
      happiness: s.data.happiness,
      ageYears: s.data.ageYears,
      body: s.data.body,
      job: s.data.job,
      workplaceId: s.data.workplaceId,
      spouseId: s.data.spouseId,
      motherId: s.data.motherId,
      fatherId: s.data.fatherId,
      pregnant: s.data.pregnant,
      pregnantDaysLeft: s.data.pregnantDaysLeft,
      thought: s.data.thought,
      backstory: s.data.backstory,
      goal: s.data.goal,
      lifeLog: s.data.lifeLog,
      curse: s.data.curse,
      cursedAsRole: s.data.cursedAsRole,
      lowHappyHours: s.data.lowHappyHours,
      x: s.sprite.x,
      y: s.sprite.y,
      activity: s.data.activity,
      activityLabel: s.data.activityLabel,
      zone: s.data.zone,
      interrupt: s.interrupt,
      campId: s.data.campId,
      allegiance: s.data.allegiance,
      loyaltyKeepId: s.data.loyaltyKeepId ?? null,
    }));
  }

  bumpNextIdFromSavedId(id: string): void {
    const match = /^subject-(\d+)$/.exec(id);
    if (match) {
      this.nextSubjectId = Math.max(this.nextSubjectId, Number(match[1]) + 1);
    }
  }
}

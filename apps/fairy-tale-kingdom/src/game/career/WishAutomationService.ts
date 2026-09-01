import type { UnitRole } from '../art/assetManifest';
import { evaluateCareerAspiration } from './evaluateAspiration';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { roleFromCareerGoal } from '../jobs/capacities';
import { readSandboxFromRegistry } from '../../kingdom/sandboxSettings';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { FamilySystem } from '../family/FamilySystem';
import {
  FAMILY_GOAL_HAVE_CHILD,
  FAMILY_GOAL_MARRY,
  isFamilyGoalKind,
} from '../family/familyGoals';
import type Phaser from 'phaser';

export interface WishAutomationDeps {
  getGold: () => number;
  infiniteGold: () => boolean;
  kingdomGameMode: () => 'learning' | 'normal';
  weddingActive: () => boolean;
}

type FamilyWishKind = 'marry' | 'have_child';

/** FGM auto-grants career and family wishes when criteria are met. */
export class WishAutomationService {
  private cooldownMs = 0;
  private granted = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly family: FamilySystem,
    private readonly deps: WishAutomationDeps
  ) {}

  update(deltaMs: number): void {
    if (!this.shouldRun()) return;
    this.cooldownMs -= deltaMs;
    if (this.cooldownMs > 0) return;
    this.cooldownMs = 12_000 + Math.random() * 8000;

    const fgm = this.subjects
      .listManaged()
      .find((s) => s.data.role === 'fairy_godmother' && s.sprite.active);
    if (!fgm) return;

    const candidate = this.pickCandidate();
    if (!candidate) return;

    this.granted.add(candidate.subjectId);
    this.subjects.nudgeToward(
      fgm.data.id,
      candidate.x,
      candidate.y,
      55
    );
    this.subjects.playPoofVfx(candidate.x, candidate.y);

    if (candidate.kind === 'career') {
      this.scene.game.events.emit(KingdomEvents.AUTO_GRANT_WISH, {
        subjectId: candidate.subjectId,
        targetRole: candidate.targetRole!,
        cost: candidate.cost,
      });
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `The Fairy Godmother granted ${candidate.name}'s wish!`,
      });
      return;
    }

    this.scene.game.events.emit(KingdomEvents.AUTO_GRANT_FAMILY_WISH, {
      kind: candidate.kind,
      subjectId: candidate.subjectId,
    });
    const verb =
      candidate.kind === 'marry'
        ? `united ${candidate.name} in marriage!`
        : `blessed ${candidate.name} with a child!`;
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `The Fairy Godmother ${verb}`,
    });
  }

  private pickCandidate():
    | {
        subjectId: string;
        name: string;
        x: number;
        y: number;
        kind: 'career';
        targetRole: UnitRole;
        cost: number;
      }
    | {
        subjectId: string;
        name: string;
        x: number;
        y: number;
        kind: FamilyWishKind;
      }
    | null {
    const managed = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          s.data.goal &&
          !this.granted.has(s.data.id) &&
          (s.data.role === 'peasant' || s.data.goal.kind.startsWith('become_'))
      );

    for (const s of managed) {
      if (!s.data.goal || isFamilyGoalKind(s.data.goal.kind)) continue;
      const view = this.evaluateCareerFor(s.data.id);
      if (view?.canPromote) {
        return {
          subjectId: s.data.id,
          name: s.data.name,
          x: s.sprite.x,
          y: s.sprite.y,
          kind: 'career',
          targetRole: view.targetRole,
          cost: view.cost,
        };
      }
    }

    for (const s of managed) {
      if (s.data.goal?.kind !== FAMILY_GOAL_MARRY) continue;
      const view = this.evaluateFamilyFor(s.data.id);
      if (view?.canGrant) {
        return {
          subjectId: s.data.id,
          name: s.data.name,
          x: s.sprite.x,
          y: s.sprite.y,
          kind: 'marry',
        };
      }
    }

    for (const s of managed) {
      if (s.data.goal?.kind !== FAMILY_GOAL_HAVE_CHILD) continue;
      const view = this.evaluateFamilyFor(s.data.id);
      if (view?.canGrant) {
        return {
          subjectId: s.data.id,
          name: s.data.name,
          x: s.sprite.x,
          y: s.sprite.y,
          kind: 'have_child',
        };
      }
    }

    return null;
  }

  shouldRun(): boolean {
    return shouldAutoGrant(
      readSandboxFromRegistry(this.scene.game.registry),
      this.deps.kingdomGameMode()
    );
  }

  resetGrant(id: string): void {
    this.granted.delete(id);
  }

  private evaluateCareerFor(subjectId: string) {
    const managed = this.subjects.getById(subjectId);
    if (!managed?.data.goal) return null;

    const roleCounts: Partial<Record<UnitRole, number>> = {};
    for (const s of this.subjects.listManaged()) {
      roleCounts[s.data.role] = (roleCounts[s.data.role] ?? 0) + 1;
    }

    return evaluateCareerAspiration(
      { role: managed.data.role, goal: managed.data.goal },
      {
        hasDungeon: this.buildings.hasDungeon(),
        hasBarracks: this.buildings.hasBarracks(),
        hasCathedral: this.buildings.hasCathedral(),
        hasInfirmary: this.buildings.hasInfirmary(),
        hasGallows: this.buildings.hasGallows(),
        tavernCount: this.buildings.list().filter((b) => b.kind === 'tavern').length,
        roleCounts,
      },
      { royaltyUnlocked: true },
      this.deps.getGold(),
      this.deps.infiniteGold()
    );
  }

  private evaluateFamilyFor(subjectId: string) {
    return this.family.evaluateFor(
      subjectId,
      this.deps.getGold(),
      this.deps.infiniteGold(),
      this.deps.weddingActive()
    );
  }
}

/** Pure rule for tests — Learning Mode defaults on unless sandbox disables. */
export function shouldAutoGrant(
  sandbox: { life?: { fgmAutoGrant?: boolean } },
  mode: 'learning' | 'normal'
): boolean {
  if (sandbox.life?.fgmAutoGrant != null) {
    return sandbox.life.fgmAutoGrant;
  }
  return mode === 'learning';
}

export function aspirationTargetRole(goal: {
  targetRole?: UnitRole;
  kind: string;
}): UnitRole | null {
  return goal.targetRole ?? roleFromCareerGoal(goal.kind);
}

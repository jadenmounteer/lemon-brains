import type { UnitRole } from '../art/assetManifest';
import { evaluateCareerAspiration } from './evaluateAspiration';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { roleFromCareerGoal } from '../jobs/capacities';
import { readSandboxFromRegistry } from '../../kingdom/sandboxSettings';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type Phaser from 'phaser';

export interface WishAutomationDeps {
  getGold: () => number;
  infiniteGold: () => boolean;
  kingdomGameMode: () => 'learning' | 'normal';
}

/** FGM auto-grants career wishes when criteria are met and the toggle allows it. */
export class WishAutomationService {
  private cooldownMs = 0;
  private granted = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
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

    const candidate = this.subjects
      .listManaged()
      .find(
        (s) =>
          s.sprite.active &&
          s.data.goal &&
          s.data.role === 'peasant' &&
          !this.granted.has(s.data.id)
      );
    if (!candidate) return;

    const view = this.evaluateFor(candidate.data.id);
    if (!view?.canPromote) return;

    this.granted.add(candidate.data.id);
    this.subjects.nudgeToward(
      fgm.data.id,
      candidate.sprite.x,
      candidate.sprite.y,
      55
    );
    this.subjects.playPoofVfx(candidate.sprite.x, candidate.sprite.y);

    this.scene.game.events.emit(KingdomEvents.AUTO_GRANT_WISH, {
      subjectId: candidate.data.id,
      targetRole: view.targetRole,
      cost: view.cost,
    });

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `The Fairy Godmother granted ${candidate.data.name}'s wish!`,
    });
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

  private evaluateFor(subjectId: string) {
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

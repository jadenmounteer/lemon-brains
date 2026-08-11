import Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { EconomyBalance } from '../economy/economy';
import type { RaidSystem } from '../raids/RaidSystem';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import { CombatBalance } from './stats';

/**
 * Periodic combat tick: guards melee, archers shoot (wall bonus),
 * and notifies subjects to flee / climb during raids.
 */
export class CombatSystem {
  private accumMs = 0;
  private inspired = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly raids: RaidSystem
  ) {}

  setInspired(active: boolean): void {
    this.inspired = active;
  }

  update(deltaMs: number): void {
    const active = this.raids.hasActiveRaiders();
    this.buildings.setRaidActive(active);
    this.subjects.setRaidMode(active);

    if (!active) {
      this.accumMs = 0;
      return;
    }

    this.subjects.tickFleeAndClimb(this.raids, deltaMs);

    this.accumMs += deltaMs;
    if (this.accumMs < CombatBalance.tickMs) return;
    this.accumMs = 0;

    this.friendlyFire();
  }

  private friendlyFire(): void {
    let dmgMult = 1;
    if (this.buildings.hasBarracks()) dmgMult *= EconomyBalance.barracksDamageMult;
    if (this.inspired) dmgMult *= EconomyBalance.waveCombatMult;

    for (const fighter of this.subjects.combatants()) {
      const isArcher =
        fighter.data.role === 'archer' || fighter.data.role === 'elite_archer';
      const target = this.raids.nearestRaider(
        fighter.sprite.x,
        fighter.sprite.y,
        isArcher
          ? CombatBalance.archerRange *
              (fighter.data.onWall ? CombatBalance.archerWallRangeMult : 1)
          : CombatBalance.aggroRadius
      );
      if (!target) continue;

      const dist = Phaser.Math.Distance.Between(
        fighter.sprite.x,
        fighter.sprite.y,
        target.sprite.x,
        target.sprite.y
      );

      if (!isArcher) {
        if (dist > CombatBalance.guardRange) {
          this.subjects.nudgeToward(
            fighter.data.id,
            target.sprite.x,
            target.sprite.y,
            55
          );
          continue;
        }
        const base =
          fighter.data.role === 'elite_guard'
            ? CombatBalance.eliteGuardMelee
            : CombatBalance.guardMelee;
        const dead = this.raids.damageRaider(target, base * dmgMult);
        if (dead) {
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${fighter.data.name} struck down a raider`,
          });
        }
      } else {
        const range =
          CombatBalance.archerRange *
          (fighter.data.onWall ? CombatBalance.archerWallRangeMult : 1);
        if (dist > range) {
          if (!fighter.data.onWall) {
            this.subjects.tryClimbNearestStairs(fighter.data.id);
          }
          continue;
        }
        let dmg =
          fighter.data.role === 'elite_archer'
            ? CombatBalance.eliteArcherRanged
            : CombatBalance.archerRanged;
        if (fighter.data.onWall) {
          dmg *= CombatBalance.archerWallDamageMult;
        }
        dmg *= dmgMult;
        const dead = this.raids.damageRaider(target, dmg);
        if (dead) {
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${fighter.data.name} shot a raider`,
          });
        }
      }
    }
  }
}

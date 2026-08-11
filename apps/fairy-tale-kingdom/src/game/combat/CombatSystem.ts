import Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { EconomyBalance } from '../economy/economy';
import type { RaidSystem } from '../raids/RaidSystem';
import { SiegeBalance } from '../siege/balance';
import type { SiegeEngineSystem } from '../siege/SiegeEngineSystem';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import { CombatBalance } from './stats';

/**
 * Periodic combat tick: guards melee, archers shoot (wall/tower bonus),
 * ballistae auto-fire, engine priority, defense muster during army sieges.
 */
export class CombatSystem {
  private accumMs = 0;
  private ballistaCooldown = new Map<string, number>();
  private inspired = false;
  private engines: SiegeEngineSystem | null = null;
  private vfx: SiegeVfx | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly raids: RaidSystem
  ) {}

  setEngines(engines: SiegeEngineSystem): void {
    this.engines = engines;
  }

  setVfx(vfx: SiegeVfx): void {
    this.vfx = vfx;
  }

  setInspired(active: boolean): void {
    this.inspired = active;
  }

  update(deltaMs: number): void {
    const active = this.raids.hasActiveRaiders();
    this.buildings.setRaidActive(active);
    this.subjects.setRaidMode(active);

    if (!active) {
      this.accumMs = 0;
      this.ballistaCooldown.clear();
      return;
    }

    this.subjects.tickFleeAndClimb(this.raids, deltaMs);
    this.subjects.tickDefenseMuster(this.raids.isArmySiege());

    for (const [id, cd] of [...this.ballistaCooldown]) {
      const next = cd - deltaMs;
      if (next <= 0) this.ballistaCooldown.delete(id);
      else this.ballistaCooldown.set(id, next);
    }

    this.accumMs += deltaMs;
    if (this.accumMs < CombatBalance.tickMs) return;
    this.accumMs = 0;

    this.friendlyFire();
    this.tickBallistae();
  }

  private friendlyFire(): void {
    let dmgMult = 1;
    if (this.buildings.hasBarracks()) dmgMult *= EconomyBalance.barracksDamageMult;
    if (this.inspired) dmgMult *= EconomyBalance.waveCombatMult;

    for (const fighter of this.subjects.combatants()) {
      const isArcher =
        fighter.data.role === 'archer' || fighter.data.role === 'elite_archer';

      // Prefer siege engines for archers / nearby melee
      const engine = this.engines?.nearestEngine(
        fighter.sprite.x,
        fighter.sprite.y,
        isArcher
          ? this.archerRange(fighter.sprite.x, fighter.sprite.y, fighter.data.onWall)
          : CombatBalance.aggroRadius
      );

      if (engine && isArcher) {
        const dist = Phaser.Math.Distance.Between(
          fighter.sprite.x,
          fighter.sprite.y,
          engine.sprite.x,
          engine.sprite.y
        );
        const range = this.archerRange(
          fighter.sprite.x,
          fighter.sprite.y,
          fighter.data.onWall
        );
        if (dist <= range) {
          let dmg =
            fighter.data.role === 'elite_archer'
              ? CombatBalance.eliteArcherRanged
              : CombatBalance.archerRanged;
          if (fighter.data.onWall) dmg *= CombatBalance.archerWallDamageMult;
          dmg *= dmgMult;
          this.vfx?.projectileArc(
            fighter.sprite.x,
            fighter.sprite.y - 10,
            engine.sprite.x,
            engine.sprite.y - 6,
            'arrow',
            () => {
              const dead = this.engines?.damageEngine(engine, dmg);
              if (dead) {
                this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
                  message: `${fighter.data.name} wrecked a siege engine`,
                });
              }
            }
          );
          continue;
        }
      }

      const target = this.raids.nearestRaider(
        fighter.sprite.x,
        fighter.sprite.y,
        isArcher
          ? this.archerRange(
              fighter.sprite.x,
              fighter.sprite.y,
              fighter.data.onWall
            )
          : CombatBalance.aggroRadius
      );

      // Melee can also bash engines in range
      if (!isArcher && engine) {
        const ed = Phaser.Math.Distance.Between(
          fighter.sprite.x,
          fighter.sprite.y,
          engine.sprite.x,
          engine.sprite.y
        );
        if (ed <= CombatBalance.guardRange + 10) {
          const base =
            fighter.data.role === 'elite_guard'
              ? CombatBalance.eliteGuardMelee
              : CombatBalance.guardMelee;
          this.vfx?.meleeLunge(fighter.sprite, engine.sprite.x, engine.sprite.y);
          const dead = this.engines?.damageEngine(engine, base * dmgMult);
          if (dead) {
            this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
              message: `${fighter.data.name} smashed a siege engine`,
            });
          }
          continue;
        }
        if (!target || ed < 50) {
          this.subjects.nudgeToward(
            fighter.data.id,
            engine.sprite.x,
            engine.sprite.y,
            55
          );
          continue;
        }
      }

      if (!target) {
        if (isArcher && !fighter.data.onWall) {
          this.subjects.tryClimbNearestStairs(fighter.data.id);
        }
        continue;
      }

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
        this.vfx?.meleeLunge(fighter.sprite, target.sprite.x, target.sprite.y);
        this.vfx?.hitFlash(target.sprite);
        const dead = this.raids.damageRaider(target, base * dmgMult);
        if (dead) {
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${fighter.data.name} struck down a raider`,
          });
        }
      } else {
        const range = this.archerRange(
          fighter.sprite.x,
          fighter.sprite.y,
          fighter.data.onWall
        );
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
        const tid = target;
        this.vfx?.projectileArc(
          fighter.sprite.x,
          fighter.sprite.y - 10,
          target.sprite.x,
          target.sprite.y - 8,
          'arrow',
          () => {
            const dead = this.raids.damageRaider(tid, dmg);
            if (dead) {
              this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
                message: `${fighter.data.name} shot a raider`,
              });
            }
          }
        );
      }
    }
  }

  private archerRange(x: number, y: number, onWall: boolean): number {
    let range = CombatBalance.archerRange;
    if (onWall) range *= CombatBalance.archerWallRangeMult;
    const tower = this.buildings.nearestWatchtower(
      x,
      y,
      SiegeBalance.watchtowerRadius
    );
    if (tower) {
      range *= SiegeBalance.watchtowerArcherRangeMult;
    }
    return range;
  }

  private tickBallistae(): void {
    for (const b of this.buildings.listBallistae()) {
      if ((this.ballistaCooldown.get(b.id) ?? 0) > 0) continue;

      const engine = this.engines?.nearestEngine(
        b.x,
        b.y,
        SiegeBalance.ballistaRange
      );
      if (engine) {
        this.ballistaCooldown.set(b.id, SiegeBalance.ballistaCooldownMs);
        this.vfx?.projectileArc(
          b.x,
          b.y - 10,
          engine.sprite.x,
          engine.sprite.y - 6,
          'bolt',
          () => {
            this.engines?.damageEngine(
              engine,
              SiegeBalance.ballistaDamage * SiegeBalance.ballistaEngineMult
            );
          }
        );
        continue;
      }

      const raider = this.raids.nearestRaider(b.x, b.y, SiegeBalance.ballistaRange);
      if (!raider) continue;
      this.ballistaCooldown.set(b.id, SiegeBalance.ballistaCooldownMs);
      this.vfx?.projectileArc(
        b.x,
        b.y - 10,
        raider.sprite.x,
        raider.sprite.y - 8,
        'bolt',
        () => {
          this.raids.damageRaider(raider, SiegeBalance.ballistaDamage);
        }
      );
    }
  }
}

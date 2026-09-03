import Phaser from 'phaser';
import { isKnightRole } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { EconomyBalance } from '../economy/economy';
import type { MonsterSystem } from '../monsters/MonsterSystem';
import type { RaidSystem } from '../raids/RaidSystem';
import { SiegeBalance } from '../siege/balance';
import type { SiegeEngineSystem } from '../siege/SiegeEngineSystem';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import type { EncampmentSystem } from '../war/EncampmentSystem';
import { CombatBalance } from './stats';

/**
 * Periodic combat: raids, siege engines, ballistae, and monster hunts
 * (knights vs sleeping dragons).
 */
export class CombatSystem {
  private accumMs = 0;
  private ballistaCooldown = new Map<string, number>();
  private inspired = false;
  private engines: SiegeEngineSystem | null = null;
  private vfx: SiegeVfx | null = null;
  private monsters: MonsterSystem | null = null;
  private encampments: EncampmentSystem | null = null;

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

  setMonsters(monsters: MonsterSystem): void {
    this.monsters = monsters;
  }

  setEncampments(encampments: EncampmentSystem): void {
    this.encampments = encampments;
  }

  setInspired(active: boolean): void {
    this.inspired = active;
  }

  update(deltaMs: number): void {
    const raidActive = this.raids.hasActiveRaiders();
    this.buildings.setRaidActive(raidActive);
    this.subjects.setRaidMode(raidActive);

    if (raidActive) {
      this.subjects.tickFleeAndClimb(this.raids, deltaMs);
      this.subjects.tickDefenseMuster(true, this.raids);
    }

    for (const [id, cd] of [...this.ballistaCooldown]) {
      const next = cd - deltaMs;
      if (next <= 0) this.ballistaCooldown.delete(id);
      else this.ballistaCooldown.set(id, next);
    }

    this.accumMs += deltaMs;
    if (this.accumMs < CombatBalance.tickMs) return;
    this.accumMs = 0;

    this.tickAssaultOrders();
    this.friendlyFire(raidActive);
    if (raidActive) this.tickBallistae();
    this.tickMonsterCombat();
    this.tickMilitaryVsCampHostiles();
  }

  private dmgMult(): number {
    let dmgMult = 1;
    if (this.buildings.hasBarracks()) dmgMult *= EconomyBalance.barracksDamageMult;
    if (this.inspired) dmgMult *= EconomyBalance.waveCombatMult;
    return dmgMult;
  }

  private tickAssaultOrders(): void {
    const dmgMult = this.dmgMult();
    for (const fighter of this.subjects.withInterrupt('assault')) {
      const targetId = fighter.interrupt?.targetId;
      if (!targetId) {
        this.subjects.clearInterrupt(fighter.data.id);
        continue;
      }

      if (targetId.startsWith('monster:')) {
        const mid = targetId.slice('monster:'.length);
        const m = this.monsters?.getById(mid);
        if (!m) {
          this.subjects.clearInterrupt(fighter.data.id);
          continue;
        }
        const dist = Phaser.Math.Distance.Between(
          fighter.sprite.x,
          fighter.sprite.y,
          m.sprite.x,
          m.sprite.y
        );
        if (dist > CombatBalance.guardRange + 8) {
          this.subjects.nudgeToward(
            fighter.data.id,
            m.sprite.x,
            m.sprite.y,
            55
          );
          continue;
        }
        const base =
          fighter.data.role === 'elite_guard'
            ? CombatBalance.eliteGuardMelee
            : fighter.data.role === 'elite_archer' ||
                fighter.data.role === 'archer'
              ? CombatBalance.archerRanged
              : CombatBalance.guardMelee;
        this.vfx?.meleeLunge(fighter.sprite, m.sprite.x, m.sprite.y);
        const dead = this.monsters?.damageMonster(m.id, base * dmgMult);
        if (dead) {
          this.subjects.clearAssault(targetId);
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${fighter.data.name}’s detachment slew the monster!`,
          });
        }
        continue;
      }

      const point = this.encampments?.getCampPoint(targetId);
      if (!point) {
        this.subjects.clearInterrupt(fighter.data.id);
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        fighter.sprite.x,
        fighter.sprite.y,
        point.x,
        point.y
      );
      if (dist > 40) {
        this.subjects.nudgeToward(fighter.data.id, point.x, point.y, 55);
        continue;
      }
      const base =
        fighter.data.role === 'elite_guard'
          ? CombatBalance.eliteGuardMelee
          : fighter.data.role === 'elite_archer' ||
              fighter.data.role === 'archer'
            ? CombatBalance.archerRanged
            : CombatBalance.guardMelee;
      const destroyed = this.encampments?.applyAssaultHit(
        targetId,
        base * dmgMult
      );
      if (destroyed) {
        this.subjects.clearAssault(targetId);
      }
    }
  }

  private friendlyFire(raidActive: boolean): void {
    if (!raidActive) return;
    const dmgMult = this.dmgMult();

    for (const fighter of this.subjects.combatants()) {
      const isArcher =
        fighter.data.role === 'archer' || fighter.data.role === 'elite_archer';

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

      if (!isArcher && engine) {
        const ed = Phaser.Math.Distance.Between(
          fighter.sprite.x,
          fighter.sprite.y,
          engine.sprite.x,
          engine.sprite.y
        );
        const base =
          fighter.data.role === 'knight'
            ? CombatBalance.knightMelee
            : fighter.data.role === 'elite_guard'
              ? CombatBalance.eliteGuardMelee
              : CombatBalance.guardMelee;
        if (ed <= CombatBalance.guardRange + 10) {
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
          this.subjects.tryClimbNearestLadder(fighter.data.id);
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
          fighter.data.role === 'knight'
            ? CombatBalance.knightMelee
            : fighter.data.role === 'elite_guard'
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
            this.subjects.tryClimbNearestLadder(fighter.data.id);
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

  private tickMonsterCombat(): void {
    if (!this.monsters) return;
    const dmgMult = this.dmgMult();

    for (const fighter of this.subjects.combatants()) {
      const isKnight = isKnightRole(fighter.data.role);
      const isArcher =
        fighter.data.role === 'archer' || fighter.data.role === 'elite_archer';

      // Knights prioritize sleeping dragons
      if (isKnight) {
        const sleepers = this.monsters.sleepingDragons();
        let best = null as (typeof sleepers)[0] | null;
        let bestD = Number(CombatBalance.knightHuntRange);
        for (const d of sleepers) {
          const dist = Phaser.Math.Distance.Between(
            fighter.sprite.x,
            fighter.sprite.y,
            d.sprite.x,
            d.sprite.y
          );
          if (dist < bestD) {
            bestD = dist;
            best = d;
          }
        }
        if (best) {
          if (bestD > CombatBalance.guardRange + 6) {
            this.subjects.nudgeToward(
              fighter.data.id,
              best.sprite.x,
              best.sprite.y,
              60
            );
            fighter.data.activity = 'hunt';
            fighter.data.activityLabel = `Hunting ${best.name}`;
            continue;
          }
          this.vfx?.meleeLunge(fighter.sprite, best.sprite.x, best.sprite.y);
          const dmg =
            (CombatBalance.knightMelee + CombatBalance.knightDragonBonus) *
            dmgMult;
          const dead = this.monsters.damageMonster(best.id, dmg);
          if (dead) {
            this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
              message: `${fighter.data.name} slew the dragon ${best.name}!`,
            });
          }
          continue;
        }
      }

      // Awake monsters: knights/guards melee; archers can chip lightly (not dragons while asleep)
      const monster = this.monsters.nearestMonster(
        fighter.sprite.x,
        fighter.sprite.y,
        isArcher ? this.archerRange(fighter.sprite.x, fighter.sprite.y, fighter.data.onWall) : CombatBalance.aggroRadius,
        { awakeOnly: true }
      );
      if (!monster) continue;

      // Only knights meaningfully fight dragons; others skip dragons
      if (monster.kind === 'dragon' && !isKnight) continue;

      const dist = Phaser.Math.Distance.Between(
        fighter.sprite.x,
        fighter.sprite.y,
        monster.sprite.x,
        monster.sprite.y
      );

      if (isArcher) {
        if (dist > this.archerRange(fighter.sprite.x, fighter.sprite.y, fighter.data.onWall)) {
          continue;
        }
        let dmg =
          fighter.data.role === 'elite_archer'
            ? CombatBalance.eliteArcherRanged
            : CombatBalance.archerRanged;
        dmg *= dmgMult * 0.75;
        this.vfx?.projectileArc(
          fighter.sprite.x,
          fighter.sprite.y - 10,
          monster.sprite.x,
          monster.sprite.y - 8,
          'arrow',
          () => {
            this.monsters?.damageMonster(monster.id, dmg);
          }
        );
        continue;
      }

      if (dist > CombatBalance.guardRange) {
        this.subjects.nudgeToward(
          fighter.data.id,
          monster.sprite.x,
          monster.sprite.y,
          55
        );
        continue;
      }
      const base =
        fighter.data.role === 'knight'
          ? CombatBalance.knightMelee
          : fighter.data.role === 'elite_guard'
            ? CombatBalance.eliteGuardMelee
            : CombatBalance.guardMelee;
      this.vfx?.meleeLunge(fighter.sprite, monster.sprite.x, monster.sprite.y);
      const dead = this.monsters.damageMonster(monster.id, base * dmgMult);
      if (dead) {
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${fighter.data.name} slew ${monster.name}`,
        });
      }
    }
  }

  /** Military engage wandering living-camp garrison members (bandits/thieves/gypsies) on sight. */
  private tickMilitaryVsCampHostiles(): void {
    const dmgMult = this.dmgMult();

    for (const fighter of this.subjects.combatants()) {
      const isArcher =
        fighter.data.role === 'archer' || fighter.data.role === 'elite_archer';
      const range = isArcher
        ? this.archerRange(fighter.sprite.x, fighter.sprite.y, fighter.data.onWall)
        : CombatBalance.aggroRadius;
      const hostile = this.subjects.nearestCampHostile(
        fighter.sprite.x,
        fighter.sprite.y,
        range
      );
      if (!hostile) continue;

      const dist = Phaser.Math.Distance.Between(
        fighter.sprite.x,
        fighter.sprite.y,
        hostile.sprite.x,
        hostile.sprite.y
      );

      if (isArcher) {
        if (dist > range) continue;
        let dmg =
          fighter.data.role === 'elite_archer'
            ? CombatBalance.eliteArcherRanged
            : CombatBalance.archerRanged;
        if (fighter.data.onWall) dmg *= CombatBalance.archerWallDamageMult;
        dmg *= dmgMult;
        const targetId = hostile.data.id;
        this.vfx?.projectileArc(
          fighter.sprite.x,
          fighter.sprite.y - 10,
          hostile.sprite.x,
          hostile.sprite.y - 8,
          'arrow',
          () => {
            this.subjects.damageSubject(targetId, dmg);
          }
        );
        continue;
      }

      if (dist > CombatBalance.guardRange) {
        this.subjects.nudgeToward(
          fighter.data.id,
          hostile.sprite.x,
          hostile.sprite.y,
          55
        );
        continue;
      }
      const base =
        fighter.data.role === 'knight'
          ? CombatBalance.knightMelee
          : fighter.data.role === 'elite_guard'
            ? CombatBalance.eliteGuardMelee
            : CombatBalance.guardMelee;
      this.vfx?.meleeLunge(fighter.sprite, hostile.sprite.x, hostile.sprite.y);
      this.vfx?.hitFlash(hostile.sprite);
      this.subjects.playSlashAnim(fighter.data.id);
      this.subjects.damageSubject(hostile.data.id, base * dmgMult);
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

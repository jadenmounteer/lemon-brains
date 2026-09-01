import Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { FORT_TILE, fortSnap } from '../buildings/buildingShared';
import { SiegeBalance } from '../siege/balance';
import type { SiegeLadderPortal } from '../path/WallPathGrid';
import type { KeepPoint } from './raidTypes';

export interface SiegeLadderRecord {
  id: string;
  groundX: number;
  groundY: number;
  wallId: string;
  wallX: number;
  wallY: number;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Rectangle;
}

/** Deployable siege ladders at a breach — ground portal to wall-top. */
export class SiegeLadderSystem {
  private ladders: SiegeLadderRecord[] = [];
  private nextId = 0;
  private deployAccumMs = 0;
  private deployed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  reset(): void {
    for (const l of this.ladders) l.sprite.destroy();
    this.ladders = [];
    this.deployAccumMs = 0;
    this.deployed = false;
  }

  get active(): readonly SiegeLadderRecord[] {
    return this.ladders;
  }

  isDeployed(): boolean {
    return this.deployed;
  }

  /** Advance deploy timer during siege reduce phase. Returns true when a ladder appears. */
  tickDeploy(
    deltaMs: number,
    phase: string,
    breach: KeepPoint | null,
    buildings: BuildingSystem | null
  ): boolean {
    if (phase !== 'reduce' || !breach || !buildings || this.deployed) return false;
    this.deployAccumMs += deltaMs;
    if (this.deployAccumMs < SiegeBalance.ladderDeployMs) return false;
    return this.deployAt(breach.x, breach.y, buildings);
  }

  deployAt(
    breachX: number,
    breachY: number,
    buildings: BuildingSystem
  ): boolean {
    if (this.deployed) return false;
    const fort = buildings.nearestFortification(breachX, breachY, 120);
    if (!fort || fort.kind !== 'wall') return false;

    const dx = fort.x - breachX;
    const dy = fort.y - breachY;
    const len = Math.hypot(dx, dy) || 1;
    const groundX = fortSnap(fort.x - (dx / len) * FORT_TILE);
    const groundY = fortSnap(fort.y - (dy / len) * FORT_TILE);

    const id = `ladder-${this.nextId++}`;
    const sprite = this.scene.add
      .rectangle(groundX, groundY - 6, 6, 22, 0x6b4a2e, 0.95)
      .setDepth(18)
      .setOrigin(0.5, 1);
    const maxHp = SiegeBalance.ladderHp;
    this.ladders.push({
      id,
      groundX,
      groundY,
      wallId: fort.id,
      wallX: fort.x,
      wallY: fort.y,
      hp: maxHp,
      maxHp,
      sprite,
    });
    this.deployed = true;
    return true;
  }

  nearestLadder(x: number, y: number, radius = 36): SiegeLadderRecord | null {
    let best: SiegeLadderRecord | null = null;
    let bestD = radius;
    for (const l of this.ladders) {
      if (l.hp <= 0) continue;
      const d = Math.hypot(l.groundX - x, l.groundY - y);
      if (d <= bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  damage(id: string, amount: number): boolean {
    const l = this.ladders.find((x) => x.id === id);
    if (!l || l.hp <= 0) return false;
    l.hp = Math.max(0, l.hp - amount);
    l.sprite.setAlpha(l.hp / l.maxHp);
    if (l.hp <= 0) {
      l.sprite.destroy();
      return true;
    }
    return false;
  }

  toPortals(): SiegeLadderPortal[] {
    return this.ladders
      .filter((l) => l.hp > 0)
      .map((l) => ({
        ladderId: l.id,
        groundX: l.groundX,
        groundY: l.groundY,
        wallId: l.wallId,
        wallX: l.wallX,
        wallY: l.wallY,
      }));
  }
}

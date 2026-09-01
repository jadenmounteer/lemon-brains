import Phaser from 'phaser';
import type { PathGrid } from '../path/PathGrid';
import type { ActiveRaider, RaidMovementHost } from './raidTypes';

/** Pathfinding helpers for raider movement around terrain and walls. */
export class RaidMovement {
  constructor(
    private readonly host: RaidMovementHost,
    private readonly pathGrid: () => PathGrid | null
  ) {}

  repathTo(raider: ActiveRaider, goalX: number, goalY: number): void {
    const grid = this.pathGrid();
    if (!grid) {
      raider.path = [{ x: goalX, y: goalY }];
      raider.pathIndex = 0;
      return;
    }
    this.host.unstickRaider(raider);
    const goal = grid.snapWorldToOpen(goalX, goalY);
    let from = { x: raider.sprite.x, y: raider.sprite.y };
    let path = grid.findPath(from, goal);
    if (!path || path.length === 0) {
      const exit = grid.escapeLandPocket(from);
      if (exit && Math.hypot(exit.x - from.x, exit.y - from.y) > 4) {
        raider.sprite.setPosition(exit.x, exit.y);
        raider.sprite.setDepth(25 + exit.y * 0.01);
        from = exit;
        path = grid.findPath(from, goal);
      }
    }
    raider.path = path ?? [];
    raider.pathIndex = 0;
  }

  repath(raider: ActiveRaider, keepX: number, keepY: number): void {
    this.repathTo(raider, keepX, keepY + 20);
  }

  followPathTo(
    raider: ActiveRaider,
    goalX: number,
    goalY: number,
    deltaMs: number
  ): void {
    this.host.unstickRaider(raider);
    const goalDist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      goalX,
      goalY
    );
    if (goalDist < 16) {
      this.host.stepToward(raider, goalX, goalY, deltaMs);
      return;
    }

    const needRepath =
      !raider.path.length ||
      raider.pathIndex >= raider.path.length ||
      Phaser.Math.Distance.Between(
        raider.path[raider.path.length - 1]!.x,
        raider.path[raider.path.length - 1]!.y,
        goalX,
        goalY
      ) > 48;

    if (needRepath) {
      this.repathTo(raider, goalX, goalY);
    }

    const grid = this.pathGrid();
    if (!raider.path.length) {
      if (grid) {
        const exit = grid.escapeLandPocket({
          x: raider.sprite.x,
          y: raider.sprite.y,
        });
        if (exit) {
          this.host.stepToward(raider, exit.x, exit.y, deltaMs);
          return;
        }
      }
      this.host.stepToward(raider, goalX, goalY, deltaMs);
      return;
    }

    while (raider.pathIndex < raider.path.length) {
      const wp = raider.path[raider.pathIndex]!;
      const wd = Phaser.Math.Distance.Between(
        raider.sprite.x,
        raider.sprite.y,
        wp.x,
        wp.y
      );
      if (wd < 12) {
        raider.pathIndex += 1;
        continue;
      }
      this.host.stepToward(raider, wp.x, wp.y, deltaMs);
      if (
        grid?.isWorldBlocked(
          raider.sprite.x + (wp.x - raider.sprite.x) * 0.15,
          raider.sprite.y + (wp.y - raider.sprite.y) * 0.15
        )
      ) {
        raider.path = [];
        raider.pathIndex = 0;
      }
      return;
    }

    raider.path = [];
    raider.pathIndex = 0;
  }
}

import { describe, expect, it } from 'vitest';
import { WallPathGrid } from '../WallPathGrid';
import { FORT_TILE, fortCenter } from '../../buildings/buildingShared';

describe('WallPathGrid', () => {
  it('paths along an L-shaped wall', () => {
    const grid = new WallPathGrid();
    const ax = fortCenter(2);
    const ay = fortCenter(2);
    const bx = fortCenter(3);
    const by = fortCenter(2);
    const cx = fortCenter(3);
    const cy = fortCenter(3);

    grid.rebuild({
      walls: [
        { id: 'w1', x: ax, y: ay, kind: 'wall' },
        { id: 'w2', x: bx, y: by, kind: 'wall' },
        { id: 'w3', x: cx, y: cy, kind: 'wall' },
      ],
      wallLadders: [],
    });

    const path = grid.findWallPath(ax, ay, cx, cy);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    expect(path![0]).toEqual({ x: ax, y: ay });
    expect(path![2]).toEqual({ x: cx, y: cy });
  });

  it('ladder portal round-trip links ground and wall-top', () => {
    const grid = new WallPathGrid();
    const wx = fortCenter(5);
    const wy = fortCenter(5);
    const groundX = wx;
    const groundY = wy + FORT_TILE;

    grid.rebuild({
      walls: [{ id: 'wall-a', x: wx, y: wy, kind: 'wall' }],
      wallLadders: [
        {
          id: 'ladder-a',
          attachedWallId: 'wall-a',
          groundX,
          groundY,
        },
      ],
    });

    const trip = grid.portalRoundTrip('ladder-a');
    expect(trip).not.toBeNull();
    expect(trip!.up[0]).toEqual({ x: groundX, y: groundY });
    expect(trip!.up[1]).toEqual({ x: wx, y: wy - 10 });
    expect(trip!.down[0]).toEqual({ x: wx, y: wy - 10 });
    expect(trip!.down[1]).toEqual({ x: groundX, y: groundY });
  });

  it('finds nearest climb portal from ground position', () => {
    const grid = new WallPathGrid();
    const wx = fortCenter(1);
    const wy = fortCenter(1);
    const groundX = wx;
    const groundY = wy + FORT_TILE;

    grid.rebuild({
      walls: [{ id: 'w', x: wx, y: wy, kind: 'wall' }],
      wallLadders: [
        {
          id: 'l',
          attachedWallId: 'w',
          groundX,
          groundY,
        },
      ],
    });

    const portal = grid.climbPortalNear(groundX, groundY, 64);
    expect(portal?.climbId).toBe('l');
    expect(portal?.wallId).toBe('w');
  });

  it('corner walls expose implicit climb portals on exterior cells', () => {
    const grid = new WallPathGrid();
    const ax = fortCenter(2);
    const ay = fortCenter(2);
    const bx = fortCenter(3);
    const by = fortCenter(2);
    const cx = fortCenter(3);
    const cy = fortCenter(3);

    grid.rebuild({
      walls: [
        { id: 'w1', x: ax, y: ay, kind: 'wall', neighborMask: 2 },
        { id: 'w2', x: bx, y: by, kind: 'wall', neighborMask: 12 },
        { id: 'w3', x: cx, y: cy, kind: 'wall', neighborMask: 1 },
      ],
      wallLadders: [],
    });

    const southGround = { x: bx, y: by + FORT_TILE };
    const portal = grid.climbPortalNear(southGround.x, southGround.y, 64);
    expect(portal).not.toBeNull();
    expect(portal!.wallId).toBe('w2');
    expect(portal!.climbId).toContain('corner-w2');
  });
});

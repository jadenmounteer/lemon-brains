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
      stairs: [],
    });

    const path = grid.findWallPath(ax, ay, cx, cy);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    expect(path![0]).toEqual({ x: ax, y: ay });
    expect(path![2]).toEqual({ x: cx, y: cy });
  });

  it('stairs portal round-trip links ground and wall-top', () => {
    const grid = new WallPathGrid();
    const wx = fortCenter(5);
    const wy = fortCenter(5);
    const sx = wx;
    const sy = wy + FORT_TILE;

    grid.rebuild({
      walls: [{ id: 'wall-a', x: wx, y: wy, kind: 'wall' }],
      stairs: [
        {
          id: 'stairs-a',
          x: sx,
          y: sy,
          attachedWallId: 'wall-a',
        },
      ],
    });

    const trip = grid.portalRoundTrip('stairs-a');
    expect(trip).not.toBeNull();
    expect(trip!.up[0]).toEqual({ x: sx, y: sy });
    expect(trip!.up[1]).toEqual({ x: wx, y: wy - 10 });
    expect(trip!.down[0]).toEqual({ x: wx, y: wy - 10 });
    expect(trip!.down[1]).toEqual({ x: sx, y: sy });
  });

  it('finds nearest stairs portal from ground position', () => {
    const grid = new WallPathGrid();
    const wx = fortCenter(1);
    const wy = fortCenter(1);
    const sx = wx;
    const sy = wy + FORT_TILE;

    grid.rebuild({
      walls: [{ id: 'w', x: wx, y: wy, kind: 'wall' }],
      stairs: [
        { id: 's', x: sx, y: sy, attachedWallId: 'w' },
      ],
    });

    const portal = grid.stairsPortalNear(sx, sy, 64);
    expect(portal?.stairsId).toBe('s');
    expect(portal?.wallId).toBe('w');
  });
});

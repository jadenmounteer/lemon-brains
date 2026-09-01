import Phaser from 'phaser';
import {
  FORT_TILE,
  isWallCornerMask,
} from '../buildings/buildingShared';
import { bakedWallTextureKey } from './assetManifest';
import { palette } from './palette';

type Ctx = CanvasRenderingContext2D;

export const WALL_SPRITE_W = FORT_TILE;
export const WALL_SPRITE_H = FORT_TILE * 2;
export const WALKWAY_Y = 46;
export const WALKWAY_X = 24;
export const WALKWAY_THICK = 4;
const WALKWAY_COLOR = 0x9a9f94;

export type WallOrientation = 'horizontal' | 'vertical' | 'corner';

export interface WallBakeSpec {
  mask: number;
  col: number;
  row: number;
}

export interface WalkwayRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function fillRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number
) {
  ctx.fillStyle = hex(color);
  ctx.fillRect(x, y, w, h);
}

/** Staggered stone brick fill with world-phase offset for seam alignment. */
export function fillStoneBricks(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  brickW = 10,
  brickH = 6,
  phaseX = 0,
  phaseY = 0
) {
  fillRect(ctx, x, y, w, h, palette.stoneDark);
  for (let row = 0; row < h; row += brickH) {
    const worldRow = y + row + phaseY;
    const offset =
      (Math.floor(worldRow / brickH) % 2) * Math.floor(brickW / 2);
    for (let col = -brickW; col < w + brickW; col += brickW) {
      const bx = x + col + offset - (phaseX % brickW);
      const tone =
        (col + row) % (brickW * 2) < brickW ? palette.stone : palette.stoneDark;
      fillRect(ctx, bx, y + row, brickW - 1, brickH - 1, tone);
    }
  }
}

export function wallOrientation(mask: number): WallOrientation {
  if (isWallCornerMask(mask)) return 'corner';
  const hasE = Boolean(mask & 2);
  const hasW = Boolean(mask & 8);
  const hasN = Boolean(mask & 1);
  const hasS = Boolean(mask & 4);
  const hCount = (hasE ? 1 : 0) + (hasW ? 1 : 0);
  const vCount = (hasN ? 1 : 0) + (hasS ? 1 : 0);
  if (hCount > vCount) return 'horizontal';
  if (vCount > hCount) return 'vertical';
  if (hasE || hasW) return 'horizontal';
  return 'vertical';
}

/** Walkway band rects in sprite-local coords — world-aligned across fort cells. */
export function walkwayLineSpec(
  orient: WallOrientation,
  mask: number,
  w: number,
  h: number
): WalkwayRect[] {
  const pad = 4;
  const coreW = w - pad * 2;
  const t = WALKWAY_THICK;

  if (orient === 'horizontal') {
    return [{ x: pad + 2, y: WALKWAY_Y, w: coreW - 4, h: t }];
  }
  if (orient === 'vertical') {
    return [{ x: WALKWAY_X - t / 2, y: pad + 8, w: t, h: h - pad * 2 - 16 }];
  }
  // L-shaped walkway at corners
  const rects: WalkwayRect[] = [];
  if (mask === 3) {
    rects.push({ x: pad + 2, y: WALKWAY_Y, w: coreW - 8, h: t });
    rects.push({ x: WALKWAY_X - t / 2, y: pad + 8, w: t, h: WALKWAY_Y - pad });
  } else if (mask === 6) {
    rects.push({ x: pad + 2, y: WALKWAY_Y, w: coreW - 8, h: t });
    rects.push({ x: WALKWAY_X - t / 2, y: WALKWAY_Y, w: t, h: h - WALKWAY_Y - pad });
  } else if (mask === 12) {
    rects.push({ x: pad + 10, y: WALKWAY_Y, w: coreW - 8, h: t });
    rects.push({ x: WALKWAY_X - t / 2, y: WALKWAY_Y, w: t, h: h - WALKWAY_Y - pad });
  } else if (mask === 9) {
    rects.push({ x: pad + 10, y: WALKWAY_Y, w: coreW - 8, h: t });
    rects.push({ x: WALKWAY_X - t / 2, y: pad + 8, w: t, h: WALKWAY_Y - pad });
  }
  return rects;
}

/** World Y of horizontal walkway center for a wall at fort row. */
export function horizontalWalkwayWorldY(wallCenterY: number): number {
  return wallCenterY - WALL_SPRITE_H * 0.75 + WALKWAY_Y + WALKWAY_THICK / 2;
}

/** World X of vertical walkway center for a wall at fort column. */
export function verticalWalkwayWorldX(wallCenterX: number): number {
  return wallCenterX - WALL_SPRITE_W / 2 + WALKWAY_X + WALKWAY_THICK / 2;
}

function drawWalkway(ctx: Ctx, rects: WalkwayRect[]) {
  for (const r of rects) {
    fillRect(ctx, r.x, r.y, r.w, r.h, WALKWAY_COLOR);
  }
}

function drawNeighborStubs(ctx: Ctx, mask: number, w: number, h: number) {
  const pad = 4;
  const coreW = w - pad * 2;
  if (mask & 1) fillRect(ctx, pad + 2, 0, coreW - 4, h * 0.36, palette.stone);
  if (mask & 4) fillRect(ctx, pad + 2, h * 0.84, coreW - 4, h * 0.16, palette.stone);
  if (mask & 2) fillRect(ctx, w - pad - 8, h * 0.34, 10, h * 0.54, palette.stone);
  if (mask & 8) fillRect(ctx, pad - 2, h * 0.34, 10, h * 0.54, palette.stone);
}

function drawMerlonsHorizontal(ctx: Ctx, w: number, h: number) {
  const pad = 4;
  const coreW = w - pad * 2;
  for (let i = 0; i < 3; i++) {
    const mx = pad + 6 + i * (coreW / 3);
    fillRect(ctx, mx, h * 0.18, coreW / 4 - 4, h * 0.12, palette.stone);
    fillRect(ctx, mx, h * 0.18, coreW / 4 - 4, 2, palette.ink);
  }
}

function drawMerlonsVertical(ctx: Ctx, w: number, h: number) {
  const pad = 4;
  const coreH = h - pad * 2 - 16;
  for (let i = 0; i < 3; i++) {
    const my = pad + 10 + i * (coreH / 3);
    fillRect(ctx, w * 0.16, my, w * 0.12, coreH / 4 - 4, palette.stone);
    fillRect(ctx, w * 0.16, my, 2, coreH / 4 - 4, palette.ink);
  }
}

function drawMerlonsCorner(ctx: Ctx, mask: number, w: number, h: number) {
  const pad = 4;
  if (mask === 3 || mask === 6) {
    for (let i = 0; i < 2; i++) {
      fillRect(ctx, pad + 8 + i * 14, h * 0.16, 12, h * 0.1, palette.stone);
      fillRect(ctx, pad + 8 + i * 14, h * 0.16, 12, 2, palette.ink);
    }
    for (let i = 0; i < 2; i++) {
      fillRect(ctx, w * 0.14, pad + 8 + i * 14, w * 0.1, 12, palette.stone);
      fillRect(ctx, w * 0.14, pad + 8 + i * 14, 2, 12, palette.ink);
    }
  } else {
    for (let i = 0; i < 2; i++) {
      fillRect(ctx, pad + 10 + i * 14, h * 0.16, 12, h * 0.1, palette.stone);
      fillRect(ctx, pad + 10 + i * 14, h * 0.16, 12, 2, palette.ink);
    }
    for (let i = 0; i < 2; i++) {
      fillRect(ctx, w * 0.72, pad + 8 + i * 14, w * 0.1, 12, palette.stone);
      fillRect(ctx, w * 0.72, pad + 8 + i * 14, 2, 12, palette.ink);
    }
  }
}

function drawCornerRamp(
  ctx: Ctx,
  x: number,
  y: number,
  along: 'horizontal' | 'vertical',
  outward: boolean
) {
  const tread = palette.stone;
  const lip = WALKWAY_COLOR;
  for (let i = 0; i < 2; i++) {
    const inset = i * 3;
    if (along === 'horizontal') {
      const stepW = 14 - inset * 2;
      const stepX = x + inset;
      const stepY = outward ? y + i * 5 : y - i * 5 - 4;
      fillRect(ctx, stepX, stepY, stepW, 4, tread);
      fillRect(ctx, stepX, stepY, stepW, 1, lip);
    } else {
      const stepH = 14 - inset * 2;
      const stepY = y + inset;
      const stepX = outward ? x + i * 5 : x - i * 5 - 4;
      fillRect(ctx, stepX, stepY, 4, stepH, tread);
      fillRect(ctx, stepX, stepY, 1, stepH, lip);
    }
  }
}

function drawCornerTower(
  ctx: Ctx,
  mask: number,
  w: number,
  h: number,
  phaseX: number,
  phaseY: number,
  walkways: WalkwayRect[]
) {
  const pad = 4;
  const turret = 32;
  const turretH = 36;

  if (mask === 3) {
    fillStoneBricks(ctx, w - pad - turret, 4, turret, turretH, 10, 6, phaseX, phaseY);
    fillRect(ctx, w - pad - turret, 2, turret, 4, palette.stone);
    drawCornerRamp(ctx, pad + 6, h - 24, 'horizontal', true);
    drawCornerRamp(ctx, pad + 2, h * 0.5, 'vertical', false);
  } else if (mask === 6) {
    fillStoneBricks(ctx, w - pad - turret, 4, turret, turretH, 10, 6, phaseX, phaseY);
    fillRect(ctx, w - pad - turret, 2, turret, 4, palette.stone);
    drawCornerRamp(ctx, pad + 6, pad + 12, 'horizontal', false);
    drawCornerRamp(ctx, pad + 2, h * 0.5, 'vertical', false);
  } else if (mask === 12) {
    fillStoneBricks(ctx, pad, 4, turret, turretH, 10, 6, phaseX, phaseY);
    fillRect(ctx, pad, 2, turret, 4, palette.stone);
    drawCornerRamp(ctx, pad + 8, h - 24, 'horizontal', true);
    drawCornerRamp(ctx, w - pad - 20, h * 0.5, 'vertical', true);
  } else if (mask === 9) {
    fillStoneBricks(ctx, pad, 4, turret, turretH, 10, 6, phaseX, phaseY);
    fillRect(ctx, pad, 2, turret, 4, palette.stone);
    drawCornerRamp(ctx, pad + 8, h - 24, 'horizontal', true);
    drawCornerRamp(ctx, w - pad - 20, h * 0.5, 'vertical', true);
  }

  drawMerlonsCorner(ctx, mask, w, h);
  drawWalkway(ctx, walkways);
  fillRect(ctx, pad, h * 0.32, 3, h * 0.58, palette.stoneDark);
  fillRect(ctx, w - pad - 3, h * 0.32, 3, h * 0.58, palette.stoneDark);
}

function drawWallSegment(ctx: Ctx, spec: WallBakeSpec) {
  const { mask, col, row } = spec;
  const w = WALL_SPRITE_W;
  const h = WALL_SPRITE_H;
  const pad = 4;
  const coreW = w - pad * 2;
  const phaseX = col * FORT_TILE;
  const phaseY = row * FORT_TILE;
  const orient = wallOrientation(mask);
  const walkways = walkwayLineSpec(orient, mask, w, h);

  fillRect(ctx, pad, h * 0.32, coreW, h * 0.58, palette.stone);
  fillRect(ctx, pad, h * 0.32, coreW, 2, palette.ink);
  drawNeighborStubs(ctx, mask, w, h);

  fillStoneBricks(ctx, pad, h * 0.14, coreW, h * 0.2, 10, 6, phaseX, phaseY);

  if (orient === 'corner') {
    drawCornerTower(ctx, mask, w, h, phaseX, phaseY, walkways);
  } else {
    if (orient === 'horizontal') {
      drawMerlonsHorizontal(ctx, w, h);
    } else {
      drawMerlonsVertical(ctx, w, h);
    }
    drawWalkway(ctx, walkways);
    fillRect(ctx, pad, h * 0.32, 3, h * 0.58, palette.stoneDark);
    fillRect(ctx, w - pad - 3, h * 0.32, 3, h * 0.58, palette.stoneDark);
  }
}

function createCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) {
    throw new Error(`Failed to create canvas texture: ${key}`);
  }
  return tex;
}

/** Draw into an existing canvas texture (boot-time fallbacks). */
export function drawWallToTexture(
  tex: Phaser.Textures.CanvasTexture,
  spec: WallBakeSpec
): void {
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, WALL_SPRITE_W, WALL_SPRITE_H);
  drawWallSegment(ctx, spec);
  tex.refresh();
}

/** Draw a baked wall texture and return its cache key. */
export function bakeWallTexture(scene: Phaser.Scene, spec: WallBakeSpec): string {
  const key = bakedWallTextureKey(spec);
  if (scene.textures.exists(key)) {
    return key;
  }
  const tex = createCanvas(scene, key, WALL_SPRITE_W, WALL_SPRITE_H);
  drawWallToTexture(tex, spec);
  return key;
}

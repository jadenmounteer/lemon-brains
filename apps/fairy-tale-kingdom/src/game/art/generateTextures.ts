import Phaser from 'phaser';
import {
  ENEMY_ROLES,
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  UNIT_FRAME_COUNT,
  UNIT_HEIGHT,
  UNIT_ROLES,
  UNIT_WIDTH,
  type AnimRole,
} from './assetManifest';
import { palette } from './palette';

type Ctx = CanvasRenderingContext2D;

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

function pixel(ctx: Ctx, x: number, y: number, color: number) {
  fillRect(ctx, x, y, 1, 1, color);
}

function createCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number
): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) {
    throw new Error(`Failed to create canvas texture: ${key}`);
  }
  return tex;
}

function drawTerrain(scene: Phaser.Scene) {
  const width = TILE_SIZE * 4;
  const height = TILE_SIZE;
  const tex = createCanvas(scene, TERRAIN_KEY, width, height);
  const ctx = tex.getContext();

  // 0 grass
  fillRect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, palette.grass);
  for (let i = 0; i < 8; i++) {
    pixel(ctx, 2 + ((i * 3) % 14), 3 + ((i * 5) % 12), palette.grassLight);
  }

  // 1 grass alt
  fillRect(ctx, TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, palette.grass);
  for (let i = 0; i < 6; i++) {
    pixel(
      ctx,
      TILE_SIZE + 1 + ((i * 4) % 14),
      2 + ((i * 7) % 13),
      palette.grassDark
    );
  }

  // 2 dirt
  fillRect(ctx, TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE, palette.dirt);
  for (let i = 0; i < 5; i++) {
    pixel(
      ctx,
      TILE_SIZE * 2 + 2 + i * 2,
      4 + (i % 3) * 3,
      palette.dirtDark
    );
  }

  // 3 dirt edge (dirt with grass fringe)
  fillRect(ctx, TILE_SIZE * 3, 0, TILE_SIZE, TILE_SIZE, palette.dirt);
  fillRect(ctx, TILE_SIZE * 3, 0, TILE_SIZE, 3, palette.grass);
  fillRect(ctx, TILE_SIZE * 3, TILE_SIZE - 3, TILE_SIZE, 3, palette.grass);

  tex.refresh();
}

function clothFor(role: AnimRole): number {
  switch (role) {
    case 'peasant':
      return palette.clothPeasant;
    case 'guard':
      return palette.clothGuard;
    case 'archer':
      return palette.clothArcher;
    case 'bandit':
      return palette.clothBandit;
    case 'giant':
      return palette.clothGiant;
    case 'enemy_army':
      return palette.clothEnemyArmy;
  }
}

/** Walk cycle: small vertical bob + leg offset per frame (0–3). */
function drawUnitFrame(
  ctx: Ctx,
  originX: number,
  role: AnimRole,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const baseY = bob;
  const cloth = clothFor(role);
  const tall = role === 'giant' ? -2 : 0;

  fillRect(ctx, originX + 4, 21, 8, 2, palette.ink);

  const leftBootX = originX + 5 - (facing === 'right' ? 0 : leg);
  const rightBootX = originX + 9 + (facing === 'left' ? 0 : leg);
  fillRect(ctx, leftBootX, 18 + baseY, 3, 3, palette.ink);
  fillRect(ctx, rightBootX, 18 + baseY, 3, 3, palette.ink);

  fillRect(ctx, originX + 5, 10 + baseY + tall, 6, 8 - tall, cloth);
  fillRect(ctx, originX + 4, 10 + baseY + tall, 1, 8 - tall, palette.ink);
  fillRect(ctx, originX + 11, 10 + baseY + tall, 1, 8 - tall, palette.ink);

  fillRect(ctx, originX + 5, 4 + baseY + tall, 6, 6, palette.skin);
  fillRect(ctx, originX + 4, 4 + baseY + tall, 1, 6, palette.ink);
  fillRect(ctx, originX + 11, 4 + baseY + tall, 1, 6, palette.ink);
  fillRect(ctx, originX + 5, 3 + baseY + tall, 6, 1, palette.ink);

  if (role === 'guard' || role === 'enemy_army') {
    fillRect(ctx, originX + 5, 3 + baseY + tall, 6, 2, palette.metal);
    fillRect(ctx, originX + 12, 11 + baseY + tall, 2, 6, palette.metal);
  } else if (role === 'archer') {
    fillRect(ctx, originX + 3, 11 + baseY, 1, 7, palette.wood);
    fillRect(ctx, originX + 2, 12 + baseY, 1, 5, palette.woodDark);
  } else if (role === 'bandit') {
    fillRect(ctx, originX + 4, 3 + baseY, 8, 2, palette.ink);
    fillRect(ctx, originX + 12, 12 + baseY, 2, 5, palette.metal);
  } else if (role === 'giant') {
    fillRect(ctx, originX + 4, 2 + baseY + tall, 8, 3, palette.woodDark);
  } else {
    fillRect(ctx, originX + 4, 3 + baseY, 8, 2, palette.wood);
  }

  if (facing === 'left') {
    pixel(ctx, originX + 6, 6 + baseY + tall, palette.ink);
  } else if (facing === 'right') {
    pixel(ctx, originX + 9, 6 + baseY + tall, palette.ink);
  } else if (facing === 'up') {
    fillRect(ctx, originX + 5, 4 + baseY + tall, 6, 2, cloth);
  } else {
    pixel(ctx, originX + 7, 6 + baseY + tall, palette.ink);
    pixel(ctx, originX + 9, 6 + baseY + tall, palette.ink);
  }
}

function drawUnitSheet(scene: Phaser.Scene, role: AnimRole) {
  const width = UNIT_WIDTH * UNIT_FRAME_COUNT;
  const height = UNIT_HEIGHT;
  const tex = createCanvas(scene, role, width, height);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, width, height);

  const facings: Array<'down' | 'left' | 'right' | 'up'> = [
    'down',
    'left',
    'right',
    'up',
  ];

  drawUnitFrame(ctx, 0, role, 'down', null);

  let frame = 1;
  for (const facing of facings) {
    for (let step = 0; step < 4; step++) {
      drawUnitFrame(ctx, frame * UNIT_WIDTH, role, facing, step);
      frame++;
    }
  }

  tex.refresh();

  const sheet = scene.textures.get(role);
  for (let i = 0; i < UNIT_FRAME_COUNT; i++) {
    const name = String(i);
    if (!sheet.has(name)) {
      sheet.add(name, 0, i * UNIT_WIDTH, 0, UNIT_WIDTH, UNIT_HEIGHT);
    }
  }
}

function drawKeep(scene: Phaser.Scene) {
  const w = 48;
  const h = 48;
  const tex = createCanvas(scene, PROP_KEYS.keep, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 16, 40, 28, palette.stone);
  fillRect(ctx, 4, 16, 40, 2, palette.ink);
  fillRect(ctx, 4, 16, 2, 28, palette.ink);
  fillRect(ctx, 42, 16, 2, 28, palette.ink);
  for (let i = 0; i < 5; i++) {
    fillRect(ctx, 6 + i * 8, 8, 6, 10, palette.stone);
    fillRect(ctx, 6 + i * 8, 8, 6, 1, palette.ink);
  }
  fillRect(ctx, 20, 32, 8, 12, palette.woodDark);
  fillRect(ctx, 12, 24, 4, 4, palette.cream);
  fillRect(ctx, 32, 24, 4, 4, palette.cream);
  tex.refresh();
}

function drawHouse(scene: Phaser.Scene) {
  const w = 32;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.house, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 14, 24, 16, palette.wood);
  fillRect(ctx, 4, 14, 24, 1, palette.ink);
  for (let row = 0; row < 8; row++) {
    fillRect(ctx, 4 + row, 6 + row, 24 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 13, 22, 6, 8, palette.woodDark);
  pixel(ctx, 8, 18, palette.cream);
  tex.refresh();
}

function drawWall(scene: Phaser.Scene) {
  const w = 16;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.wall, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 4, 12, 26, palette.stone);
  fillRect(ctx, 2, 4, 12, 1, palette.ink);
  fillRect(ctx, 2, 4, 1, 26, palette.stoneDark);
  fillRect(ctx, 4, 0, 3, 6, palette.stone);
  fillRect(ctx, 9, 0, 3, 6, palette.stone);
  tex.refresh();
}

/**
 * Generate all Phase 1 textures into the scene texture manager.
 * Keys match assetManifest / future PNG drop-ins.
 */
export function generateTextures(scene: Phaser.Scene): void {
  for (const key of [
    TERRAIN_KEY,
    ...UNIT_ROLES,
    ...ENEMY_ROLES,
    PROP_KEYS.keep,
    PROP_KEYS.house,
    PROP_KEYS.wall,
  ]) {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  }

  drawTerrain(scene);
  for (const role of UNIT_ROLES) {
    drawUnitSheet(scene, role);
  }
  for (const role of ENEMY_ROLES) {
    drawUnitSheet(scene, role);
  }
  drawKeep(scene);
  drawHouse(scene);
  drawWall(scene);

  const terrain = scene.textures.get(TERRAIN_KEY);
  for (let i = 0; i < 4; i++) {
    const name = String(i);
    if (!terrain.has(name)) {
      terrain.add(name, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
    }
  }
}

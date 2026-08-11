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
  wallTextureKey,
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
    case 'elite_guard':
      return palette.clothEliteGuard;
    case 'elite_archer':
      return palette.clothEliteArcher;
    case 'king':
      return palette.clothKing;
    case 'queen':
      return palette.clothQueen;
    case 'prince':
      return palette.clothPrince;
    case 'princess':
      return palette.clothPrincess;
    case 'fairy_godmother':
      return palette.clothFairy;
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

  if (role === 'guard' || role === 'elite_guard' || role === 'enemy_army') {
    fillRect(ctx, originX + 5, 3 + baseY + tall, 6, 2, palette.metal);
    fillRect(ctx, originX + 12, 11 + baseY + tall, 2, 6, palette.metal);
    if (role === 'elite_guard') {
      fillRect(ctx, originX + 6, 4 + baseY + tall, 4, 1, palette.gold);
    }
  } else if (role === 'archer' || role === 'elite_archer') {
    fillRect(ctx, originX + 3, 11 + baseY, 1, 7, palette.wood);
    fillRect(ctx, originX + 2, 12 + baseY, 1, 5, palette.woodDark);
    if (role === 'elite_archer') {
      fillRect(ctx, originX + 5, 3 + baseY, 6, 1, palette.gold);
    }
  } else if (role === 'king' || role === 'queen' || role === 'prince' || role === 'princess') {
    fillRect(ctx, originX + 5, 2 + baseY + tall, 6, 2, palette.gold);
  } else if (role === 'fairy_godmother') {
    fillRect(ctx, originX + 12, 8 + baseY, 2, 8, palette.wood);
    pixel(ctx, originX + 13, 7 + baseY, palette.gold);
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

/** Neighbor bits: N=1 E=2 S=4 W=8 */
function drawWallVariant(scene: Phaser.Scene, mask: number, key: string) {
  const w = 16;
  const h = 32;
  const tex = createCanvas(scene, key, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 8, 8, 20, palette.stone);
  fillRect(ctx, 4, 8, 8, 1, palette.ink);
  if (mask & 1) fillRect(ctx, 5, 0, 6, 10, palette.stone);
  if (mask & 4) fillRect(ctx, 5, 26, 6, 6, palette.stone);
  if (mask & 2) fillRect(ctx, 10, 12, 6, 10, palette.stone);
  if (mask & 8) fillRect(ctx, 0, 12, 6, 10, palette.stone);
  fillRect(ctx, 4, 4, 3, 5, palette.stone);
  fillRect(ctx, 9, 4, 3, 5, palette.stone);
  fillRect(ctx, 4, 8, 1, 20, palette.stoneDark);
  tex.refresh();
}

function drawWall(scene: Phaser.Scene) {
  for (let mask = 0; mask < 16; mask++) {
    drawWallVariant(scene, mask, wallTextureKey(mask));
  }
  drawWallVariant(scene, 0, PROP_KEYS.wall);
}

function drawBallista(scene: Phaser.Scene) {
  const w = 24;
  const h = 20;
  const tex = createCanvas(scene, PROP_KEYS.ballista, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 12, 16, 6, palette.wood);
  fillRect(ctx, 10, 4, 4, 12, palette.woodDark);
  fillRect(ctx, 2, 6, 20, 2, palette.metal);
  fillRect(ctx, 18, 5, 4, 4, palette.metal);
  tex.refresh();
}

function drawWatchtower(scene: Phaser.Scene) {
  const w = 24;
  const h = 40;
  const tex = createCanvas(scene, PROP_KEYS.watchtower, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 14, 12, 24, palette.stone);
  fillRect(ctx, 4, 8, 16, 8, palette.stoneDark);
  fillRect(ctx, 4, 8, 16, 1, palette.ink);
  fillRect(ctx, 8, 18, 3, 3, palette.cream);
  fillRect(ctx, 13, 18, 3, 3, palette.cream);
  fillRect(ctx, 5, 4, 3, 6, palette.stone);
  fillRect(ctx, 16, 4, 3, 6, palette.stone);
  tex.refresh();
}

function drawRam(scene: Phaser.Scene) {
  const w = 28;
  const h = 18;
  const tex = createCanvas(scene, PROP_KEYS.ram, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 8, 20, 6, palette.wood);
  fillRect(ctx, 20, 6, 6, 8, palette.metal);
  fillRect(ctx, 4, 14, 4, 3, palette.woodDark);
  fillRect(ctx, 14, 14, 4, 3, palette.woodDark);
  tex.refresh();
}

function drawCatapult(scene: Phaser.Scene) {
  const w = 28;
  const h = 22;
  const tex = createCanvas(scene, PROP_KEYS.catapult, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 14, 18, 5, palette.wood);
  fillRect(ctx, 12, 4, 3, 12, palette.woodDark);
  fillRect(ctx, 8, 2, 10, 4, palette.wood);
  fillRect(ctx, 6, 18, 4, 3, palette.woodDark);
  fillRect(ctx, 16, 18, 4, 3, palette.woodDark);
  tex.refresh();
}

function drawTrebuchet(scene: Phaser.Scene) {
  const w = 32;
  const h = 28;
  const tex = createCanvas(scene, PROP_KEYS.trebuchet, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 18, 20, 6, palette.wood);
  fillRect(ctx, 14, 2, 3, 20, palette.woodDark);
  fillRect(ctx, 4, 4, 12, 3, palette.wood);
  fillRect(ctx, 2, 6, 4, 4, palette.metal);
  fillRect(ctx, 8, 22, 4, 4, palette.woodDark);
  fillRect(ctx, 20, 22, 4, 4, palette.woodDark);
  tex.refresh();
}

function drawVfx(scene: Phaser.Scene) {
  const flame = createCanvas(scene, PROP_KEYS.flame, 8, 12);
  const fctx = flame.getContext();
  fillRect(fctx, 2, 4, 4, 7, 0xff6622);
  fillRect(fctx, 3, 1, 2, 5, 0xffcc44);
  flame.refresh();

  const smoke = createCanvas(scene, PROP_KEYS.smoke, 8, 8);
  const sctx = smoke.getContext();
  fillRect(sctx, 2, 2, 4, 4, 0x888888);
  fillRect(sctx, 1, 3, 2, 2, 0x666666);
  smoke.refresh();

  const rock = createCanvas(scene, PROP_KEYS.rock, 6, 6);
  const rctx = rock.getContext();
  fillRect(rctx, 1, 1, 4, 4, palette.stoneDark);
  rock.refresh();

  const arrow = createCanvas(scene, PROP_KEYS.arrow, 10, 3);
  const actx = arrow.getContext();
  fillRect(actx, 0, 1, 8, 1, palette.wood);
  fillRect(actx, 7, 0, 3, 3, palette.metal);
  arrow.refresh();

  const bolt = createCanvas(scene, PROP_KEYS.bolt, 12, 3);
  const bctx = bolt.getContext();
  fillRect(bctx, 0, 1, 10, 1, palette.metal);
  fillRect(bctx, 9, 0, 3, 3, palette.metal);
  bolt.refresh();

  const dust = createCanvas(scene, PROP_KEYS.dust, 10, 8);
  const dctx = dust.getContext();
  fillRect(dctx, 2, 3, 6, 3, 0xc4a574);
  fillRect(dctx, 1, 2, 2, 2, 0xa08050);
  dust.refresh();
}

function drawTavern(scene: Phaser.Scene) {
  const w = 36;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.tavern, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 14, 28, 16, palette.wood);
  fillRect(ctx, 4, 14, 28, 1, palette.ink);
  for (let row = 0; row < 8; row++) {
    fillRect(ctx, 4 + row, 6 + row, 28 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 14, 20, 8, 10, palette.woodDark);
  fillRect(ctx, 8, 18, 4, 4, palette.cream);
  fillRect(ctx, 24, 18, 4, 4, palette.cream);
  // mug sign
  fillRect(ctx, 26, 10, 5, 4, palette.gold);
  tex.refresh();
}

function drawDrawbridge(scene: Phaser.Scene) {
  const w = 32;
  const h = 24;
  const open = createCanvas(scene, PROP_KEYS.drawbridge, w, h);
  const octx = open.getContext();
  fillRect(octx, 2, 10, 28, 10, palette.wood);
  fillRect(octx, 2, 10, 28, 1, palette.ink);
  fillRect(octx, 4, 12, 2, 6, palette.woodDark);
  fillRect(octx, 14, 12, 2, 6, palette.woodDark);
  fillRect(octx, 24, 12, 2, 6, palette.woodDark);
  fillRect(octx, 0, 8, 4, 4, palette.metal);
  fillRect(octx, 28, 8, 4, 4, palette.metal);
  open.refresh();

  const closed = createCanvas(scene, PROP_KEYS.drawbridgeClosed, w, h);
  const cctx = closed.getContext();
  fillRect(cctx, 6, 2, 20, 18, palette.wood);
  fillRect(cctx, 6, 2, 20, 1, palette.ink);
  fillRect(cctx, 8, 4, 2, 14, palette.woodDark);
  fillRect(cctx, 15, 4, 2, 14, palette.woodDark);
  fillRect(cctx, 22, 4, 2, 14, palette.woodDark);
  fillRect(cctx, 4, 0, 4, 4, palette.metal);
  fillRect(cctx, 24, 0, 4, 4, palette.metal);
  closed.refresh();
}

function drawStairs(scene: Phaser.Scene) {
  const w = 20;
  const h = 28;
  const tex = createCanvas(scene, PROP_KEYS.stairs, w, h);
  const ctx = tex.getContext();
  for (let i = 0; i < 5; i++) {
    fillRect(ctx, 2 + i, 22 - i * 4, 16 - i * 2, 4, palette.stone);
    fillRect(ctx, 2 + i, 22 - i * 4, 16 - i * 2, 1, palette.ink);
  }
  fillRect(ctx, 8, 0, 4, 4, palette.stoneDark);
  tex.refresh();
}

function drawField(scene: Phaser.Scene) {
  const w = 40;
  const h = 28;
  const tex = createCanvas(scene, PROP_KEYS.field, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 10, 36, 16, palette.dirt);
  for (let i = 0; i < 6; i++) {
    fillRect(ctx, 4 + i * 6, 8, 3, 14, palette.wheat);
    fillRect(ctx, 4 + i * 6, 6, 3, 3, palette.wheatDark);
  }
  tex.refresh();
}

function drawGranary(scene: Phaser.Scene) {
  const w = 36;
  const h = 36;
  const tex = createCanvas(scene, PROP_KEYS.granary, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 12, 24, 20, palette.wood);
  fillRect(ctx, 6, 12, 24, 1, palette.ink);
  for (let row = 0; row < 6; row++) {
    fillRect(ctx, 8 + row, 6 + row, 20 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 14, 22, 8, 10, palette.woodDark);
  fillRect(ctx, 22, 16, 6, 6, palette.wheat);
  tex.refresh();
}

function drawBarracks(scene: Phaser.Scene) {
  const w = 40;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.barracks, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 10, 32, 20, palette.stone);
  fillRect(ctx, 4, 10, 32, 1, palette.ink);
  fillRect(ctx, 16, 20, 8, 10, palette.woodDark);
  fillRect(ctx, 8, 14, 4, 4, palette.cream);
  fillRect(ctx, 28, 14, 4, 4, palette.cream);
  fillRect(ctx, 30, 6, 2, 8, palette.metal);
  tex.refresh();
}

function drawManor(scene: Phaser.Scene) {
  const w = 40;
  const h = 36;
  const tex = createCanvas(scene, PROP_KEYS.manor, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 14, 32, 18, palette.stone);
  fillRect(ctx, 4, 14, 32, 1, palette.ink);
  for (let row = 0; row < 8; row++) {
    fillRect(ctx, 4 + row, 6 + row, 32 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 16, 22, 8, 10, palette.woodDark);
  fillRect(ctx, 8, 18, 4, 4, palette.cream);
  fillRect(ctx, 28, 18, 4, 4, palette.cream);
  fillRect(ctx, 18, 8, 4, 4, palette.gold);
  tex.refresh();
}

/**
 * Generate all Phase 1 textures into the scene texture manager.
 * Keys match assetManifest / future PNG drop-ins.
 */
export function generateTextures(scene: Phaser.Scene): void {
  const propKeys = [
    PROP_KEYS.keep,
    PROP_KEYS.house,
    PROP_KEYS.wall,
    PROP_KEYS.tavern,
    PROP_KEYS.drawbridge,
    PROP_KEYS.drawbridgeClosed,
    PROP_KEYS.stairs,
    PROP_KEYS.field,
    PROP_KEYS.granary,
    PROP_KEYS.barracks,
    PROP_KEYS.manor,
    PROP_KEYS.ballista,
    PROP_KEYS.watchtower,
    PROP_KEYS.ram,
    PROP_KEYS.catapult,
    PROP_KEYS.trebuchet,
    PROP_KEYS.flame,
    PROP_KEYS.smoke,
    PROP_KEYS.rock,
    PROP_KEYS.arrow,
    PROP_KEYS.bolt,
    PROP_KEYS.dust,
    ...Array.from({ length: 16 }, (_, i) => wallTextureKey(i)),
  ];
  for (const key of [TERRAIN_KEY, ...UNIT_ROLES, ...ENEMY_ROLES, ...propKeys]) {
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
  drawTavern(scene);
  drawDrawbridge(scene);
  drawStairs(scene);
  drawField(scene);
  drawGranary(scene);
  drawBarracks(scene);
  drawManor(scene);
  drawBallista(scene);
  drawWatchtower(scene);
  drawRam(scene);
  drawCatapult(scene);
  drawTrebuchet(scene);
  drawVfx(scene);

  const terrain = scene.textures.get(TERRAIN_KEY);
  for (let i = 0; i < 4; i++) {
    const name = String(i);
    if (!terrain.has(name)) {
      terrain.add(name, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
    }
  }
}

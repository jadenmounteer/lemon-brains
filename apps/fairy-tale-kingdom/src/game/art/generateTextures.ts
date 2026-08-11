import Phaser from 'phaser';
import {
  ENEMY_ROLES,
  MONSTER_ROLES,
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
  const width = TILE_SIZE * 7;
  const height = TILE_SIZE;
  const tex = createCanvas(scene, TERRAIN_KEY, width, height);
  const ctx = tex.getContext();

  // 0 grass
  fillRect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, palette.grass);
  for (let i = 0; i < 10; i++) {
    pixel(ctx, 1 + ((i * 3) % 14), 2 + ((i * 5) % 13), palette.grassLight);
  }
  pixel(ctx, 7, 9, palette.grassDark);

  // 1 grass alt — denser tufts
  fillRect(ctx, TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, palette.grass);
  for (let i = 0; i < 8; i++) {
    pixel(
      ctx,
      TILE_SIZE + 1 + ((i * 4) % 14),
      1 + ((i * 7) % 14),
      palette.grassDark
    );
  }
  fillRect(ctx, TILE_SIZE + 4, 10, 2, 3, palette.grassLight);
  fillRect(ctx, TILE_SIZE + 10, 5, 2, 3, palette.grassLight);

  // 2 dirt
  fillRect(ctx, TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE, palette.dirt);
  for (let i = 0; i < 7; i++) {
    pixel(
      ctx,
      TILE_SIZE * 2 + 1 + i * 2,
      3 + (i % 4) * 3,
      palette.dirtDark
    );
  }
  fillRect(ctx, TILE_SIZE * 2 + 6, 7, 3, 2, palette.stone);

  // 3 dirt edge
  fillRect(ctx, TILE_SIZE * 3, 0, TILE_SIZE, TILE_SIZE, palette.dirt);
  fillRect(ctx, TILE_SIZE * 3, 0, TILE_SIZE, 3, palette.grass);
  fillRect(ctx, TILE_SIZE * 3, TILE_SIZE - 3, TILE_SIZE, 3, palette.grass);
  fillRect(ctx, TILE_SIZE * 3, 0, 2, TILE_SIZE, palette.grass);
  fillRect(ctx, TILE_SIZE * 3 + 14, 0, 2, TILE_SIZE, palette.grass);

  // 4 water — depth bands + ripples
  fillRect(ctx, TILE_SIZE * 4, 0, TILE_SIZE, TILE_SIZE, palette.water);
  fillRect(ctx, TILE_SIZE * 4, 0, TILE_SIZE, 3, palette.waterLight);
  fillRect(ctx, TILE_SIZE * 4, 12, TILE_SIZE, 4, 0x2a5578);
  for (let i = 0; i < 5; i++) {
    fillRect(
      ctx,
      TILE_SIZE * 4 + 1 + i * 3,
      4 + (i % 3) * 3,
      4,
      1,
      palette.waterLight
    );
  }
  pixel(ctx, TILE_SIZE * 4 + 5, 7, 0xffffff);
  pixel(ctx, TILE_SIZE * 4 + 11, 10, 0xc8e4f4);

  // 5 forest — layered canopy + trunks
  fillRect(ctx, TILE_SIZE * 5, 0, TILE_SIZE, TILE_SIZE, palette.forest);
  fillRect(ctx, TILE_SIZE * 5, 12, TILE_SIZE, 4, palette.forestDark);
  fillRect(ctx, TILE_SIZE * 5 + 2, 9, 3, 6, palette.woodDark);
  fillRect(ctx, TILE_SIZE * 5 + 0, 2, 7, 8, palette.forestDark);
  fillRect(ctx, TILE_SIZE * 5 + 1, 3, 5, 5, palette.grassDark);
  fillRect(ctx, TILE_SIZE * 5 + 9, 10, 3, 5, palette.woodDark);
  fillRect(ctx, TILE_SIZE * 5 + 7, 3, 7, 8, palette.grassDark);
  fillRect(ctx, TILE_SIZE * 5 + 8, 4, 5, 5, palette.forest);
  pixel(ctx, TILE_SIZE * 5 + 3, 4, palette.grassLight);
  pixel(ctx, TILE_SIZE * 5 + 10, 5, palette.grass);
  pixel(ctx, TILE_SIZE * 5 + 5, 7, palette.grassLight);

  // 6 mountain — jagged peaks + snow + cliff face
  fillRect(ctx, TILE_SIZE * 6, 0, TILE_SIZE, TILE_SIZE, palette.mountain);
  fillRect(ctx, TILE_SIZE * 6 + 1, 8, 14, 8, palette.mountainLight);
  fillRect(ctx, TILE_SIZE * 6 + 4, 3, 8, 6, palette.stone);
  fillRect(ctx, TILE_SIZE * 6 + 6, 1, 4, 3, 0xe8eef2);
  fillRect(ctx, TILE_SIZE * 6 + 5, 2, 2, 1, 0xe8eef2);
  fillRect(ctx, TILE_SIZE * 6 + 9, 2, 2, 1, 0xe8eef2);
  fillRect(ctx, TILE_SIZE * 6 + 2, 10, 3, 5, palette.stoneDark);
  fillRect(ctx, TILE_SIZE * 6 + 11, 9, 3, 6, palette.stoneDark);
  pixel(ctx, TILE_SIZE * 6 + 7, 7, palette.ink);
  pixel(ctx, TILE_SIZE * 6 + 8, 8, palette.ink);

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
    case 'goblin':
      return palette.clothGoblin;
    case 'enemy_army':
      return palette.clothEnemyArmy;
    case 'knight':
      return palette.clothKnight;
    case 'general':
      return palette.clothGeneral;
    case 'bishop':
      return palette.clothBishop;
    case 'physician':
      return palette.clothPhysician;
    case 'troll':
      return palette.clothTroll;
    case 'ogre':
      return palette.clothOgre;
    case 'dragon':
      return palette.clothDragon;
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
  if (role === 'troll') {
    drawTrollFrame(ctx, originX, facing, walkStep);
    return;
  }
  if (role === 'ogre') {
    drawOgreFrame(ctx, originX, facing, walkStep);
    return;
  }
  if (role === 'dragon') {
    drawDragonFrame(ctx, originX, facing, walkStep);
    return;
  }
  if (role === 'physician') {
    drawPhysicianFrame(ctx, originX, facing, walkStep);
    return;
  }
  if (role === 'bishop') {
    drawBishopFrame(ctx, originX, facing, walkStep);
    return;
  }

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
  if (role === 'knight') {
    fillRect(ctx, originX + 5, 3 + baseY, 6, 3, palette.metal);
    fillRect(ctx, originX + 11, 12 + baseY, 2, 5, palette.metal);
  }
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
  } else if (role === 'goblin') {
    fillRect(ctx, originX + 4, 3 + baseY, 8, 2, palette.forestDark);
    fillRect(ctx, originX + 12, 11 + baseY, 2, 4, palette.wood);
    pixel(ctx, originX + 4, 5 + baseY, palette.ink);
    pixel(ctx, originX + 11, 5 + baseY, palette.ink);
  } else if (role === 'giant') {
    fillRect(ctx, originX + 4, 2 + baseY + tall, 8, 3, palette.woodDark);
  } else if (role === 'general') {
    fillRect(ctx, originX + 5, 3 + baseY, 6, 2, palette.metal);
    fillRect(ctx, originX + 6, 4 + baseY, 4, 1, palette.gold);
    fillRect(ctx, originX + 12, 11 + baseY, 2, 6, palette.metal);
  } else if (role !== 'knight') {
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

/** Bridge troll: moss-green, stooped, bat ears, bulbous nose, fangs, club. */
function drawTrollFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const y = bob;
  const skin = palette.clothTroll;
  const skinDark = palette.forestDark;
  const moss = 0x5a8f4a;

  fillRect(ctx, originX + 3, 21, 10, 2, palette.ink);
  // bowed legs
  fillRect(ctx, originX + 3 - leg, 16 + y, 4, 5, skinDark);
  fillRect(ctx, originX + 10 + leg, 16 + y, 4, 5, skinDark);
  fillRect(ctx, originX + 3 - leg, 19 + y, 4, 2, moss);
  fillRect(ctx, originX + 10 + leg, 19 + y, 4, 2, moss);

  // hunched, long torso (stooped)
  fillRect(ctx, originX + 3, 8 + y, 10, 9, skin);
  fillRect(ctx, originX + 4, 10 + y, 8, 5, skinDark);
  // mossy back hump
  fillRect(ctx, originX + 5, 7 + y, 6, 3, moss);

  // long dangling arms
  if (facing === 'left') {
    fillRect(ctx, originX + 0, 10 + y, 3, 8, skin);
    fillRect(ctx, originX + 0, 17 + y, 3, 2, skinDark);
    fillRect(ctx, originX + 13, 11 + y, 2, 6, skinDark);
  } else if (facing === 'right') {
    fillRect(ctx, originX + 13, 10 + y, 3, 8, skin);
    fillRect(ctx, originX + 13, 17 + y, 3, 2, skinDark);
    fillRect(ctx, originX + 1, 11 + y, 2, 6, skinDark);
  } else {
    fillRect(ctx, originX + 1, 11 + y, 2, 8, skin);
    fillRect(ctx, originX + 13, 11 + y, 2, 8, skin);
  }

  // oversized head, low on shoulders
  fillRect(ctx, originX + 4, 1 + y, 8, 8, skin);
  // bat ears
  fillRect(ctx, originX + 1, 2 + y, 3, 5, skin);
  fillRect(ctx, originX + 12, 2 + y, 3, 5, skin);
  pixel(ctx, originX + 1, 2 + y, skinDark);
  pixel(ctx, originX + 14, 2 + y, skinDark);
  // heavy brow + bulbous nose
  fillRect(ctx, originX + 5, 3 + y, 6, 2, skinDark);
  fillRect(ctx, originX + 6, 5 + y, 4, 3, 0x2d5a3d);
  pixel(ctx, originX + 7, 6 + y, palette.ink);
  if (facing !== 'up') {
    pixel(ctx, originX + 5, 4 + y, palette.gold);
    pixel(ctx, originX + 10, 4 + y, palette.gold);
    // underbite fangs
    pixel(ctx, originX + 6, 9 + y, palette.cream);
    pixel(ctx, originX + 9, 9 + y, palette.cream);
    fillRect(ctx, originX + 6, 8 + y, 4, 1, palette.ink);
  }
  // knobby club
  if (facing === 'left') {
    fillRect(ctx, originX + 0, 12 + y, 2, 6, palette.woodDark);
    fillRect(ctx, originX + 0, 10 + y, 3, 3, palette.stoneDark);
  } else {
    fillRect(ctx, originX + 14, 12 + y, 2, 6, palette.woodDark);
    fillRect(ctx, originX + 13, 10 + y, 3, 3, palette.stoneDark);
  }
}

/** Fairy-tale ogre: tiny pinhead, huge belly, tusks, loincloth, bone club. */
function drawOgreFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const y = bob;
  const skin = palette.clothOgre;
  const skinDark = 0x6a4a28;
  const belly = 0xb89050;

  fillRect(ctx, originX + 2, 21, 12, 2, palette.ink);
  // thick tree-trunk legs
  fillRect(ctx, originX + 2 - leg, 16 + y, 5, 5, skinDark);
  fillRect(ctx, originX + 10 + leg, 16 + y, 5, 5, skinDark);
  fillRect(ctx, originX + 2 - leg, 19 + y, 5, 2, palette.woodDark);
  fillRect(ctx, originX + 10 + leg, 19 + y, 5, 2, palette.woodDark);

  // massive pot belly
  fillRect(ctx, originX + 1, 7 + y, 14, 10, skin);
  fillRect(ctx, originX + 3, 10 + y, 10, 6, belly);
  fillRect(ctx, originX + 5, 12 + y, 6, 3, skinDark);
  // crude loincloth
  fillRect(ctx, originX + 4, 14 + y, 8, 4, palette.clothBandit);
  fillRect(ctx, originX + 6, 15 + y, 4, 3, 0x4a2818);

  // broad shoulders / arms
  fillRect(ctx, originX + 0, 8 + y, 3, 6, skin);
  fillRect(ctx, originX + 13, 8 + y, 3, 6, skin);
  fillRect(ctx, originX + 0, 13 + y, 3, 3, skinDark);
  fillRect(ctx, originX + 13, 13 + y, 3, 3, skinDark);

  // tiny pinhead on thick neck
  fillRect(ctx, originX + 6, 5 + y, 4, 3, skinDark);
  fillRect(ctx, originX + 5, 1 + y, 6, 5, skin);
  fillRect(ctx, originX + 5, 1 + y, 6, 1, palette.ink);
  if (facing !== 'up') {
    pixel(ctx, originX + 6, 3 + y, palette.ink);
    pixel(ctx, originX + 9, 3 + y, palette.ink);
    fillRect(ctx, originX + 6, 5 + y, 4, 1, palette.ink);
    // tusks
    pixel(ctx, originX + 5, 5 + y, palette.cream);
    pixel(ctx, originX + 10, 5 + y, palette.cream);
    pixel(ctx, originX + 5, 6 + y, palette.cream);
    pixel(ctx, originX + 10, 6 + y, palette.cream);
  }
  // bone club over shoulder
  fillRect(ctx, originX + 14, 4 + y, 2, 10, 0xe8dcc8);
  fillRect(ctx, originX + 13, 3 + y, 4, 3, 0xf4efe4);
  pixel(ctx, originX + 14, 4 + y, palette.ink);
}

/** Dragon: snout, wings, tail, scaled body. */
function drawDragonFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const flap = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const y = bob;
  const scale = palette.clothDragon;
  const scaleDark = 0x6b2818;
  const belly = 0xd4a84b;

  fillRect(ctx, originX + 4, 21, 8, 2, palette.ink);
  fillRect(ctx, originX + 5, 18 + y, 3, 3, scaleDark);
  fillRect(ctx, originX + 9, 18 + y, 3, 3, scaleDark);

  // body
  fillRect(ctx, originX + 4, 10 + y, 8, 9, scale);
  fillRect(ctx, originX + 5, 12 + y, 6, 5, belly);

  // head / snout
  fillRect(ctx, originX + 5, 3 + y, 6, 7, scale);
  if (facing === 'left') {
    fillRect(ctx, originX + 1, 5 + y, 4, 3, scale);
    pixel(ctx, originX + 2, 6 + y, palette.gold);
    fillRect(ctx, originX + 1, 7 + y, 2, 1, palette.ink);
  } else if (facing === 'right') {
    fillRect(ctx, originX + 11, 5 + y, 4, 3, scale);
    pixel(ctx, originX + 13, 6 + y, palette.gold);
    fillRect(ctx, originX + 13, 7 + y, 2, 1, palette.ink);
  } else if (facing === 'up') {
    fillRect(ctx, originX + 5, 2 + y, 6, 3, scaleDark);
  } else {
    fillRect(ctx, originX + 6, 1 + y, 4, 3, scale);
    pixel(ctx, originX + 7, 3 + y, palette.gold);
    pixel(ctx, originX + 9, 3 + y, palette.gold);
    fillRect(ctx, originX + 7, 5 + y, 2, 1, 0xff4422);
  }

  // horns
  fillRect(ctx, originX + 5, 1 + y, 2, 2, scaleDark);
  fillRect(ctx, originX + 9, 1 + y, 2, 2, scaleDark);

  // wings
  fillRect(ctx, originX + 0, 9 + y - flap, 4, 5 + flap, scaleDark);
  fillRect(ctx, originX + 1, 10 + y - flap, 2, 3, scale);
  fillRect(ctx, originX + 12, 9 + y - flap, 4, 5 + flap, scaleDark);
  fillRect(ctx, originX + 13, 10 + y - flap, 2, 3, scale);

  // tail
  fillRect(ctx, originX + 7, 19 + y, 2, 2, scale);
  fillRect(ctx, originX + (facing === 'left' ? 3 : 11), 20 + y, 3, 2, scaleDark);
}

/** Plague doctor: beaked mask, wide hat, dark robes. */
function drawPhysicianFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const y = bob;
  const robe = palette.clothPhysician;
  const robeLight = 0x3a3a48;

  fillRect(ctx, originX + 4, 21, 8, 2, palette.ink);
  fillRect(ctx, originX + 5 - leg, 18 + y, 3, 3, palette.ink);
  fillRect(ctx, originX + 9 + leg, 18 + y, 3, 3, palette.ink);

  // long robes
  fillRect(ctx, originX + 4, 9 + y, 8, 10, robe);
  fillRect(ctx, originX + 5, 11 + y, 6, 6, robeLight);

  // wide brim hat
  fillRect(ctx, originX + 2, 3 + y, 12, 2, palette.ink);
  fillRect(ctx, originX + 5, 1 + y, 6, 3, robe);

  // beaked mask
  fillRect(ctx, originX + 5, 5 + y, 6, 4, 0xc4a35a);
  if (facing === 'left') {
    fillRect(ctx, originX + 1, 6 + y, 4, 2, 0xc4a35a);
    pixel(ctx, originX + 1, 7 + y, palette.ink);
  } else if (facing === 'right') {
    fillRect(ctx, originX + 11, 6 + y, 4, 2, 0xc4a35a);
    pixel(ctx, originX + 14, 7 + y, palette.ink);
  } else if (facing !== 'up') {
    fillRect(ctx, originX + 6, 8 + y, 4, 2, 0xc4a35a);
    pixel(ctx, originX + 7, 9 + y, palette.ink);
    pixel(ctx, originX + 6, 6 + y, palette.ink);
    pixel(ctx, originX + 9, 6 + y, palette.ink);
  }

  // cane / satchel
  fillRect(ctx, originX + 13, 10 + y, 1, 8, palette.woodDark);
  fillRect(ctx, originX + 3, 14 + y, 2, 3, palette.wood);
}

/** Bishop: mitre, crimson vestments, crosier. */
function drawBishopFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const y = bob;
  const robe = palette.clothBishop;

  fillRect(ctx, originX + 4, 21, 8, 2, palette.ink);
  fillRect(ctx, originX + 5 - leg, 18 + y, 3, 3, palette.ink);
  fillRect(ctx, originX + 9 + leg, 18 + y, 3, 3, palette.ink);

  fillRect(ctx, originX + 4, 10 + y, 8, 9, robe);
  fillRect(ctx, originX + 6, 12 + y, 4, 6, palette.cream);
  fillRect(ctx, originX + 7, 11 + y, 2, 8, palette.gold);

  // mitre
  fillRect(ctx, originX + 5, 1 + y, 6, 5, robe);
  fillRect(ctx, originX + 6, 0 + y, 4, 2, palette.gold);
  pixel(ctx, originX + 7, 2 + y, palette.gold);
  pixel(ctx, originX + 8, 2 + y, palette.gold);

  fillRect(ctx, originX + 5, 5 + y, 6, 5, palette.skin);
  if (facing !== 'up') {
    pixel(ctx, originX + 6, 7 + y, palette.ink);
    pixel(ctx, originX + 9, 7 + y, palette.ink);
  }

  // crosier
  fillRect(ctx, originX + 13, 4 + y, 1, 14, palette.gold);
  fillRect(ctx, originX + 12, 3 + y, 3, 2, palette.gold);
  fillRect(ctx, originX + 14, 4 + y, 1, 2, palette.gold);
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
  const w = 80;
  const h = 68;
  const tex = createCanvas(scene, PROP_KEYS.keep, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 8, 22, 64, 42, palette.stone);
  fillRect(ctx, 8, 22, 64, 2, palette.ink);
  fillRect(ctx, 8, 22, 2, 42, palette.ink);
  fillRect(ctx, 70, 22, 2, 42, palette.ink);
  for (let i = 0; i < 7; i++) {
    fillRect(ctx, 10 + i * 9, 8, 7, 16, palette.stone);
    fillRect(ctx, 10 + i * 9, 8, 7, 1, palette.ink);
  }
  fillRect(ctx, 32, 46, 16, 18, palette.woodDark);
  fillRect(ctx, 16, 32, 7, 6, palette.cream);
  fillRect(ctx, 57, 32, 7, 6, palette.cream);
  fillRect(ctx, 34, 30, 12, 8, palette.gold);
  fillRect(ctx, 36, 12, 8, 6, palette.roof);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.keepInterior, w, h);
  const ic = int.getContext();
  // stone floor + tapestries
  fillRect(ic, 8, 22, 64, 42, palette.stoneDark);
  fillRect(ic, 10, 24, 60, 38, palette.wood);
  fillRect(ic, 12, 26, 18, 14, palette.roof);
  fillRect(ic, 14, 28, 14, 10, 0x6b2040);
  // throne dais
  fillRect(ic, 48, 28, 20, 24, palette.stone);
  fillRect(ic, 52, 32, 12, 14, palette.gold);
  fillRect(ic, 54, 30, 8, 4, palette.cream);
  // long table
  fillRect(ic, 18, 44, 28, 6, palette.woodDark);
  fillRect(ic, 20, 42, 4, 4, palette.wood);
  fillRect(ic, 40, 42, 4, 4, palette.wood);
  // hearth niche (fire sprite overlays)
  fillRect(ic, 28, 50, 14, 10, palette.stoneDark);
  fillRect(ic, 30, 52, 10, 6, palette.ink);
  fillRect(ic, 34, 54, 2, 2, 0xff6622);
  // banner
  fillRect(ic, 36, 24, 6, 12, palette.clothKing);
  pixel(ic, 38, 28, palette.gold);
  int.refresh();
}

function drawHouse(scene: Phaser.Scene) {
  const w = 56;
  const h = 52;
  const tex = createCanvas(scene, PROP_KEYS.house, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 20, 44, 28, palette.wood);
  fillRect(ctx, 6, 20, 44, 1, palette.ink);
  for (let row = 0; row < 12; row++) {
    fillRect(ctx, 6 + row, 8 + row, 44 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 22, 34, 12, 14, palette.woodDark);
  fillRect(ctx, 12, 26, 6, 6, palette.cream);
  fillRect(ctx, 38, 26, 6, 6, palette.cream);
  fillRect(ctx, 40, 12, 4, 6, palette.stoneDark); // chimney
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.houseInterior, w, h);
  const ic = int.getContext();
  fillRect(ic, 6, 20, 44, 28, palette.dirt);
  fillRect(ic, 8, 22, 40, 24, 0xc4a882);
  // bed
  fillRect(ic, 10, 24, 14, 10, palette.woodDark);
  fillRect(ic, 12, 26, 10, 6, palette.cream);
  fillRect(ic, 12, 26, 4, 3, palette.clothPeasant);
  // table + stool
  fillRect(ic, 30, 36, 12, 5, palette.wood);
  fillRect(ic, 32, 40, 3, 4, palette.woodDark);
  fillRect(ic, 38, 40, 3, 4, palette.woodDark);
  // cupboard
  fillRect(ic, 42, 24, 6, 12, palette.woodDark);
  // hearth
  fillRect(ic, 24, 40, 12, 8, palette.stoneDark);
  fillRect(ic, 26, 42, 8, 5, palette.ink);
  fillRect(ic, 28, 44, 4, 2, 0xff8844);
  // rug
  fillRect(ic, 18, 34, 10, 6, palette.roof);
  int.refresh();
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

  // Animated hearth fire: 4 frames in a row
  const fw = 12;
  const fh = 14;
  const hearth = createCanvas(scene, PROP_KEYS.hearthFire, fw * 4, fh);
  const hctx = hearth.getContext();
  for (let i = 0; i < 4; i++) {
    const ox = i * fw;
    fillRect(hctx, ox + 2, fh - 3, 8, 3, palette.stoneDark);
    const flicker = i % 2;
    fillRect(hctx, ox + 3, 6 + flicker, 6, 6 - flicker, 0xff4422);
    fillRect(hctx, ox + 4, 3 + (i % 3), 4, 6, 0xff8844);
    fillRect(hctx, ox + 5, 1 + flicker, 2, 5, 0xffee66);
    if (i === 1 || i === 3) {
      pixel(hctx, ox + 3, 5, 0xffaa33);
      pixel(hctx, ox + 8, 6, 0xff6622);
    }
  }
  hearth.refresh();
  const htex = scene.textures.get(PROP_KEYS.hearthFire);
  for (let i = 0; i < 4; i++) {
    if (!htex.has(String(i))) {
      htex.add(String(i), 0, i * fw, 0, fw, fh);
    }
  }

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
  const w = 48;
  const h = 44;
  const tex = createCanvas(scene, PROP_KEYS.tavern, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 16, 40, 24, palette.wood);
  fillRect(ctx, 4, 16, 40, 1, palette.ink);
  for (let row = 0; row < 10; row++) {
    fillRect(ctx, 4 + row, 6 + row, 40 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 18, 28, 12, 12, palette.woodDark);
  fillRect(ctx, 10, 22, 5, 5, palette.cream);
  fillRect(ctx, 33, 22, 5, 5, palette.cream);
  fillRect(ctx, 36, 10, 4, 8, palette.stoneDark);
  // hanging sign
  fillRect(ctx, 20, 14, 8, 5, palette.gold);
  tex.refresh();
}

function drawTavernInterior(scene: Phaser.Scene) {
  const w = 48;
  const h = 44;
  const int = createCanvas(scene, PROP_KEYS.tavernInterior, w, h);
  const ic = int.getContext();
  fillRect(ic, 4, 16, 40, 24, palette.wood);
  fillRect(ic, 6, 18, 36, 20, 0x5a4030);
  // bar
  fillRect(ic, 8, 22, 6, 16, palette.woodDark);
  fillRect(ic, 8, 22, 6, 3, palette.wood);
  // kegs
  fillRect(ic, 10, 28, 4, 6, palette.dirtDark);
  // tables
  fillRect(ic, 20, 28, 10, 5, palette.wood);
  fillRect(ic, 34, 30, 8, 5, palette.wood);
  fillRect(ic, 22, 32, 2, 4, palette.woodDark);
  fillRect(ic, 28, 32, 2, 4, palette.woodDark);
  // hearth
  fillRect(ic, 28, 36, 12, 8, palette.stoneDark);
  fillRect(ic, 30, 38, 8, 5, palette.ink);
  fillRect(ic, 32, 40, 4, 2, 0xff8844);
  // mugs
  pixel(ic, 22, 27, palette.cream);
  pixel(ic, 36, 29, palette.cream);
  int.refresh();
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
  const w = 56;
  const h = 52;
  const tex = createCanvas(scene, PROP_KEYS.manor, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 18, 44, 30, palette.stone);
  fillRect(ctx, 6, 18, 44, 1, palette.ink);
  for (let row = 0; row < 12; row++) {
    fillRect(ctx, 6 + row, 6 + row, 44 - row * 2, 1, palette.roof);
  }
  fillRect(ctx, 22, 34, 12, 14, palette.woodDark);
  fillRect(ctx, 12, 24, 6, 6, palette.cream);
  fillRect(ctx, 38, 24, 6, 6, palette.cream);
  fillRect(ctx, 24, 10, 8, 6, palette.gold);
  fillRect(ctx, 42, 12, 4, 8, palette.stoneDark);
  tex.refresh();

  // reuse house-style interior key via manor → houseInterior mapping already
}

function drawCave(scene: Phaser.Scene) {
  const w = 48;
  const h = 36;
  const tex = createCanvas(scene, PROP_KEYS.cave, w, h);
  const ctx = tex.getContext();
  // rocky mound + cliff
  fillRect(ctx, 2, 12, 44, 22, palette.mountain);
  fillRect(ctx, 6, 8, 36, 12, palette.mountainLight);
  fillRect(ctx, 12, 3, 24, 10, palette.stone);
  fillRect(ctx, 16, 1, 16, 4, 0xe8eef2);
  fillRect(ctx, 10, 10, 4, 8, palette.stoneDark);
  fillRect(ctx, 34, 10, 4, 8, palette.stoneDark);
  // arched mouth
  fillRect(ctx, 14, 12, 20, 20, palette.ink);
  fillRect(ctx, 16, 14, 16, 16, 0x0a0608);
  fillRect(ctx, 18, 12, 12, 4, 0x0a0608);
  fillRect(ctx, 20, 18, 8, 10, 0x1a1018);
  // stalactite teeth
  fillRect(ctx, 18, 12, 2, 4, palette.stoneDark);
  fillRect(ctx, 28, 12, 2, 5, palette.stoneDark);
  fillRect(ctx, 23, 12, 2, 3, palette.stone);
  // moss & ferns
  fillRect(ctx, 4, 20, 5, 4, palette.forest);
  fillRect(ctx, 39, 18, 5, 5, palette.grassDark);
  pixel(ctx, 6, 19, palette.grassLight);
  pixel(ctx, 41, 17, palette.grass);
  tex.refresh();
}

function drawCathedral(scene: Phaser.Scene) {
  const w = 64;
  const h = 60;
  const tex = createCanvas(scene, PROP_KEYS.cathedral, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 8, 22, 48, 34, palette.stone);
  fillRect(ctx, 8, 22, 48, 2, palette.ink);
  for (let row = 0; row < 12; row++) {
    fillRect(ctx, 10 + row, 10 + row, 44 - row * 2, 1, palette.clothBishop);
  }
  fillRect(ctx, 26, 4, 12, 20, palette.stone);
  fillRect(ctx, 28, 2, 8, 4, palette.gold);
  fillRect(ctx, 30, 0, 4, 3, palette.gold);
  fillRect(ctx, 26, 42, 12, 14, palette.woodDark);
  fillRect(ctx, 14, 30, 6, 8, palette.cream);
  fillRect(ctx, 44, 30, 6, 8, palette.cream);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.cathedralInterior, w, h);
  const ic = int.getContext();
  fillRect(ic, 8, 22, 48, 34, palette.stoneDark);
  fillRect(ic, 10, 24, 44, 30, 0x3a3a48);
  // aisle + altar
  fillRect(ic, 28, 26, 8, 22, palette.cream);
  fillRect(ic, 24, 28, 16, 6, palette.wood);
  fillRect(ic, 28, 26, 8, 4, palette.gold);
  // pews
  fillRect(ic, 12, 36, 10, 4, palette.woodDark);
  fillRect(ic, 12, 42, 10, 4, palette.woodDark);
  fillRect(ic, 42, 36, 10, 4, palette.woodDark);
  fillRect(ic, 42, 42, 10, 4, palette.woodDark);
  // stained light
  fillRect(ic, 14, 28, 4, 6, 0x7ec8e3);
  fillRect(ic, 46, 28, 4, 6, palette.clothBishop);
  // candles
  fillRect(ic, 26, 30, 1, 4, palette.cream);
  fillRect(ic, 37, 30, 1, 4, palette.cream);
  pixel(ic, 26, 29, 0xffcc44);
  pixel(ic, 37, 29, 0xffcc44);
  int.refresh();
}

function drawInfirmary(scene: Phaser.Scene) {
  const w = 56;
  const h = 48;
  const tex = createCanvas(scene, PROP_KEYS.infirmary, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 16, 44, 28, palette.stone);
  fillRect(ctx, 6, 16, 44, 1, palette.ink);
  for (let row = 0; row < 10; row++) {
    fillRect(ctx, 6 + row, 6 + row, 44 - row * 2, 1, palette.clothPhysician);
  }
  fillRect(ctx, 22, 30, 12, 14, palette.woodDark);
  fillRect(ctx, 12, 22, 6, 6, palette.cream);
  fillRect(ctx, 38, 22, 6, 6, palette.cream);
  fillRect(ctx, 24, 8, 8, 12, 0xa04545);
  fillRect(ctx, 20, 12, 16, 4, 0xa04545);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.infirmaryInterior, w, h);
  const ic = int.getContext();
  fillRect(ic, 6, 16, 44, 28, palette.cream);
  fillRect(ic, 8, 18, 40, 24, 0xe8e0d0);
  // beds
  fillRect(ic, 10, 22, 14, 10, palette.woodDark);
  fillRect(ic, 12, 24, 10, 6, palette.clothPeasant);
  fillRect(ic, 32, 22, 14, 10, palette.woodDark);
  fillRect(ic, 34, 24, 10, 6, palette.clothPeasant);
  // herb shelf
  fillRect(ic, 12, 36, 16, 6, palette.wood);
  pixel(ic, 14, 38, palette.grass);
  pixel(ic, 18, 37, palette.forest);
  pixel(ic, 22, 38, 0xa04545);
  // hearth / brazier
  fillRect(ic, 36, 36, 10, 8, palette.stoneDark);
  fillRect(ic, 38, 38, 6, 5, palette.ink);
  fillRect(ic, 40, 40, 2, 2, 0xff8844);
  // basin
  fillRect(ic, 26, 34, 6, 4, palette.waterLight);
  int.refresh();
}

function drawDungeon(scene: Phaser.Scene) {
  const w = 40;
  const h = 36;
  const tex = createCanvas(scene, PROP_KEYS.dungeon, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 10, 32, 24, palette.stoneDark);
  fillRect(ctx, 4, 10, 32, 2, palette.ink);
  fillRect(ctx, 14, 18, 12, 16, palette.ink);
  fillRect(ctx, 16, 20, 8, 12, 0x1a1018);
  fillRect(ctx, 8, 14, 4, 4, palette.metal);
  fillRect(ctx, 28, 14, 4, 4, palette.metal);
  tex.refresh();
}

function drawBanditCamp(scene: Phaser.Scene) {
  const w = 40;
  const h = 28;
  const tex = createCanvas(scene, PROP_KEYS.banditCamp, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 14, 28, 12, palette.dirt);
  fillRect(ctx, 10, 6, 20, 14, palette.clothBandit);
  fillRect(ctx, 10, 6, 20, 1, palette.ink);
  fillRect(ctx, 18, 2, 2, 8, palette.wood);
  fillRect(ctx, 8, 18, 6, 6, palette.woodDark);
  fillRect(ctx, 26, 18, 6, 6, 0x3a2a1a);
  tex.refresh();
}

function drawThiefDen(scene: Phaser.Scene) {
  const w = 36;
  const h = 24;
  const tex = createCanvas(scene, PROP_KEYS.thiefDen, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 10, 28, 12, palette.ink);
  fillRect(ctx, 8, 6, 20, 10, palette.stoneDark);
  fillRect(ctx, 14, 12, 8, 8, 0x0a0608);
  fillRect(ctx, 22, 4, 3, 6, palette.wood);
  tex.refresh();
}

function drawSiegeCamp(scene: Phaser.Scene) {
  const w = 48;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.siegeCamp, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 16, 40, 14, palette.dirt);
  fillRect(ctx, 8, 8, 18, 14, palette.clothEnemyArmy);
  fillRect(ctx, 8, 8, 18, 1, palette.ink);
  fillRect(ctx, 28, 10, 14, 12, palette.stone);
  fillRect(ctx, 32, 4, 2, 10, palette.metal);
  fillRect(ctx, 14, 2, 2, 8, palette.wood);
  fillRect(ctx, 36, 18, 8, 6, palette.woodDark);
  tex.refresh();
}

/**
 * Generate all textures into the scene texture manager.
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
    PROP_KEYS.hearthFire,
    PROP_KEYS.smoke,
    PROP_KEYS.rock,
    PROP_KEYS.arrow,
    PROP_KEYS.bolt,
    PROP_KEYS.dust,
    PROP_KEYS.cave,
    PROP_KEYS.cathedral,
    PROP_KEYS.infirmary,
    PROP_KEYS.dungeon,
    PROP_KEYS.banditCamp,
    PROP_KEYS.thiefDen,
    PROP_KEYS.siegeCamp,
    PROP_KEYS.houseInterior,
    PROP_KEYS.keepInterior,
    PROP_KEYS.tavernInterior,
    PROP_KEYS.cathedralInterior,
    PROP_KEYS.infirmaryInterior,
    ...Array.from({ length: 16 }, (_, i) => wallTextureKey(i)),
  ];
  for (const key of [
    TERRAIN_KEY,
    ...UNIT_ROLES,
    ...ENEMY_ROLES,
    ...MONSTER_ROLES,
    ...propKeys,
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
  for (const role of MONSTER_ROLES) {
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
  drawCave(scene);
  drawCathedral(scene);
  drawInfirmary(scene);
  drawDungeon(scene);
  drawBanditCamp(scene);
  drawThiefDen(scene);
  drawSiegeCamp(scene);
  drawTavernInterior(scene);

  const terrain = scene.textures.get(TERRAIN_KEY);
  for (let i = 0; i < 7; i++) {
    const name = String(i);
    if (!terrain.has(name)) {
      terrain.add(name, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
    }
  }
}

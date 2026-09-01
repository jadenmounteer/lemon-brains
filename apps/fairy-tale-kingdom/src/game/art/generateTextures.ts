import Phaser from 'phaser';
import {
  PROP_KEYS,
  TERRAIN_KEY,
  TILE_SIZE,
  UNIT_FRAME_COUNT,
  UNIT_HEIGHT,
  UNIT_WIDTH,
  uniqueSheetRoles,
  wallTextureKey,
  type AnimRole,
} from './assetManifest';
import { FORT_TILE } from '../buildings/buildingShared';
import {
  drawWallToTexture,
  WALL_SPRITE_H,
  WALL_SPRITE_W,
} from './wallArt';
import { palette } from './palette';
import {
  drawInteriorWallH,
  drawInteriorWallV,
} from './buildingArt';
import {
  drawSupplementaryInteriors,
} from './interiorTextures';

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

/** Staggered stone brick fill for castle walls. */
function fillStoneBricks(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  brickW = 8,
  brickH = 5
) {
  fillRect(ctx, x, y, w, h, palette.stoneDark);
  for (let row = 0; row < h; row += brickH) {
    const offset = (Math.floor(row / brickH) % 2) * Math.floor(brickW / 2);
    for (let col = -brickW; col < w + brickW; col += brickW) {
      const bx = x + col + offset;
      const tone =
        (col + row) % (brickW * 2) < brickW ? palette.stone : palette.stoneDark;
      fillRect(ctx, bx, y + row, brickW - 1, brickH - 1, tone);
    }
  }
}

function strokeRectInk(ctx: Ctx, x: number, y: number, w: number, h: number) {
  fillRect(ctx, x, y, w, 1, palette.ink);
  fillRect(ctx, x, y + h - 1, w, 1, palette.ink);
  fillRect(ctx, x, y, 1, h, palette.ink);
  fillRect(ctx, x + w - 1, y, 1, h, palette.ink);
}

function fillFlagstoneFloor(ctx: Ctx, x: number, y: number, w: number, h: number) {
  fillRect(ctx, x, y, w, h, palette.stoneDark);
  for (let py = y; py < y + h; py += 6) {
    for (let px = x + ((py - y) % 12 === 0 ? 0 : 4); px < x + w - 4; px += 8) {
      fillRect(ctx, px, py, 7, 5, palette.stone);
      pixel(ctx, px + 3, py + 2, 0x9a9a90);
    }
  }
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
    case 'child':
      return palette.clothChild;
    case 'guard':
      return palette.clothGuard;
    case 'soldier':
      return palette.clothSoldier;
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
    case 'duke':
      return palette.clothDuke;
    case 'duchess':
      return palette.clothDuchess;
    case 'fairy_godmother':
      return palette.clothFairy;
    case 'jester':
      return palette.clothJester;
    case 'dungeon_keeper':
      return palette.clothDungeonKeeper;
    case 'executioner':
      return palette.clothExecutioner;
    case 'witch_hunter':
      return palette.clothWitchHunter;
    case 'witch':
      return palette.clothWitch;
    case 'necromancer':
      return palette.clothNecromancer;
    case 'zombie':
      return palette.clothZombie;
    case 'vampire_wife':
      return palette.clothVampireWife;
    case 'bandit':
      return palette.clothBandit;
    case 'gypsy':
      return palette.clothGypsy;
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
    default:
      return palette.clothPeasant;
  }
}

/** Walk cycle: small vertical bob + leg offset per frame (0–3). */
function drawUnitFrame(
  ctx: Ctx,
  originX: number,
  role: AnimRole,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null,
  clothOverride?: number
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
  if (role === 'goblin') {
    drawGoblinFrame(ctx, originX, facing, walkStep);
    return;
  }
  if (role === 'giant') {
    drawGiantFrame(ctx, originX, facing, walkStep);
    return;
  }
  if (
    role === 'king' ||
    role === 'queen' ||
    role === 'prince' ||
    role === 'princess' ||
    role === 'duke' ||
    role === 'duchess' ||
    role === 'fairy_godmother'
  ) {
    drawRoyalFrame(ctx, originX, role, facing, walkStep);
    return;
  }

  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const baseY = bob;
  const cloth = clothOverride ?? clothFor(role);
  const tall = 0;
  const skinTone = role === 'zombie' ? palette.skinZombie : palette.skin;

  fillRect(ctx, originX + 4, 21, 8, 2, palette.ink);

  const leftBootX = originX + 5 - (facing === 'right' ? 0 : leg);
  const rightBootX = originX + 9 + (facing === 'left' ? 0 : leg);
  fillRect(ctx, leftBootX, 18 + baseY, 3, 3, palette.ink);
  fillRect(ctx, rightBootX, 18 + baseY, 3, 3, palette.ink);

  fillRect(ctx, originX + 5, 10 + baseY + tall, 6, 8 - tall, cloth);
  fillRect(ctx, originX + 4, 10 + baseY + tall, 1, 8 - tall, palette.ink);
  fillRect(ctx, originX + 11, 10 + baseY + tall, 1, 8 - tall, palette.ink);

  fillRect(ctx, originX + 5, 4 + baseY + tall, 6, 6, skinTone);
  if (role === 'knight') {
    fillRect(ctx, originX + 5, 3 + baseY, 6, 3, palette.metal);
    fillRect(ctx, originX + 11, 12 + baseY, 2, 5, palette.metal);
  }
  fillRect(ctx, originX + 4, 4 + baseY + tall, 1, 6, palette.ink);
  fillRect(ctx, originX + 11, 4 + baseY + tall, 1, 6, palette.ink);
  fillRect(ctx, originX + 5, 3 + baseY + tall, 6, 1, palette.ink);

  if (role === 'guard' || role === 'elite_guard' || role === 'enemy_army' || role === 'soldier') {
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
  } else if (role === 'jester') {
    fillRect(ctx, originX + 4, 2 + baseY, 8, 2, palette.gold);
    pixel(ctx, originX + 4, 2 + baseY, palette.clothJester);
    pixel(ctx, originX + 11, 2 + baseY, palette.clothEliteArcher);
  } else if (role === 'executioner') {
    fillRect(ctx, originX + 4, 3 + baseY, 8, 2, palette.ink);
    fillRect(ctx, originX + 12, 10 + baseY, 2, 7, palette.metal);
  } else if (role === 'witch_hunter') {
    fillRect(ctx, originX + 5, 3 + baseY, 6, 2, palette.woodDark);
    fillRect(ctx, originX + 12, 11 + baseY, 2, 6, palette.metal);
  } else if (role === 'witch') {
    fillRect(ctx, originX + 4, 2 + baseY, 8, 3, palette.ink);
    fillRect(ctx, originX + 12, 10 + baseY, 2, 6, palette.wood);
  } else if (role === 'necromancer') {
    // Deep hood shadowing the face, staff of bone.
    fillRect(ctx, originX + 3, 1 + baseY, 10, 5, palette.clothNecromancer);
    fillRect(ctx, originX + 12, 8 + baseY, 2, 10, palette.cream);
  } else if (role === 'zombie') {
    // Ragged, lopsided collar and a missing patch of hair.
    fillRect(ctx, originX + 4, 3 + baseY, 4, 2, palette.clothZombie);
    fillRect(ctx, originX + 9, 4 + baseY, 3, 1, palette.stoneDark);
  } else if (role === 'vampire_wife') {
    // Dark widow's-peak hair and a trailing cape.
    fillRect(ctx, originX + 4, 2 + baseY, 8, 3, palette.ink);
    fillRect(ctx, originX + 12, 9 + baseY, 2, 9, palette.clothVampireWife);
  } else if (role === 'dungeon_keeper') {
    fillRect(ctx, originX + 5, 3 + baseY, 6, 2, palette.metal);
    fillRect(ctx, originX + 11, 12 + baseY, 3, 4, palette.gold);
  } else if (role === 'child') {
    // smaller already via same frame; soft hat
    fillRect(ctx, originX + 5, 3 + baseY, 6, 2, palette.clothChild);
  } else if (role === 'bandit' || role === 'gypsy') {
    fillRect(ctx, originX + 4, 3 + baseY, 8, 2, palette.ink);
    fillRect(ctx, originX + 12, 12 + baseY, 2, 5, palette.metal);
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

/** Massive club-wielding giant: stone skin, hide wrap, swinging club on walk. */
function drawGiantFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const clubSwing =
    walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 2 : walkStep === 3 ? 1 : 0;
  const y = bob - 1;
  const skin = 0x9a8a6a;
  const skinDark = 0x6a5a42;
  const hide = palette.clothGiant;

  // Shadow / boots
  fillRect(ctx, originX + 3, 21, 10, 2, palette.ink);
  fillRect(ctx, originX + 4 - leg, 17 + y, 4, 4, skinDark);
  fillRect(ctx, originX + 9 + leg, 17 + y, 4, 4, skinDark);

  // Thick torso
  fillRect(ctx, originX + 3, 8 + y, 10, 10, skin);
  fillRect(ctx, originX + 4, 9 + y, 8, 8, hide);
  fillRect(ctx, originX + 3, 8 + y, 1, 10, palette.ink);
  fillRect(ctx, originX + 12, 8 + y, 1, 10, palette.ink);

  // Arms
  fillRect(ctx, originX + 1, 9 + y, 3, 8, skin);
  fillRect(ctx, originX + 12, 9 + y, 3, 8, skin);

  // Oversized head + brow
  fillRect(ctx, originX + 4, 2 + y, 8, 7, skin);
  fillRect(ctx, originX + 4, 2 + y, 8, 2, skinDark);
  fillRect(ctx, originX + 3, 2 + y, 1, 6, palette.ink);
  fillRect(ctx, originX + 12, 2 + y, 1, 6, palette.ink);

  if (facing === 'left') {
    pixel(ctx, originX + 6, 5 + y, palette.ink);
    // Club raised left
    fillRect(ctx, originX + 0, 6 + y - clubSwing, 2, 10 + clubSwing, palette.woodDark);
    fillRect(ctx, originX + 0, 4 + y - clubSwing, 3, 3, palette.wood);
  } else if (facing === 'right') {
    pixel(ctx, originX + 10, 5 + y, palette.ink);
    fillRect(ctx, originX + 14, 6 + y - clubSwing, 2, 10 + clubSwing, palette.woodDark);
    fillRect(ctx, originX + 13, 4 + y - clubSwing, 3, 3, palette.wood);
  } else if (facing === 'up') {
    fillRect(ctx, originX + 4, 2 + y, 8, 3, hide);
    fillRect(ctx, originX + 14, 7 + y - clubSwing, 2, 9, palette.woodDark);
  } else {
    pixel(ctx, originX + 6, 5 + y, palette.ink);
    pixel(ctx, originX + 9, 5 + y, palette.ink);
    fillRect(ctx, originX + 6, 7 + y, 4, 1, palette.ink);
    // Club over shoulder / swinging
    fillRect(ctx, originX + 13, 5 + y - clubSwing, 2, 11 + clubSwing, palette.woodDark);
    fillRect(ctx, originX + 12, 3 + y - clubSwing, 4, 3, palette.wood);
  }
}

/** Little goblin: small green body, big ears, beady eyes, fangs, crude dagger. */
function drawGoblinFrame(
  ctx: Ctx,
  originX: number,
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const y = bob + 3; // shorter stature
  const skin = 0x4a9a48;
  const skinDark = palette.clothGoblin;
  const rag = 0x5a4a2a;

  fillRect(ctx, originX + 5, 21, 6, 1, palette.ink);
  fillRect(ctx, originX + 5 - leg, 17 + y, 2, 4, skinDark);
  fillRect(ctx, originX + 9 + leg, 17 + y, 2, 4, skinDark);
  // tiny rag tunic
  fillRect(ctx, originX + 5, 12 + y, 6, 6, rag);
  fillRect(ctx, originX + 6, 13 + y, 4, 4, skin);
  // arms
  if (facing === 'left') {
    fillRect(ctx, originX + 2, 13 + y, 2, 5, skin);
    fillRect(ctx, originX + 1, 14 + y, 2, 5, palette.woodDark); // dagger
  } else if (facing === 'right') {
    fillRect(ctx, originX + 12, 13 + y, 2, 5, skin);
    fillRect(ctx, originX + 13, 14 + y, 2, 5, palette.woodDark);
  } else {
    fillRect(ctx, originX + 3, 13 + y, 2, 5, skin);
    fillRect(ctx, originX + 11, 13 + y, 2, 5, skin);
    fillRect(ctx, originX + 12, 15 + y, 2, 4, palette.woodDark);
  }
  // oversized head
  fillRect(ctx, originX + 5, 5 + y, 6, 7, skin);
  // pointed ears
  fillRect(ctx, originX + 2, 6 + y, 3, 4, skin);
  fillRect(ctx, originX + 11, 6 + y, 3, 4, skin);
  pixel(ctx, originX + 2, 6 + y, skinDark);
  pixel(ctx, originX + 13, 6 + y, skinDark);
  // hooked nose
  fillRect(ctx, originX + 7, 9 + y, 2, 2, skinDark);
  if (facing !== 'up') {
    // beady yellow eyes
    pixel(ctx, originX + 6, 8 + y, palette.gold);
    pixel(ctx, originX + 9, 8 + y, palette.gold);
    // tiny fangs
    pixel(ctx, originX + 6, 12 + y, palette.cream);
    pixel(ctx, originX + 9, 12 + y, palette.cream);
    fillRect(ctx, originX + 6, 11 + y, 4, 1, palette.ink);
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

/**
 * Royalty & fairy godmother — crowns, dresses/robes, capes.
 * Distinct from the generic tunic body used by commoners.
 */
function drawRoyalFrame(
  ctx: Ctx,
  originX: number,
  role:
    | 'king'
    | 'queen'
    | 'prince'
    | 'princess'
    | 'duke'
    | 'duchess'
    | 'fairy_godmother',
  facing: 'down' | 'left' | 'right' | 'up',
  walkStep: number | null
) {
  const bob = walkStep === null ? 0 : walkStep % 2 === 0 ? 0 : 1;
  const leg = walkStep === null ? 0 : walkStep === 1 || walkStep === 2 ? 1 : 0;
  const y = bob;
  const cloth = clothFor(role);
  const isDress =
    role === 'queen' ||
    role === 'princess' ||
    role === 'duchess' ||
    role === 'fairy_godmother';
  const isMonarch = role === 'king' || role === 'queen';

  // shadow
  fillRect(ctx, originX + 3, 21, 10, 2, palette.ink);

  // shoes peeking under hem / boots
  if (isDress) {
    fillRect(ctx, originX + 5 - leg, 19 + y, 3, 2, palette.ink);
    fillRect(ctx, originX + 9 + leg, 19 + y, 3, 2, palette.ink);
  } else {
    fillRect(ctx, originX + 5 - leg, 18 + y, 3, 3, palette.ink);
    fillRect(ctx, originX + 9 + leg, 18 + y, 3, 3, palette.ink);
  }

  // Cape / train behind (side & down facings)
  if (facing !== 'up') {
    if (role === 'king' || role === 'duke') {
      fillRect(ctx, originX + 3, 9 + y, 2, 10, cloth);
      fillRect(ctx, originX + 12, 9 + y, 2, 10, cloth);
      fillRect(ctx, originX + 2, 10 + y, 1, 8, 0x6b4010);
      fillRect(ctx, originX + 14, 10 + y, 1, 8, 0x6b4010);
    }
    if (isDress) {
      // trailing skirt volume
      fillRect(ctx, originX + 2, 14 + y, 12, 6, cloth);
      fillRect(ctx, originX + 1, 16 + y, 14, 4, cloth);
      if (role === 'queen' || role === 'fairy_godmother') {
        fillRect(ctx, originX + 0, 18 + y, 16, 2, cloth);
      }
    }
  }

  // Torso / bodice
  if (isDress) {
    fillRect(ctx, originX + 5, 9 + y, 6, 6, cloth);
    fillRect(ctx, originX + 4, 14 + y, 8, 5, cloth);
    // waist sash
    fillRect(ctx, originX + 5, 13 + y, 6, 1, palette.gold);
    if (role === 'fairy_godmother') {
      fillRect(ctx, originX + 5, 13 + y, 6, 1, 0xf0f8ff);
    }
  } else {
    // ornate robe (wider than peasant tunic)
    fillRect(ctx, originX + 4, 9 + y, 8, 10, cloth);
    fillRect(ctx, originX + 5, 10 + y, 6, 8, cloth);
    // fur / gold trim down front
    fillRect(ctx, originX + 7, 9 + y, 2, 10, isMonarch ? palette.cream : palette.gold);
    if (role === 'king') {
      fillRect(ctx, originX + 4, 9 + y, 8, 1, palette.cream);
      fillRect(ctx, originX + 4, 17 + y, 8, 1, palette.cream);
    }
  }

  // Head
  fillRect(ctx, originX + 5, 4 + y, 6, 5, palette.skin);
  fillRect(ctx, originX + 4, 4 + y, 1, 5, palette.ink);
  fillRect(ctx, originX + 11, 4 + y, 1, 5, palette.ink);

  // Crowns / circlets / hats
  if (role === 'king') {
    fillRect(ctx, originX + 4, 1 + y, 8, 3, palette.gold);
    pixel(ctx, originX + 4, 0 + y, palette.gold);
    pixel(ctx, originX + 6, 0 + y, palette.gold);
    pixel(ctx, originX + 8, 0 + y, palette.gold);
    pixel(ctx, originX + 11, 0 + y, palette.gold);
    pixel(ctx, originX + 5, 2 + y, 0xc03030);
    pixel(ctx, originX + 7, 2 + y, 0x3060c0);
    pixel(ctx, originX + 9, 2 + y, 0xc03030);
  } else if (role === 'queen') {
    fillRect(ctx, originX + 4, 1 + y, 8, 2, palette.gold);
    pixel(ctx, originX + 5, 0 + y, palette.gold);
    pixel(ctx, originX + 7, 0 + y, palette.gold);
    pixel(ctx, originX + 9, 0 + y, palette.gold);
    pixel(ctx, originX + 7, 2 + y, 0xc03050);
    // veil
    fillRect(ctx, originX + 3, 3 + y, 2, 4, palette.cream);
    fillRect(ctx, originX + 12, 3 + y, 2, 4, palette.cream);
  } else if (role === 'prince') {
    fillRect(ctx, originX + 5, 2 + y, 6, 2, palette.gold);
    pixel(ctx, originX + 7, 1 + y, palette.gold);
    pixel(ctx, originX + 8, 1 + y, 0x3060c0);
  } else if (role === 'princess') {
    fillRect(ctx, originX + 5, 2 + y, 6, 2, palette.gold);
    pixel(ctx, originX + 6, 1 + y, palette.gold);
    pixel(ctx, originX + 8, 1 + y, palette.gold);
    pixel(ctx, originX + 7, 2 + y, 0xd06090);
  } else if (role === 'duke') {
    fillRect(ctx, originX + 5, 2 + y, 6, 2, palette.metal);
    fillRect(ctx, originX + 6, 2 + y, 4, 1, palette.gold);
  } else if (role === 'duchess') {
    fillRect(ctx, originX + 5, 2 + y, 6, 2, palette.gold);
    pixel(ctx, originX + 7, 1 + y, palette.gold);
  } else if (role === 'fairy_godmother') {
    // starry pointed hat
    fillRect(ctx, originX + 5, 0 + y, 6, 4, palette.clothFairy);
    fillRect(ctx, originX + 6, 0 + y, 4, 1, 0xf0f8ff);
    pixel(ctx, originX + 7, 0 + y, palette.gold);
    pixel(ctx, originX + 9, 1 + y, palette.gold);
  }

  // Face
  if (facing === 'up') {
    fillRect(ctx, originX + 5, 4 + y, 6, 2, cloth);
  } else if (facing === 'left') {
    pixel(ctx, originX + 6, 6 + y, palette.ink);
  } else if (facing === 'right') {
    pixel(ctx, originX + 9, 6 + y, palette.ink);
  } else {
    pixel(ctx, originX + 6, 6 + y, palette.ink);
    pixel(ctx, originX + 9, 6 + y, palette.ink);
  }

  // Props: scepter / wand
  if (role === 'king' && facing !== 'up') {
    fillRect(ctx, originX + 13, 6 + y, 1, 10, palette.gold);
    fillRect(ctx, originX + 12, 5 + y, 3, 2, palette.gold);
    pixel(ctx, originX + 13, 4 + y, 0xc03030);
  }
  if (role === 'fairy_godmother') {
    fillRect(ctx, originX + 13, 6 + y, 1, 10, palette.wood);
    pixel(ctx, originX + 13, 5 + y, palette.gold);
    pixel(ctx, originX + 12, 4 + y, 0xf0f8ff);
    pixel(ctx, originX + 14, 4 + y, 0xf0f8ff);
  }

  // Shoulder clasp for prince/duke
  if (role === 'prince' || role === 'duke') {
    fillRect(ctx, originX + 4, 9 + y, 2, 3, palette.gold);
    fillRect(ctx, originX + 11, 9 + y, 2, 3, palette.gold);
  }
}

function drawUnitSheet(
  scene: Phaser.Scene,
  role: AnimRole,
  opts?: { key?: string; cloth?: number }
) {
  const key = opts?.key ?? role;
  const width = UNIT_WIDTH * UNIT_FRAME_COUNT;
  const height = UNIT_HEIGHT;
  const tex = createCanvas(scene, key, width, height);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, width, height);

  const facings: Array<'down' | 'left' | 'right' | 'up'> = [
    'down',
    'left',
    'right',
    'up',
  ];

  drawUnitFrame(ctx, 0, role, 'down', null, opts?.cloth);

  let frame = 1;
  for (const facing of facings) {
    for (let step = 0; step < 4; step++) {
      drawUnitFrame(ctx, frame * UNIT_WIDTH, role, facing, step, opts?.cloth);
      frame++;
    }
  }

  tex.refresh();

  const sheet = scene.textures.get(key);
  for (let i = 0; i < UNIT_FRAME_COUNT; i++) {
    const name = String(i);
    if (!sheet.has(name)) {
      sheet.add(name, 0, i * UNIT_WIDTH, 0, UNIT_WIDTH, UNIT_HEIGHT);
    }
  }
}

function drawPeasantVariantSheets(scene: Phaser.Scene): void {
  const variants: Array<[string, number]> = [
    ['peasant_elder_m', palette.stoneDark],
    ['peasant_elder_f', 0xb8a898],
    ['peasant_farmer', 0x5a7a3a],
    ['peasant_baker', 0xd4a574],
    ['peasant_merchant', 0x8b6914],
    ['peasant_fisher', 0x3a5a7a],
  ];
  for (const [key, cloth] of variants) {
    drawUnitSheet(scene, 'peasant', { key, cloth });
  }
}

function drawKeep(scene: Phaser.Scene) {
  const scale = 2;
  const baseW = 160;
  const baseH = 120;
  const w = baseW * scale;
  const h = baseH * scale;
  const tex = createCanvas(scene, PROP_KEYS.keep, w, h);
  const ctx = tex.getContext();
  ctx.scale(scale, scale);

  // Outer bailey stone walls
  fillStoneBricks(ctx, 6, 28, 148, 88);
  strokeRectInk(ctx, 6, 28, 148, 88);
  // Battlements
  for (let i = 0; i < 14; i++) {
    fillStoneBricks(ctx, 8 + i * 10, 10, 8, 18, 4, 4);
    fillRect(ctx, 8 + i * 10, 10, 8, 1, palette.ink);
  }
  // Corner towers
  fillStoneBricks(ctx, 4, 18, 18, 30, 6, 5);
  fillStoneBricks(ctx, 138, 18, 18, 30, 6, 5);
  strokeRectInk(ctx, 4, 18, 18, 30);
  strokeRectInk(ctx, 138, 18, 18, 30);
  fillRect(ctx, 8, 14, 10, 8, palette.roof);
  fillRect(ctx, 142, 14, 10, 8, palette.roof);
  // Inner keep block
  fillStoneBricks(ctx, 40, 34, 80, 54, 8, 5);
  strokeRectInk(ctx, 40, 34, 80, 54);
  // Gate arch
  fillRect(ctx, 66, 84, 28, 32, palette.ink);
  fillRect(ctx, 68, 86, 24, 28, palette.woodDark);
  fillRect(ctx, 72, 90, 16, 20, 0x1a1010);
  fillRect(ctx, 70, 84, 20, 6, palette.stone);
  fillRect(ctx, 74, 82, 12, 4, palette.stoneDark);
  // Windows
  fillRect(ctx, 50, 48, 10, 10, palette.ink);
  fillRect(ctx, 52, 50, 6, 6, palette.cream);
  fillRect(ctx, 100, 48, 10, 10, palette.ink);
  fillRect(ctx, 102, 50, 6, 6, palette.cream);
  fillRect(ctx, 68, 44, 24, 12, palette.ink);
  fillRect(ctx, 70, 46, 20, 8, palette.cream);
  // Banner
  fillRect(ctx, 74, 30, 12, 16, palette.clothKing);
  pixel(ctx, 78, 36, palette.gold);
  // Chimney
  fillStoneBricks(ctx, 126, 38, 10, 24, 4, 4);
  fillRect(ctx, 128, 34, 6, 6, palette.ink);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.keepInterior, w, h);
  const ic = int.getContext();
  ic.scale(scale, scale);
  fillFlagstoneFloor(ic, 6, 28, 148, 88);
  strokeRectInk(ic, 6, 28, 148, 88);
  // Courtyard (gate area south)
  fillRect(ic, 50, 78, 60, 32, 0x8a9a70);
  fillRect(ic, 72, 96, 16, 12, palette.dirt);
  // Great hall + throne
  fillRect(ic, 20, 40, 56, 40, palette.wood);
  fillRect(ic, 24, 44, 18, 14, 0x6b2040);
  fillStoneBricks(ic, 48, 44, 22, 20, 6, 4);
  fillRect(ic, 52, 48, 14, 12, palette.gold);
  fillRect(ic, 55, 46, 8, 4, palette.cream);
  fillRect(ic, 40, 36, 6, 12, palette.clothKing);
  // Banquet
  fillRect(ic, 90, 48, 48, 36, palette.wood);
  fillRect(ic, 96, 58, 36, 8, palette.woodDark);
  for (let i = 0; i < 4; i++) {
    fillRect(ic, 98 + i * 8, 54, 4, 4, palette.wood);
  }
  // Kitchen + hearth
  fillStoneBricks(ic, 118, 28, 34, 28, 6, 4);
  fillRect(ic, 124, 38, 16, 12, palette.stoneDark);
  fillRect(ic, 128, 42, 8, 6, palette.ink);
  fillRect(ic, 130, 44, 4, 3, 0xff6622);
  // Servants
  fillRect(ic, 10, 78, 36, 30, palette.wood);
  fillRect(ic, 14, 84, 12, 6, palette.cream);
  fillRect(ic, 28, 84, 12, 6, palette.cream);
  // Royal chambers
  fillRect(ic, 10, 32, 40, 28, 0x4a3058);
  fillRect(ic, 16, 42, 14, 8, palette.clothKing);
  fillRect(ic, 32, 42, 12, 8, palette.cream);
  // Solar
  fillRect(ic, 70, 30, 36, 22, 0x3a4a68);
  fillRect(ic, 78, 38, 20, 8, palette.woodDark);
  // Chapel nook
  fillRect(ic, 8, 52, 20, 22, 0x2a3048);
  fillRect(ic, 14, 58, 8, 10, palette.gold);
  // Armory
  fillStoneBricks(ic, 118, 86, 30, 24, 6, 4);
  fillRect(ic, 124, 92, 6, 12, palette.metal);
  fillRect(ic, 134, 94, 8, 8, palette.woodDark);
  int.refresh();
}

function drawHouse(scene: Phaser.Scene) {
  const w = 56;
  const h = 52;
  const tex = createCanvas(scene, PROP_KEYS.house, w, h);
  const ctx = tex.getContext();
  // low daub walls with timber posts (poor hut)
  fillRect(ctx, 8, 24, 40, 24, 0xc9b896);
  fillRect(ctx, 8, 24, 40, 1, palette.ink);
  fillRect(ctx, 8, 24, 3, 24, palette.woodDark);
  fillRect(ctx, 45, 24, 3, 24, palette.woodDark);
  fillRect(ctx, 26, 24, 2, 24, palette.wood);
  // rough plaster flecks
  pixel(ctx, 14, 30, palette.dirt);
  pixel(ctx, 20, 36, palette.cream);
  pixel(ctx, 34, 32, palette.dirt);
  pixel(ctx, 40, 38, palette.cream);
  // thatched straw roof — thick shallow thatch, not a pointed funnel
  const straw = [palette.wheatDark, palette.wheat, 0xe0c878, 0xc8a848] as const;
  fillRect(ctx, 4, 12, 48, 14, palette.wheat);
  // soft ridge (only a couple px of pitch)
  fillRect(ctx, 10, 10, 36, 2, palette.wheatDark);
  fillRect(ctx, 16, 8, 24, 2, palette.wheat);
  fillRect(ctx, 20, 7, 16, 1, palette.wheatDark);
  // overhang eaves past the walls
  fillRect(ctx, 3, 24, 50, 2, palette.wheatDark);
  // layered courses + vertical strand flecks so it reads as straw
  for (let y = 12; y <= 24; y++) {
    const tone = straw[y % straw.length]!;
    fillRect(ctx, 4, y, 48, 1, tone);
    for (let x = 5 + ((y * 3) % 4); x < 51; x += 3) {
      pixel(ctx, x, y, straw[(y + x) % straw.length]!);
    }
  }
  // ragged fringe under the eaves
  for (let x = 4; x < 52; x += 2) {
    pixel(ctx, x, 26, straw[x % straw.length]!);
    if (x % 4 === 0) pixel(ctx, x + 1, 27, palette.wheatDark);
  }
  // crooked door
  fillRect(ctx, 23, 34, 10, 14, palette.woodDark);
  fillRect(ctx, 24, 35, 8, 12, palette.wood);
  pixel(ctx, 30, 41, palette.ink);
  // single small shuttered window
  fillRect(ctx, 12, 30, 7, 6, palette.ink);
  fillRect(ctx, 13, 31, 2, 4, palette.wood);
  fillRect(ctx, 16, 31, 2, 4, palette.wood);
  // stubby stone chimney through the thatch
  fillRect(ctx, 38, 6, 5, 10, palette.stoneDark);
  fillRect(ctx, 39, 5, 3, 2, palette.stone);
  tex.refresh();
}

function drawWall(scene: Phaser.Scene) {
  for (let mask = 0; mask < 16; mask++) {
    const key = wallTextureKey(mask);
    const tex = createCanvas(scene, key, WALL_SPRITE_W, WALL_SPRITE_H);
    drawWallToTexture(tex, { mask, col: mask, row: 0 });
  }
  const legacy = createCanvas(scene, PROP_KEYS.wall, WALL_SPRITE_W, WALL_SPRITE_H);
  drawWallToTexture(legacy, { mask: 0, col: 0, row: 0 });
}

function drawBallista(scene: Phaser.Scene) {
  const w = 24;
  const h = 20;
  const tex = createCanvas(scene, PROP_KEYS.ballista, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 14, 20, 4, palette.woodDark);
  fillRect(ctx, 4, 12, 16, 6, palette.wood);
  fillRect(ctx, 10, 4, 4, 12, palette.woodDark);
  fillRect(ctx, 2, 6, 20, 2, palette.metal);
  fillRect(ctx, 18, 5, 4, 4, palette.metal);
  fillRect(ctx, 19, 6, 2, 2, palette.ink);
  fillRect(ctx, 6, 10, 3, 4, palette.stoneDark);
  fillRect(ctx, 15, 10, 3, 4, palette.stoneDark);
  tex.refresh();
}

function drawWatchtower(scene: Phaser.Scene) {
  const w = 24;
  const h = 40;
  const tex = createCanvas(scene, PROP_KEYS.watchtower, w, h);
  const ctx = tex.getContext();
  fillStoneBricks(ctx, 6, 14, 12, 24);
  fillRect(ctx, 4, 8, 16, 8, palette.stoneDark);
  fillRect(ctx, 4, 8, 16, 1, palette.ink);
  fillRect(ctx, 3, 6, 18, 2, palette.stone);
  fillRect(ctx, 8, 18, 3, 3, palette.cream);
  fillRect(ctx, 13, 18, 3, 3, palette.cream);
  fillRect(ctx, 5, 4, 3, 6, palette.stone);
  fillRect(ctx, 16, 4, 3, 6, palette.stone);
  fillRect(ctx, 9, 2, 6, 3, palette.woodDark);
  fillRect(ctx, 10, 30, 4, 8, palette.wood);
  pixel(ctx, 11, 32, palette.ink);
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
  const w = FORT_TILE;
  const h = FORT_TILE * 2;
  const open = createCanvas(scene, PROP_KEYS.drawbridge, w, h);
  const octx = open.getContext();
  fillRect(octx, 4, h * 0.55, w - 8, h * 0.32, palette.wood);
  fillRect(octx, 4, h * 0.55, w - 8, 2, palette.ink);
  for (let i = 0; i < 5; i++) {
    fillRect(octx, 8 + i * ((w - 16) / 5), h * 0.58, 4, h * 0.22, palette.woodDark);
  }
  fillRect(octx, 2, h * 0.38, 6, h * 0.2, palette.metal);
  fillRect(octx, w - 8, h * 0.38, 6, h * 0.2, palette.metal);
  fillRect(octx, 3, h * 0.38, 4, h * 0.16, palette.ink);
  fillRect(octx, w - 7, h * 0.38, 4, h * 0.16, palette.ink);
  // Stone jambs flush with wall width
  fillRect(octx, 0, h * 0.35, 6, h * 0.45, palette.stone);
  fillRect(octx, w - 6, h * 0.35, 6, h * 0.45, palette.stone);
  open.refresh();

  const closed = createCanvas(scene, PROP_KEYS.drawbridgeClosed, w, h);
  const cctx = closed.getContext();
  fillRect(cctx, 8, h * 0.32, w - 16, h * 0.48, palette.wood);
  fillRect(cctx, 8, h * 0.32, w - 16, 2, palette.ink);
  for (let i = 0; i < 4; i++) {
    fillRect(cctx, 12 + i * 8, h * 0.36, 4, h * 0.38, palette.woodDark);
  }
  fillRect(cctx, w / 2 - 10, h * 0.42, 20, 14, palette.stoneDark);
  fillRect(cctx, 2, h * 0.28, 8, 10, palette.metal);
  fillRect(cctx, w - 10, h * 0.28, 8, 10, palette.metal);
  fillRect(cctx, 0, h * 0.35, 6, h * 0.45, palette.stone);
  fillRect(cctx, w - 6, h * 0.35, 6, h * 0.45, palette.stone);
  closed.refresh();
}

function drawWallLadder(scene: Phaser.Scene) {
  const w = 14;
  const h = 56;
  const tex = createCanvas(scene, PROP_KEYS.wallLadder, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 4, 3, h - 8, palette.woodDark);
  fillRect(ctx, w - 5, 4, 3, h - 8, palette.woodDark);
  for (let i = 0; i < 5; i++) {
    fillRect(ctx, 2, 8 + i * 10, w - 4, 3, palette.wood);
    fillRect(ctx, 2, 8 + i * 10, w - 4, 1, palette.ink);
  }
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
  const h = 44;
  const tex = createCanvas(scene, PROP_KEYS.granary, w, h);
  const ctx = tex.getContext();
  // Raised stilts
  fillRect(ctx, 8, 36, 3, 6, palette.woodDark);
  fillRect(ctx, 25, 36, 3, 6, palette.woodDark);
  // Tall vertical silo / barn body
  fillRect(ctx, 6, 10, 24, 28, palette.wood);
  fillRect(ctx, 6, 10, 24, 1, palette.ink);
  fillRect(ctx, 6, 10, 1, 28, palette.ink);
  fillRect(ctx, 29, 10, 1, 28, palette.ink);
  // Horizontal plank lines
  for (let py = 14; py < 36; py += 4) {
    fillRect(ctx, 7, py, 22, 1, palette.woodDark);
  }
  // Domed / peaked grain roof (narrow tall, not cottage)
  fillRect(ctx, 8, 6, 20, 5, palette.wheatDark);
  fillRect(ctx, 10, 3, 16, 4, palette.wheat);
  fillRect(ctx, 14, 1, 8, 3, palette.wheatDark);
  fillRect(ctx, 16, 0, 4, 2, palette.wheat);
  // Small high loft windows
  fillRect(ctx, 10, 14, 4, 4, palette.ink);
  fillRect(ctx, 22, 14, 4, 4, palette.ink);
  fillRect(ctx, 11, 15, 2, 2, palette.cream);
  fillRect(ctx, 23, 15, 2, 2, palette.cream);
  // Loading door mid-height + chute
  fillRect(ctx, 14, 24, 8, 10, palette.woodDark);
  fillRect(ctx, 15, 25, 6, 8, palette.dirt);
  fillRect(ctx, 16, 34, 4, 4, palette.wheat);
  // Grain sacks at base
  fillRect(ctx, 4, 34, 5, 5, palette.wheat);
  fillRect(ctx, 5, 35, 3, 3, palette.wheatDark);
  fillRect(ctx, 27, 34, 5, 5, palette.wheat);
  fillRect(ctx, 28, 35, 3, 3, palette.wheatDark);
  tex.refresh();
}

function drawManor(scene: Phaser.Scene) {
  const w = 64;
  const h = 56;
  const tex = createCanvas(scene, PROP_KEYS.manor, w, h);
  const ctx = tex.getContext();
  // Twin stone wings
  fillRect(ctx, 2, 22, 18, 28, palette.stone);
  fillRect(ctx, 44, 22, 18, 28, palette.stone);
  // Central hall (taller)
  fillRect(ctx, 16, 18, 32, 32, palette.stone);
  fillRect(ctx, 16, 18, 32, 1, palette.ink);
  // Dark timber trim
  fillRect(ctx, 2, 22, 18, 1, palette.ink);
  fillRect(ctx, 44, 22, 18, 1, palette.ink);
  // Blue slate roofs on wings (not red cottage)
  for (let row = 0; row < 6; row++) {
    fillRect(ctx, 2 + row, 16 + row, 18 - row * 2, 1, 0x4a5a7a);
    fillRect(ctx, 44 + row, 16 + row, 18 - row * 2, 1, 0x4a5a7a);
  }
  // Central steep roof with gold ridge
  for (let row = 0; row < 10; row++) {
    fillRect(ctx, 16 + row, 8 + row, 32 - row * 2, 1, 0x3a4a6a);
  }
  fillRect(ctx, 28, 6, 8, 3, palette.gold);
  // Twin chimneys
  fillRect(ctx, 8, 10, 4, 10, palette.stoneDark);
  fillRect(ctx, 52, 10, 4, 10, palette.stoneDark);
  fillRect(ctx, 8, 9, 4, 2, palette.stone);
  fillRect(ctx, 52, 9, 4, 2, palette.stone);
  // Grand double door + steps
  fillRect(ctx, 26, 36, 12, 14, palette.woodDark);
  fillRect(ctx, 28, 38, 3, 10, palette.wood);
  fillRect(ctx, 33, 38, 3, 10, palette.wood);
  fillRect(ctx, 24, 48, 16, 3, palette.stoneDark);
  fillRect(ctx, 26, 50, 12, 2, palette.stone);
  // Wing windows (tall)
  fillRect(ctx, 6, 28, 5, 8, palette.cream);
  fillRect(ctx, 8, 28, 1, 8, palette.ink);
  fillRect(ctx, 53, 28, 5, 8, palette.cream);
  fillRect(ctx, 55, 28, 1, 8, palette.ink);
  // Hall windows
  fillRect(ctx, 20, 24, 6, 6, palette.cream);
  fillRect(ctx, 38, 24, 6, 6, palette.cream);
  // Banners
  fillRect(ctx, 18, 20, 2, 10, palette.clothKing);
  fillRect(ctx, 44, 20, 2, 10, palette.clothQueen);
  pixel(ctx, 18, 20, palette.gold);
  pixel(ctx, 44, 20, palette.gold);
  tex.refresh();
}

function drawBakery(scene: Phaser.Scene) {
  const w = 44;
  const h = 40;
  const tex = createCanvas(scene, PROP_KEYS.bakery, w, h);
  const ctx = tex.getContext();
  // Warm plaster shop body
  fillRect(ctx, 4, 16, 28, 20, 0xd4c4a0);
  fillRect(ctx, 4, 16, 28, 1, palette.ink);
  fillRect(ctx, 4, 16, 1, 20, palette.woodDark);
  fillRect(ctx, 31, 16, 1, 20, palette.woodDark);
  // Shallow terracotta roof (not peaked cottage clone)
  fillRect(ctx, 2, 12, 32, 5, 0xc06040);
  fillRect(ctx, 4, 10, 28, 3, 0xd47850);
  fillRect(ctx, 8, 8, 20, 3, 0xc06040);
  // Brick oven bulge on the right
  fillRect(ctx, 30, 18, 12, 16, palette.stone);
  fillRect(ctx, 32, 20, 8, 10, palette.stoneDark);
  fillRect(ctx, 34, 22, 4, 6, palette.ink);
  fillRect(ctx, 35, 24, 2, 3, 0xff8844);
  // Smoking chimney
  fillRect(ctx, 36, 6, 5, 14, palette.stoneDark);
  fillRect(ctx, 37, 5, 3, 2, palette.stone);
  pixel(ctx, 38, 3, palette.stoneDark);
  pixel(ctx, 39, 2, palette.stone);
  pixel(ctx, 37, 2, palette.stoneDark);
  // Shop window with bread loaves
  fillRect(ctx, 8, 20, 14, 8, palette.ink);
  fillRect(ctx, 9, 21, 12, 6, 0x87a8c8);
  fillRect(ctx, 10, 24, 3, 2, 0xe8c070);
  fillRect(ctx, 14, 23, 3, 3, 0xe0b060);
  fillRect(ctx, 18, 24, 3, 2, 0xe8c070);
  // Striped awning
  fillRect(ctx, 7, 18, 16, 3, palette.cream);
  fillRect(ctx, 7, 18, 4, 3, 0xc04545);
  fillRect(ctx, 15, 18, 4, 3, 0xc04545);
  // Door
  fillRect(ctx, 24, 26, 6, 10, palette.woodDark);
  pixel(ctx, 28, 31, palette.gold);
  // Hanging pretzel / bread sign
  fillRect(ctx, 12, 6, 2, 5, palette.wood);
  fillRect(ctx, 10, 4, 6, 4, 0xe8c070);
  pixel(ctx, 11, 5, 0xc09040);
  pixel(ctx, 14, 5, 0xc09040);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.bakeryInterior, w, h);
  const ic = int.getContext();
  drawInteriorWallH(ic, 4, 16, 28);
  drawInteriorWallV(ic, 4, 16, 20);
  drawInteriorWallV(ic, 29, 16, 20);
  fillRect(ic, 4, 16, 28, 20, 0xe8dcc8);
  fillRect(ic, 6, 18, 24, 16, 0xf0e4d0);
  // oven interior
  fillRect(ic, 30, 18, 10, 14, palette.stoneDark);
  fillRect(ic, 32, 20, 6, 8, palette.ink);
  fillRect(ic, 34, 22, 2, 4, 0xff8844);
  // counter + loaves
  fillRect(ic, 8, 22, 16, 6, palette.wood);
  fillRect(ic, 10, 20, 4, 3, 0xe8c070);
  fillRect(ic, 16, 19, 4, 4, 0xe0b060);
  // flour sacks
  fillRect(ic, 6, 28, 6, 6, palette.cream);
  fillRect(ic, 14, 28, 6, 6, 0xd4c4a0);
  int.refresh();
}

function drawBarracks(scene: Phaser.Scene) {
  const w = 40;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.barracks, w, h);
  const ctx = tex.getContext();
  fillStoneBricks(ctx, 4, 10, 32, 20);
  fillRect(ctx, 4, 10, 32, 1, palette.ink);
  fillRect(ctx, 2, 6, 36, 5, palette.roof);
  fillRect(ctx, 6, 4, 28, 3, 0x8a3535);
  fillRect(ctx, 16, 20, 8, 10, palette.woodDark);
  fillRect(ctx, 8, 14, 4, 4, palette.cream);
  fillRect(ctx, 28, 14, 4, 4, palette.cream);
  fillRect(ctx, 30, 6, 2, 8, palette.metal);
  fillRect(ctx, 6, 22, 6, 2, palette.metal);
  fillRect(ctx, 28, 22, 6, 2, palette.metal);
  tex.refresh();
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
  const scale = 5;
  const baseW = 64;
  const baseH = 56;
  const w = baseW * scale;
  const h = baseH * scale;
  const tex = createCanvas(scene, PROP_KEYS.cathedral, w, h);
  const ctx = tex.getContext();
  ctx.scale(scale, scale);

  fillStoneBricks(ctx, 8, 22, 48, 34);
  strokeRectInk(ctx, 8, 22, 48, 34);
  // Steep roof planes
  for (let row = 0; row < 12; row++) {
    fillRect(ctx, 10 + row, 10 + row, 44 - row * 2, 2, palette.clothBishop);
    fillRect(ctx, 10 + row, 10 + row, 44 - row * 2, 1, palette.ink);
  }
  // Central spire
  fillStoneBricks(ctx, 26, 4, 12, 20, 4, 4);
  fillRect(ctx, 28, 2, 8, 4, palette.gold);
  fillRect(ctx, 30, 0, 4, 3, palette.gold);
  // Rose window
  fillRect(ctx, 26, 30, 12, 10, palette.ink);
  fillRect(ctx, 28, 32, 8, 6, 0x7ec8e3);
  // Grand portal
  fillRect(ctx, 24, 40, 16, 16, palette.ink);
  fillRect(ctx, 26, 42, 12, 14, palette.woodDark);
  fillRect(ctx, 28, 44, 4, 10, palette.wood);
  fillRect(ctx, 34, 44, 4, 10, palette.wood);
  fillRect(ctx, 22, 52, 20, 4, palette.stoneDark);
  // Lancet windows
  fillRect(ctx, 12, 28, 6, 10, palette.ink);
  fillRect(ctx, 14, 30, 2, 6, palette.cream);
  fillRect(ctx, 46, 28, 6, 10, palette.ink);
  fillRect(ctx, 48, 30, 2, 6, 0x7ec8e3);
  // Buttress hints
  fillRect(ctx, 6, 26, 4, 28, palette.stoneDark);
  fillRect(ctx, 54, 26, 4, 28, palette.stoneDark);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.cathedralInterior, w, h);
  const ic = int.getContext();
  ic.scale(scale, scale);
  fillFlagstoneFloor(ic, 8, 22, 48, 34);
  strokeRectInk(ic, 8, 22, 48, 34);
  // Central aisle
  fillRect(ic, 28, 24, 8, 30, palette.cream);
  // Vault ribs
  for (let i = 0; i < 5; i++) {
    fillRect(ic, 12 + i * 10, 22, 1, 8, palette.stoneDark);
  }
  // Pews left
  for (const py of [30, 38, 46]) {
    fillRect(ic, 12, py, 12, 4, palette.woodDark);
    fillRect(ic, 12, py + 4, 12, 2, palette.wood);
  }
  // Pews right
  for (const py of [30, 38, 46]) {
    fillRect(ic, 40, py, 12, 4, palette.woodDark);
    fillRect(ic, 40, py + 4, 12, 2, palette.wood);
  }
  // Altar
  fillRect(ic, 26, 24, 12, 8, palette.gold);
  fillRect(ic, 28, 26, 8, 4, palette.cream);
  fillRect(ic, 30, 22, 4, 4, palette.gold);
  // Stained glass light
  fillRect(ic, 12, 26, 4, 8, 0x7ec8e3);
  fillRect(ic, 48, 26, 4, 8, palette.clothBishop);
  pixel(ic, 14, 28, 0xffcc44);
  pixel(ic, 50, 28, 0xffcc44);
  // Candles
  fillRect(ic, 24, 28, 1, 4, palette.cream);
  fillRect(ic, 39, 28, 1, 4, palette.cream);
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
  const scale = 5;
  const baseW = 40;
  const baseH = 32;
  const w = baseW * scale;
  const h = baseH * scale;
  const tex = createCanvas(scene, PROP_KEYS.dungeon, w, h);
  const ctx = tex.getContext();
  ctx.scale(scale, scale);

  fillStoneBricks(ctx, 4, 8, 32, 22);
  strokeRectInk(ctx, 4, 8, 32, 22);
  // Iron gate
  fillRect(ctx, 14, 16, 12, 14, palette.ink);
  fillRect(ctx, 16, 18, 8, 10, 0x1a1018);
  for (let i = 0; i < 4; i++) {
    fillRect(ctx, 17 + i * 2, 18, 1, 10, palette.metal);
  }
  // Barred windows
  fillRect(ctx, 6, 12, 5, 5, palette.ink);
  fillRect(ctx, 7, 13, 3, 3, 0x2a2830);
  fillRect(ctx, 29, 12, 5, 5, palette.ink);
  fillRect(ctx, 30, 13, 3, 3, 0x2a2830);
  // Torch brackets
  fillRect(ctx, 8, 14, 3, 4, palette.metal);
  pixel(ctx, 9, 13, 0xff6622);
  fillRect(ctx, 29, 14, 3, 4, palette.metal);
  pixel(ctx, 30, 13, 0xff6622);
  // Moss flecks
  pixel(ctx, 6, 24, palette.grassDark);
  pixel(ctx, 34, 20, palette.forest);
  // Chains
  fillRect(ctx, 32, 18, 2, 8, palette.metal);
  fillRect(ctx, 33, 24, 3, 2, palette.metal);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.dungeonInterior, w, h);
  const ic = int.getContext();
  ic.scale(scale, scale);
  fillRect(ic, 4, 8, 32, 22, 0x1a1820);
  fillFlagstoneFloor(ic, 6, 10, 28, 18);
  // Central corridor
  fillRect(ic, 16, 12, 8, 16, 0x252530);
  // Four cells
  for (let i = 0; i < 4; i++) {
    const cx = 7 + i * 7;
    fillRect(ic, cx, 12, 6, 10, palette.ink);
    fillRect(ic, cx + 1, 13, 4, 8, 0x0a0810);
    fillRect(ic, cx + 2, 14, 2, 6, palette.metal);
  }
  // Keeper desk
  fillRect(ic, 28, 20, 8, 4, palette.woodDark);
  fillRect(ic, 30, 18, 4, 2, palette.cream);
  pixel(ic, 31, 19, palette.gold);
  // Wall torches
  pixel(ic, 10, 14, 0xff6622);
  pixel(ic, 28, 14, 0xff6622);
  int.refresh();
}

function drawMarket(scene: Phaser.Scene) {
  const w = 44;
  const h = 32;
  const tex = createCanvas(scene, PROP_KEYS.market, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 16, 36, 14, palette.dirt);
  fillRect(ctx, 8, 6, 28, 14, palette.clothPeasant);
  fillRect(ctx, 8, 6, 28, 1, palette.ink);
  fillRect(ctx, 20, 2, 2, 10, palette.wood);
  fillRect(ctx, 10, 18, 10, 6, palette.wood);
  fillRect(ctx, 24, 18, 10, 6, palette.woodDark);
  pixel(ctx, 14, 16, palette.gold);
  pixel(ctx, 28, 16, palette.wheat);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.marketInterior, w, h);
  const ic = int.getContext();
  drawInteriorWallH(ic, 4, 8, 36);
  drawInteriorWallV(ic, 4, 8, 20);
  drawInteriorWallV(ic, 37, 8, 20);
  fillRect(ic, 4, 16, 36, 14, palette.dirt);
  fillRect(ic, 6, 14, 32, 12, 0xe8dcc8);
  // stalls
  fillRect(ic, 8, 18, 12, 8, palette.wood);
  fillRect(ic, 10, 16, 3, 3, palette.gold);
  fillRect(ic, 14, 17, 3, 2, 0xe8c070);
  fillRect(ic, 24, 18, 12, 8, palette.woodDark);
  fillRect(ic, 26, 16, 3, 3, palette.wheat);
  fillRect(ic, 30, 17, 3, 2, palette.cream);
  // center scale
  fillRect(ic, 20, 20, 4, 4, palette.metal);
  fillRect(ic, 21, 18, 2, 2, palette.gold);
  int.refresh();
}

function drawCemetery(scene: Phaser.Scene) {
  const w = 48;
  const h = 36;
  const tex = createCanvas(scene, PROP_KEYS.cemetery, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 18, 44, 16, palette.grassDark);
  fillRect(ctx, 8, 10, 6, 14, palette.stone);
  fillRect(ctx, 10, 8, 2, 4, palette.stoneDark);
  fillRect(ctx, 22, 12, 6, 12, palette.stone);
  fillRect(ctx, 24, 10, 2, 4, palette.stoneDark);
  fillRect(ctx, 34, 10, 6, 14, palette.stone);
  fillRect(ctx, 36, 8, 2, 4, palette.stoneDark);
  fillRect(ctx, 4, 20, 40, 2, palette.ink);
  fillRect(ctx, 18, 4, 4, 8, palette.woodDark);
  tex.refresh();
}

function drawGallows(scene: Phaser.Scene) {
  const w = 28;
  const h = 40;
  const tex = createCanvas(scene, PROP_KEYS.gallows, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 34, 20, 4, palette.woodDark);
  fillRect(ctx, 6, 6, 3, 28, palette.wood);
  fillRect(ctx, 6, 6, 16, 3, palette.wood);
  fillRect(ctx, 18, 9, 2, 10, palette.ink);
  fillRect(ctx, 16, 18, 6, 6, palette.clothExecutioner);
  tex.refresh();
}

function drawRoad(scene: Phaser.Scene) {
  const w = 16;
  const h = 16;
  const tex = createCanvas(scene, PROP_KEYS.road, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 0, 0, w, h, palette.dirt);
  fillRect(ctx, 0, 0, w, 1, palette.dirtDark);
  fillRect(ctx, 0, h - 1, w, 1, palette.dirtDark);
  pixel(ctx, 4, 5, palette.dirtDark);
  pixel(ctx, 11, 10, palette.dirtDark);
  tex.refresh();
}

function drawBridge(scene: Phaser.Scene) {
  const w = 48;
  const h = 20;
  const tex = createCanvas(scene, PROP_KEYS.bridge, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 8, 44, 8, palette.wood);
  fillRect(ctx, 2, 8, 44, 1, palette.ink);
  fillRect(ctx, 2, 7, 44, 1, palette.woodDark);
  fillRect(ctx, 4, 4, 2, 12, palette.woodDark);
  fillRect(ctx, 42, 4, 2, 12, palette.woodDark);
  for (let x = 6; x < 44; x += 4) fillRect(ctx, x, 10, 2, 1, palette.woodDark);
  tex.refresh();

  const texV = createCanvas(scene, PROP_KEYS.bridgeV, 20, 48);
  const cv = texV.getContext();
  fillRect(cv, 6, 2, 8, 44, palette.wood);
  fillRect(cv, 6, 2, 1, 44, palette.ink);
  fillRect(cv, 4, 4, 12, 2, palette.woodDark);
  fillRect(cv, 4, 42, 12, 2, palette.woodDark);
  texV.refresh();
}

function drawDock(scene: Phaser.Scene) {
  const w = 40;
  const h = 28;
  const tex = createCanvas(scene, PROP_KEYS.dock, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 0, 18, 40, 10, palette.water);
  for (let x = 2; x < 38; x += 6) pixel(ctx, x, 20, 0x3a7a9a);
  fillRect(ctx, 4, 10, 32, 12, palette.wood);
  fillRect(ctx, 4, 10, 32, 1, palette.ink);
  for (let py = 12; py < 20; py += 3) fillRect(ctx, 5, py, 30, 1, palette.woodDark);
  fillRect(ctx, 8, 6, 3, 8, palette.woodDark);
  fillRect(ctx, 28, 6, 3, 8, palette.woodDark);
  fillRect(ctx, 10, 4, 8, 6, palette.wood);
  fillRect(ctx, 12, 5, 4, 3, 0x4a8f9a);
  fillRect(ctx, 32, 16, 6, 4, palette.wood);
  pixel(ctx, 34, 17, palette.woodDark);
  tex.refresh();
}

function drawVampireCastle(scene: Phaser.Scene) {
  const w = 56;
  const h = 48;
  const tex = createCanvas(scene, PROP_KEYS.vampireCastle, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 8, 16, 40, 28, palette.stoneDark);
  fillRect(ctx, 8, 8, 12, 12, palette.stoneDark);
  fillRect(ctx, 36, 8, 12, 12, palette.stoneDark);
  fillRect(ctx, 22, 28, 12, 16, palette.ink);
  fillRect(ctx, 12, 20, 6, 6, 0x4a1020);
  fillRect(ctx, 38, 20, 6, 6, 0x4a1020);
  tex.refresh();

  const int = createCanvas(scene, PROP_KEYS.vampireCastleInterior, w, h);
  const ic = int.getContext();
  // Gloomy stone hall floor
  fillRect(ic, 8, 16, 40, 28, 0x241018);
  fillRect(ic, 10, 18, 36, 24, 0x321622);
  // Coffin resting against the back wall
  fillRect(ic, 32, 30, 12, 10, palette.woodDark);
  fillRect(ic, 34, 28, 8, 4, palette.woodDark);
  // Red carpet runner to the door
  fillRect(ic, 24, 30, 8, 12, 0x6b1020);
  // Cobweb-hung candelabra glow
  fillRect(ic, 14, 22, 6, 8, 0x1a0812);
  fillRect(ic, 16, 20, 2, 4, 0xffcc66);
  // Tall arched window with moonlight
  fillRect(ic, 40, 20, 6, 10, 0x1a2a3a);
  fillRect(ic, 41, 21, 4, 8, 0x33445a);
  int.refresh();
}

function drawFishingBoat(scene: Phaser.Scene) {
  const w = 28;
  const h = 16;
  const tex = createCanvas(scene, PROP_KEYS.fishingBoat, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 8, 24, 6, palette.woodDark);
  fillRect(ctx, 4, 6, 20, 4, palette.wood);
  fillRect(ctx, 14, 2, 2, 8, palette.woodDark);
  fillRect(ctx, 16, 3, 6, 4, palette.cream);
  tex.refresh();
}

function drawWarship(scene: Phaser.Scene) {
  const w = 40;
  const h = 22;
  const tex = createCanvas(scene, PROP_KEYS.warship, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 12, 36, 8, palette.woodDark);
  fillRect(ctx, 4, 8, 32, 6, palette.wood);
  fillRect(ctx, 12, 2, 3, 12, palette.woodDark);
  fillRect(ctx, 16, 3, 10, 8, palette.clothGuard);
  fillRect(ctx, 30, 10, 6, 3, palette.metal);
  tex.refresh();
}

function drawCarriage(scene: Phaser.Scene) {
  const w = 32;
  const h = 24;
  const tex = createCanvas(scene, PROP_KEYS.carriage, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 8, 22, 10, palette.wood);
  fillRect(ctx, 4, 8, 22, 1, palette.ink);
  fillRect(ctx, 8, 10, 6, 5, palette.cream);
  fillRect(ctx, 16, 10, 6, 5, palette.gold);
  fillRect(ctx, 6, 16, 5, 5, palette.ink);
  fillRect(ctx, 20, 16, 5, 5, palette.ink);
  fillRect(ctx, 24, 10, 6, 4, palette.woodDark);
  tex.refresh();
}

/** Small campfire glow, anchored at its base (x, y). */
function drawFirePit(ctx: Ctx, x: number, y: number) {
  fillRect(ctx, x - 3, y, 7, 2, palette.stoneDark);
  fillRect(ctx, x - 2, y - 5, 5, 6, 0xff6622);
  fillRect(ctx, x - 1, y - 8, 3, 4, 0xffcc44);
}

/** Palisade post, anchored at its base (x, y), growing upward `h` px. */
function drawFencePost(ctx: Ctx, x: number, y: number, h: number) {
  fillRect(ctx, x, y - h, 2, h, palette.woodDark);
  fillRect(ctx, x, y - h, 2, 1, palette.wood);
}

/** A-frame tent at (x, y) top-left, sized w × h, with a doorway + pole. */
function drawTent(ctx: Ctx, x: number, y: number, w: number, h: number, cloth: number) {
  fillRect(ctx, x, y, w, h, cloth);
  fillRect(ctx, x, y, w, 1, palette.ink);
  fillRect(ctx, x + Math.floor(w / 2) - 1, y - 6, 2, 6, palette.wood);
  const doorW = Math.max(3, Math.floor(w * 0.28));
  fillRect(
    ctx,
    x + Math.floor((w - doorW) / 2),
    y + h - 5,
    doorW,
    5,
    0x0a0608
  );
}

/** Covered wagon at (x, y) top-left, wheels included. */
function drawWagon(ctx: Ctx, x: number, y: number) {
  fillRect(ctx, x, y, 18, 9, palette.wood);
  fillRect(ctx, x, y, 18, 1, palette.woodDark);
  fillRect(ctx, x + 2, y - 5, 14, 6, palette.clothPeasant);
  fillRect(ctx, x + 2, y - 5, 14, 1, palette.ink);
  fillRect(ctx, x + 1, y + 8, 5, 5, palette.ink);
  fillRect(ctx, x + 12, y + 8, 5, 5, palette.ink);
  pixel(ctx, x + 3, y + 10, palette.stone);
  pixel(ctx, x + 14, y + 10, palette.stone);
}

function drawCampVariant(
  scene: Phaser.Scene,
  key: string,
  tentColor: number,
  accent: number
) {
  const w = 52;
  const h = 36;
  const tex = createCanvas(scene, key, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 18, 44, 16, palette.dirt);
  for (let i = 0; i < 5; i++) drawFencePost(ctx, 4 + i * 10, 34, 8);
  drawTent(ctx, 8, 8, 22, 16, tentColor);
  drawTent(ctx, 32, 12, 14, 12, accent);
  drawFirePit(ctx, 42, 30);
  tex.refresh();
}

function drawGypsyCamp(scene: Phaser.Scene) {
  drawCampVariant(
    scene,
    PROP_KEYS.gypsyCamp,
    palette.clothGypsy,
    palette.gold
  );
}

function drawCovenCamp(scene: Phaser.Scene) {
  drawCampVariant(
    scene,
    PROP_KEYS.covenCamp,
    palette.clothWitch,
    palette.ink
  );
}

function drawVenueBanner(
  scene: Phaser.Scene,
  key: string,
  cloth: number,
  archGold: boolean
) {
  const w = 28;
  const h = 24;
  const tex = createCanvas(scene, key, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 4, 3, 18, palette.wood);
  fillRect(ctx, 21, 4, 3, 18, palette.wood);
  if (archGold) {
    fillRect(ctx, 4, 2, 20, 3, palette.gold);
  } else {
    fillRect(ctx, 4, 2, 20, 3, palette.woodDark);
  }
  fillRect(ctx, 8, 6, 12, 10, cloth);
  fillRect(ctx, 8, 6, 12, 1, palette.ink);
  pixel(ctx, 13, 10, palette.cream);
  tex.refresh();
}

function drawBallTable(scene: Phaser.Scene) {
  const w = 36;
  const h = 16;
  const tex = createCanvas(scene, PROP_KEYS.ballTable, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 2, 6, 32, 8, palette.wood);
  fillRect(ctx, 2, 6, 32, 1, palette.ink);
  fillRect(ctx, 4, 8, 6, 3, palette.clothPrincess);
  fillRect(ctx, 14, 8, 8, 3, palette.gold);
  fillRect(ctx, 26, 8, 6, 3, palette.clothKing);
  pixel(ctx, 8, 5, palette.cream);
  pixel(ctx, 18, 5, palette.cream);
  pixel(ctx, 28, 5, palette.cream);
  tex.refresh();
}

function drawHorse(scene: Phaser.Scene) {
  const w = 28;
  const h = 22;
  const tex = createCanvas(scene, PROP_KEYS.horse, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 6, 8, 16, 8, palette.wood);
  fillRect(ctx, 18, 4, 8, 8, palette.woodDark);
  fillRect(ctx, 22, 6, 4, 3, palette.cream);
  fillRect(ctx, 8, 14, 3, 6, palette.woodDark);
  fillRect(ctx, 16, 14, 3, 6, palette.woodDark);
  fillRect(ctx, 4, 10, 4, 3, palette.ink);
  pixel(ctx, 24, 7, palette.ink);
  tex.refresh();
}

function drawJuggleBall(scene: Phaser.Scene) {
  const w = 6;
  const h = 6;
  const tex = createCanvas(scene, PROP_KEYS.juggleBall, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 1, 1, 4, 4, palette.clothJester);
  pixel(ctx, 2, 2, palette.gold);
  tex.refresh();
}

function drawVenueProps(scene: Phaser.Scene) {
  drawVenueBanner(scene, PROP_KEYS.venueFestival, palette.clothPeasant, true);
  drawVenueBanner(scene, PROP_KEYS.venueWedding, palette.clothPrincess, true);
  drawVenueBanner(scene, PROP_KEYS.venueJoust, palette.clothKnight, false);
  drawVenueBanner(scene, PROP_KEYS.venueFuneral, palette.stoneDark, false);
  drawVenueBanner(scene, PROP_KEYS.venueBall, palette.clothKing, true);
  drawHorse(scene);
  drawJuggleBall(scene);
  drawBallTable(scene);
}

function drawBanditCamp(scene: Phaser.Scene) {
  const w = 56;
  const h = 40;
  const tex = createCanvas(scene, PROP_KEYS.banditCamp, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 22, 48, 16, palette.dirt);
  for (let i = 0; i < 6; i++) drawFencePost(ctx, 4 + i * 9, 38, 8);
  drawTent(ctx, 6, 12, 20, 16, palette.clothBandit);
  drawTent(ctx, 30, 16, 16, 12, 0x3a2a1a);
  drawFirePit(ctx, 44, 34);
  fillRect(ctx, 48, 6, 2, 12, palette.wood);
  fillRect(ctx, 46, 4, 6, 4, palette.clothBandit);
  tex.refresh();
}

/** Crude spiked palisade + skull totem, ramshackle tents in goblin green. */
function drawGoblinCamp(scene: Phaser.Scene) {
  const w = 54;
  const h = 38;
  const tex = createCanvas(scene, PROP_KEYS.goblinCamp, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 20, 46, 16, palette.dirt);
  for (let i = 0; i < 6; i++) drawFencePost(ctx, 4 + i * 9, 36, 10);
  // skull atop the tallest post, warning off intruders
  fillRect(ctx, 6, 22, 4, 4, palette.cream);
  drawTent(ctx, 8, 10, 18, 14, palette.clothGoblin);
  drawTent(ctx, 28, 14, 14, 10, 0x2a5a28);
  drawFirePit(ctx, 42, 32);
  fillRect(ctx, 46, 8, 2, 10, palette.wood);
  fillRect(ctx, 44, 6, 6, 3, palette.clothGoblin);
  tex.refresh();
}

/** Sparse, oversized camp: a bonfire, a hide lean-to, and a huge log seat. */
function drawGiantCamp(scene: Phaser.Scene) {
  const w = 72;
  const h = 52;
  const tex = createCanvas(scene, PROP_KEYS.giantCamp, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 30, 64, 18, palette.dirt);
  fillRect(ctx, 6, 40, 28, 8, palette.woodDark); // felled-log seat
  fillRect(ctx, 6, 40, 28, 2, palette.wood);
  // Oversized club propped by the lean-to
  fillRect(ctx, 8, 12, 3, 26, palette.woodDark);
  fillRect(ctx, 6, 8, 7, 6, palette.wood);
  drawTent(ctx, 34, 8, 30, 26, palette.clothGiant);
  fillRect(ctx, 34, 4, 4, 8, palette.woodDark); // crude bone/pole marker
  fillRect(ctx, 33, 2, 6, 3, palette.cream);
  drawFirePit(ctx, 12, 38);
  tex.refresh();
}

function drawThiefDen(scene: Phaser.Scene) {
  const w = 52;
  const h = 36;
  const tex = createCanvas(scene, PROP_KEYS.thiefDen, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 18, 44, 16, palette.ink);
  fillRect(ctx, 8, 8, 28, 14, palette.stoneDark);
  fillRect(ctx, 8, 8, 28, 1, 0x0a0608);
  fillRect(ctx, 16, 14, 10, 8, 0x0a0608);
  fillRect(ctx, 38, 4, 3, 8, palette.wood);
  fillRect(ctx, 40, 22, 8, 8, palette.woodDark);
  fillRect(ctx, 42, 24, 3, 3, palette.stone);
  drawFirePit(ctx, 12, 32);
  tex.refresh();
}

function drawSiegeCamp(scene: Phaser.Scene) {
  const w = 88;
  const h = 52;
  const tex = createCanvas(scene, PROP_KEYS.siegeCamp, w, h);
  const ctx = tex.getContext();
  fillRect(ctx, 4, 28, 80, 20, palette.dirt);
  for (let i = 0; i < 9; i++) drawFencePost(ctx, 4 + i * 9, 48, 8);
  drawTent(ctx, 8, 14, 24, 18, palette.clothEnemyArmy);
  drawTent(ctx, 34, 18, 18, 14, palette.clothGeneral);
  drawWagon(ctx, 54, 30);
  drawWagon(ctx, 68, 22);
  fillRect(ctx, 44, 6, 2, 12, palette.metal);
  fillRect(ctx, 40, 2, 10, 6, palette.clothEnemyArmy);
  drawFirePit(ctx, 20, 44);
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
    PROP_KEYS.wallLadder,
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
    PROP_KEYS.bakery,
    PROP_KEYS.market,
    PROP_KEYS.cemetery,
    PROP_KEYS.gallows,
    PROP_KEYS.road,
    PROP_KEYS.bridge,
    PROP_KEYS.bridgeV,
    PROP_KEYS.dock,
    PROP_KEYS.fishingBoat,
    PROP_KEYS.warship,
    PROP_KEYS.vampireCastle,
    PROP_KEYS.vampireCastleInterior,
    PROP_KEYS.carriage,
    PROP_KEYS.banditCamp,
    PROP_KEYS.goblinCamp,
    PROP_KEYS.giantCamp,
    PROP_KEYS.thiefDen,
    PROP_KEYS.siegeCamp,
    PROP_KEYS.gypsyCamp,
    PROP_KEYS.covenCamp,
    PROP_KEYS.venueFestival,
    PROP_KEYS.venueWedding,
    PROP_KEYS.venueJoust,
    PROP_KEYS.venueFuneral,
    PROP_KEYS.venueBall,
    PROP_KEYS.ballTable,
    PROP_KEYS.horse,
    PROP_KEYS.juggleBall,
    PROP_KEYS.houseInterior,
    PROP_KEYS.keepInterior,
    PROP_KEYS.tavernInterior,
    PROP_KEYS.cathedralInterior,
    PROP_KEYS.infirmaryInterior,
    PROP_KEYS.dungeonInterior,
    PROP_KEYS.bakeryInterior,
    PROP_KEYS.marketInterior,
    PROP_KEYS.manorInterior,
    PROP_KEYS.granaryInterior,
    PROP_KEYS.barracksInterior,
    PROP_KEYS.watchtowerInterior,
    PROP_KEYS.dockInterior,
    PROP_KEYS.cemeteryInterior,
    PROP_KEYS.gallowsInterior,
    PROP_KEYS.banditCampInterior,
    PROP_KEYS.thiefDenInterior,
    PROP_KEYS.gypsyCampInterior,
    ...Array.from({ length: 16 }, (_, i) => wallTextureKey(i)),
  ];
  for (const key of [
    TERRAIN_KEY,
    ...uniqueSheetRoles(),
    'peasant_elder_m',
    'peasant_elder_f',
    'peasant_farmer',
    'peasant_baker',
    'peasant_merchant',
    'peasant_fisher',
    ...propKeys,
  ]) {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  }

  drawTerrain(scene);
  for (const role of uniqueSheetRoles()) {
    drawUnitSheet(scene, role);
  }
  drawPeasantVariantSheets(scene);
  drawKeep(scene);
  drawHouse(scene);
  drawWall(scene);
  drawTavern(scene);
  drawDrawbridge(scene);
  drawWallLadder(scene);
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
  drawBakery(scene);
  drawMarket(scene);
  drawCemetery(scene);
  drawGallows(scene);
  drawRoad(scene);
  drawBridge(scene);
  drawDock(scene);
  drawVampireCastle(scene);
  drawFishingBoat(scene);
  drawWarship(scene);
  drawCarriage(scene);
  drawBanditCamp(scene);
  drawGoblinCamp(scene);
  drawGiantCamp(scene);
  drawThiefDen(scene);
  drawSiegeCamp(scene);
  drawGypsyCamp(scene);
  drawCovenCamp(scene);
  drawVenueProps(scene);
  drawTavernInterior(scene);
  drawSupplementaryInteriors(scene);

  const terrain = scene.textures.get(TERRAIN_KEY);
  for (let i = 0; i < 7; i++) {
    const name = String(i);
    if (!terrain.has(name)) {
      terrain.add(name, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
    }
  }
}

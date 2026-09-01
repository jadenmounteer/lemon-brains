import { palette } from './palette';

export type Ctx = CanvasRenderingContext2D;

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function fillRect(
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

export function pixel(ctx: Ctx, x: number, y: number, color: number) {
  fillRect(ctx, x, y, 1, 1, color);
}

export function drawInteriorWallH(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h = 3
) {
  fillRect(ctx, x, y, w, h, palette.woodDark);
  fillRect(ctx, x, y + 1, w, h - 2, palette.wood);
  fillRect(ctx, x, y, w, 1, palette.ink);
}

export function drawInteriorWallV(
  ctx: Ctx,
  x: number,
  y: number,
  h: number,
  w = 3
) {
  fillRect(ctx, x, y, w, h, palette.woodDark);
  fillRect(ctx, x + 1, y, w - 2, h, palette.wood);
  fillRect(ctx, x, y, 1, h, palette.ink);
}

export function drawInteriorFloor(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number = palette.dirt
) {
  fillRect(ctx, x, y, w, h, base);
  for (let py = y; py < y + h; py += 4) {
    for (let px = x + ((py / 4) % 2) * 2; px < x + w; px += 4) {
      pixel(ctx, px, py, palette.dirtDark);
    }
  }
}

export function drawTimberFrame(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  plaster = 0xc9b896
) {
  fillRect(ctx, x, y, w, h, plaster);
  fillRect(ctx, x, y, 3, h, palette.woodDark);
  fillRect(ctx, x + w - 3, y, 3, h, palette.woodDark);
  fillRect(ctx, x, y, w, 2, palette.woodDark);
  fillRect(ctx, x + Math.floor(w / 2) - 1, y, 2, h, palette.wood);
  fillRect(ctx, x, y + h - 1, w, 1, palette.ink);
}

export function drawThatchedRoof(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const straw = [palette.wheatDark, palette.wheat, 0xe0c878, 0xc8a848] as const;
  fillRect(ctx, x, y, w, h, palette.wheat);
  fillRect(ctx, x + 4, y - 2, w - 8, 2, palette.wheatDark);
  for (let row = 0; row < h; row++) {
    const tone = straw[row % straw.length]!;
    fillRect(ctx, x, y + row, w, 1, tone);
    for (let px = x + ((row * 3) % 4); px < x + w; px += 3) {
      pixel(ctx, px, y + row, straw[(row + px) % straw.length]!);
    }
  }
  fillRect(ctx, x, y + h, w, 2, palette.wheatDark);
}

export function drawDoorway(
  ctx: Ctx,
  x: number,
  y: number,
  w = 10,
  h = 14
) {
  fillRect(ctx, x, y, w, h, palette.woodDark);
  fillRect(ctx, x + 1, y + 1, w - 2, h - 2, palette.wood);
  pixel(ctx, x + w - 3, y + Math.floor(h / 2), palette.ink);
}

export function drawWindow(
  ctx: Ctx,
  x: number,
  y: number,
  w = 7,
  h = 6
) {
  fillRect(ctx, x, y, w, h, palette.ink);
  fillRect(ctx, x + 1, y + 1, Math.floor(w / 2) - 1, h - 2, palette.wood);
  fillRect(
    ctx,
    x + Math.floor(w / 2) + 1,
    y + 1,
    w - Math.floor(w / 2) - 2,
    h - 2,
    palette.wood
  );
}

export function drawHearth(
  ctx: Ctx,
  x: number,
  y: number,
  w = 12,
  h = 8
) {
  fillRect(ctx, x, y, w, h, palette.stoneDark);
  fillRect(ctx, x + 2, y + 2, w - 4, h - 4, palette.ink);
  fillRect(ctx, x + 4, y + 4, w - 8, 2, 0xff8844);
}

export function drawBed(
  ctx: Ctx,
  x: number,
  y: number,
  w = 14,
  h = 10
) {
  fillRect(ctx, x, y, w, h, palette.woodDark);
  fillRect(ctx, x + 2, y + 2, w - 4, h - 4, palette.cream);
  fillRect(ctx, x + 2, y + 2, 4, 3, palette.clothPeasant);
}

export function drawTable(
  ctx: Ctx,
  x: number,
  y: number,
  w = 12,
  h = 5
) {
  fillRect(ctx, x, y, w, h, palette.wood);
  fillRect(ctx, x + 2, y + h, 3, 4, palette.woodDark);
  fillRect(ctx, x + w - 5, y + h, 3, 4, palette.woodDark);
}

export function drawStoneWall(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number
) {
  fillRect(ctx, x, y, w, h, palette.stoneDark);
  for (let row = 0; row < h; row += 5) {
    const off = (row / 5) % 2 === 0 ? 0 : 4;
    for (let col = off; col < w; col += 8) {
      fillRect(ctx, x + col, y + row, 7, 4, palette.stone);
    }
  }
  fillRect(ctx, x, y, w, 1, palette.ink);
}

export function drawTiledRoof(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color = palette.roof
) {
  fillRect(ctx, x, y, w, h, color);
  for (let row = 0; row < h; row += 3) {
    for (let col = (row % 6 === 0 ? 0 : 3); col < w; col += 6) {
      fillRect(ctx, x + col, y + row, 5, 2, color === palette.roof ? 0x8a3535 : color);
    }
  }
}

export function drawInteriorRoomShell(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  doorX: number,
  doorW = 10
) {
  drawInteriorFloor(ctx, x, y, w, h);
  drawInteriorWallH(ctx, x, y, w);
  drawInteriorWallH(ctx, x, y + h - 3, w);
  drawInteriorWallV(ctx, x, y, h);
  drawInteriorWallV(ctx, x + w - 3, y, h);
  fillRect(ctx, doorX, y + h - 3, doorW, 3, palette.dirt);
}

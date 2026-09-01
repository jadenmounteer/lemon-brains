import Phaser from 'phaser';
import { PROP_KEYS } from './assetManifest';
import {
  drawBed,
  drawHearth,
  drawInteriorFloor,
  drawInteriorRoomShell,
  drawInteriorWallH,
  drawInteriorWallV,
  drawStoneWall,
  drawTable,
  fillRect,
  pixel,
} from './buildingArt';
import { palette } from './palette';

function createCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number
): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) throw new Error(`Failed to create canvas texture: ${key}`);
  return tex;
}

export function drawHouseInterior(scene: Phaser.Scene, w = 56, h = 52) {
  const int = createCanvas(scene, PROP_KEYS.houseInterior, w, h);
  const ic = int.getContext();
  drawInteriorRoomShell(ic, 6, 20, 44, 28, 21);
  drawBed(ic, 10, 24);
  drawTable(ic, 30, 34);
  fillRect(ic, 42, 24, 6, 12, palette.woodDark);
  drawHearth(ic, 24, 38);
  fillRect(ic, 18, 32, 10, 6, palette.wheatDark);
  int.refresh();
}

export function drawManorInterior(scene: Phaser.Scene) {
  const w = 64;
  const h = 56;
  const int = createCanvas(scene, PROP_KEYS.manorInterior, w, h);
  const ic = int.getContext();
  drawInteriorFloor(ic, 4, 18, 56, 34, 0xd4c8b0);
  drawInteriorWallH(ic, 4, 18, 56);
  drawInteriorWallH(ic, 4, 48, 56);
  drawInteriorWallV(ic, 4, 18, 34);
  drawInteriorWallV(ic, 57, 18, 34);
  drawInteriorWallV(ic, 22, 18, 34);
  drawInteriorWallV(ic, 42, 18, 34);
  fillRect(ic, 26, 48, 12, 3, palette.dirt);
  drawBed(ic, 8, 24);
  drawBed(ic, 46, 24);
  drawTable(ic, 26, 30, 14, 6);
  drawHearth(ic, 30, 38);
  fillRect(ic, 6, 38, 8, 8, palette.stoneDark);
  int.refresh();
}

export function drawGranaryInterior(scene: Phaser.Scene) {
  const w = 36;
  const h = 44;
  const int = createCanvas(scene, PROP_KEYS.granaryInterior, w, h);
  const ic = int.getContext();
  drawInteriorRoomShell(ic, 6, 12, 24, 30, 13);
  for (let i = 0; i < 3; i++) {
    fillRect(ic, 8 + i * 7, 20, 5, 8, palette.wheat);
    fillRect(ic, 9 + i * 7, 21, 3, 2, palette.wheatDark);
  }
  fillRect(ic, 20, 28, 6, 10, palette.wheatDark);
  int.refresh();
}

export function drawBarracksInterior(scene: Phaser.Scene) {
  const w = 40;
  const h = 32;
  const int = createCanvas(scene, PROP_KEYS.barracksInterior, w, h);
  const ic = int.getContext();
  drawInteriorRoomShell(ic, 4, 8, 32, 22, 17);
  drawBed(ic, 6, 12);
  drawBed(ic, 22, 12);
  fillRect(ic, 8, 22, 24, 4, palette.wood);
  fillRect(ic, 30, 10, 4, 14, palette.metal);
  int.refresh();
}

export function drawWatchtowerInterior(scene: Phaser.Scene) {
  const w = 24;
  const h = 36;
  const int = createCanvas(scene, PROP_KEYS.watchtowerInterior, w, h);
  const ic = int.getContext();
  drawStoneWall(ic, 4, 8, 16, 26);
  drawInteriorFloor(ic, 6, 10, 12, 22);
  fillRect(ic, 10, 20, 4, 12, palette.woodDark);
  fillRect(ic, 6, 4, 12, 6, palette.wood);
  fillRect(ic, 8, 2, 8, 3, palette.ink);
  int.refresh();
}

export function drawDockInterior(scene: Phaser.Scene) {
  const w = 40;
  const h = 28;
  const int = createCanvas(scene, PROP_KEYS.dockInterior, w, h);
  const ic = int.getContext();
  drawInteriorRoomShell(ic, 4, 6, 32, 20, 17);
  drawTable(ic, 8, 12);
  fillRect(ic, 24, 14, 8, 6, palette.wood);
  fillRect(ic, 26, 16, 4, 3, 0x4a8f9a);
  int.refresh();
}

export function drawCemeteryInterior(scene: Phaser.Scene) {
  const w = 48;
  const h = 34;
  const int = createCanvas(scene, PROP_KEYS.cemeteryInterior, w, h);
  const ic = int.getContext();
  drawInteriorFloor(ic, 4, 8, 40, 24, palette.stoneDark);
  drawInteriorWallH(ic, 4, 8, 40);
  drawInteriorWallV(ic, 4, 8, 24);
  drawInteriorWallV(ic, 41, 8, 24);
  fillRect(ic, 20, 8, 8, 3, palette.dirt);
  fillRect(ic, 10, 14, 4, 10, palette.stone);
  fillRect(ic, 22, 12, 4, 12, palette.stone);
  fillRect(ic, 34, 14, 4, 10, palette.stone);
  pixel(ic, 12, 12, palette.cream);
  int.refresh();
}

export function drawGallowsInterior(scene: Phaser.Scene) {
  const w = 28;
  const h = 38;
  const int = createCanvas(scene, PROP_KEYS.gallowsInterior, w, h);
  const ic = int.getContext();
  drawInteriorFloor(ic, 2, 10, 24, 26, palette.dirtDark);
  drawInteriorWallH(ic, 2, 10, 24);
  drawInteriorWallV(ic, 2, 10, 26);
  drawInteriorWallV(ic, 23, 10, 26);
  fillRect(ic, 11, 10, 6, 3, palette.dirt);
  fillRect(ic, 12, 4, 4, 18, palette.woodDark);
  fillRect(ic, 8, 4, 12, 2, palette.wood);
  int.refresh();
}

function drawCampTentInterior(
  scene: Phaser.Scene,
  key: string,
  cloth: number
) {
  const w = 32;
  const h = 24;
  const int = createCanvas(scene, key, w, h);
  const ic = int.getContext();
  drawInteriorFloor(ic, 4, 10, 24, 12, palette.dirt);
  fillRect(ic, 6, 4, 20, 8, cloth);
  drawBed(ic, 8, 12, 10, 8);
  fillRect(ic, 20, 14, 6, 6, palette.wood);
  int.refresh();
}

export function drawBanditCampInterior(scene: Phaser.Scene) {
  drawCampTentInterior(scene, PROP_KEYS.banditCampInterior, palette.clothBandit);
}

export function drawThiefDenInterior(scene: Phaser.Scene) {
  const w = 32;
  const h = 24;
  const int = createCanvas(scene, PROP_KEYS.thiefDenInterior, w, h);
  const ic = int.getContext();
  drawInteriorFloor(ic, 4, 10, 24, 12, 0x1a1018);
  fillRect(ic, 4, 10, 24, 12, palette.ink);
  drawBed(ic, 8, 12, 10, 8);
  fillRect(ic, 20, 14, 6, 6, palette.woodDark);
  pixel(ic, 22, 15, palette.gold);
  int.refresh();
}

export function drawGypsyCampInterior(scene: Phaser.Scene) {
  drawCampTentInterior(scene, PROP_KEYS.gypsyCampInterior, palette.clothGypsy);
}

export function drawSupplementaryInteriors(scene: Phaser.Scene): void {
  drawHouseInterior(scene);
  drawManorInterior(scene);
  drawGranaryInterior(scene);
  drawBarracksInterior(scene);
  drawWatchtowerInterior(scene);
  drawDockInterior(scene);
  drawCemeteryInterior(scene);
  drawGallowsInterior(scene);
  drawBanditCampInterior(scene);
  drawThiefDenInterior(scene);
  drawGypsyCampInterior(scene);
}

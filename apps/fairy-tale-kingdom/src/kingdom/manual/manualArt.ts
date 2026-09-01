import type Phaser from 'phaser';
import {
  ENEMY_ROLES,
  MONSTER_ROLES,
  PROP_KEYS,
  UNIT_ROLES,
  wallTextureKey,
} from '../../game/art/assetManifest';

type ArtMap = Record<string, string>;

let artMap: ArtMap = {};
const listeners = new Set<() => void>();

export function getManualArtMap(): ArtMap {
  return artMap;
}

export function getManualArt(key: string): string | undefined {
  return artMap[key];
}

export function subscribeManualArt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const l of listeners) l();
}

function frameToDataUrl(
  scene: Phaser.Scene,
  key: string,
  frameName: string | number = '__BASE'
): string | null {
  if (!scene.textures.exists(key)) return null;
  const texture = scene.textures.get(key);
  const frame = texture.get(frameName);
  if (!frame) return null;
  const source = texture.getSourceImage() as
    | HTMLCanvasElement
    | HTMLImageElement
    | ImageBitmap;
  if (!source || typeof (source as HTMLCanvasElement).width !== 'number') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, frame.cutWidth);
  canvas.height = Math.max(1, frame.cutHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    source as CanvasImageSource,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    0,
    0,
    frame.cutWidth,
    frame.cutHeight
  );
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Snapshot procedural textures for the React playing manual. */
export function exportManualArt(scene: Phaser.Scene): void {
  const next: ArtMap = {};
  const put = (alias: string, key: string, frame: string | number = '__BASE') => {
    const url = frameToDataUrl(scene, key, frame);
    if (url) next[alias] = url;
  };

  for (const role of UNIT_ROLES) put(`unit:${role}`, role, '0');
  for (const role of ENEMY_ROLES) put(`enemy:${role}`, role, '0');
  for (const role of MONSTER_ROLES) put(`monster:${role}`, role, '0');

  put('prop:keep', PROP_KEYS.keep);
  put('prop:keepInterior', PROP_KEYS.keepInterior);
  put('prop:horse', PROP_KEYS.horse);
  put('prop:house', PROP_KEYS.house);
  put('prop:manor', PROP_KEYS.manor);
  put('prop:wall', wallTextureKey(0));
  put('prop:tavern', PROP_KEYS.tavern);
  put('prop:drawbridge', PROP_KEYS.drawbridge);
  put('prop:wallLadder', PROP_KEYS.wallLadder);
  put('prop:field', PROP_KEYS.field);
  put('prop:granary', PROP_KEYS.granary);
  put('prop:barracks', PROP_KEYS.barracks);
  put('prop:ballista', PROP_KEYS.ballista);
  put('prop:watchtower', PROP_KEYS.watchtower);
  put('prop:cathedral', PROP_KEYS.cathedral);
  put('prop:infirmary', PROP_KEYS.infirmary);
  put('prop:dungeon', PROP_KEYS.dungeon);
  put('prop:bakery', PROP_KEYS.bakery);
  put('prop:market', PROP_KEYS.market);
  put('prop:cemetery', PROP_KEYS.cemetery);
  put('prop:gallows', PROP_KEYS.gallows);
  put('prop:road', PROP_KEYS.road);
  put('prop:bridge', PROP_KEYS.bridge);
  put('prop:dock', PROP_KEYS.dock);
  put('prop:fishingBoat', PROP_KEYS.fishingBoat);
  put('prop:warship', PROP_KEYS.warship);
  put('prop:vampireCastle', PROP_KEYS.vampireCastle);
  put('prop:vampireCastleInterior', PROP_KEYS.vampireCastleInterior);
  put('prop:cave', PROP_KEYS.cave);
  put('prop:carriage', PROP_KEYS.carriage);
  put('prop:banditCamp', PROP_KEYS.banditCamp);
  put('prop:goblinCamp', PROP_KEYS.goblinCamp);
  put('prop:giantCamp', PROP_KEYS.giantCamp);
  put('prop:thiefDen', PROP_KEYS.thiefDen);
  put('prop:siegeCamp', PROP_KEYS.siegeCamp);
  put('prop:gypsyCamp', PROP_KEYS.gypsyCamp);
  put('prop:covenCamp', PROP_KEYS.covenCamp);
  put('prop:venueFestival', PROP_KEYS.venueFestival);
  put('prop:venueWedding', PROP_KEYS.venueWedding);
  put('prop:venueJoust', PROP_KEYS.venueJoust);
  put('prop:venueFuneral', PROP_KEYS.venueFuneral);

  artMap = next;
  notify();
}

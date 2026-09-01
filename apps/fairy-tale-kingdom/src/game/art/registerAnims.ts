import Phaser from 'phaser';
import {
  CELEBRATE_VISUAL_KEYS,
  CelebrateFrame,
  DIRECTIONS,
  HEARTH_FIRE_ANIM,
  HEARTH_FIRE_FRAMES,
  HORSE_GALLOP_FRAMES,
  HORSE_TROT_FRAMES,
  JesterPerformFrame,
  MILITARY_SLASH_ROLES,
  MilitaryPerformFrame,
  PROP_KEYS,
  UnitFrame,
  celebrateCheerAnimKey,
  celebrateDanceAnimKey,
  horseGallopAnimKey,
  horseTrotAnimKey,
  idleAnimKey,
  jesterJuggleAnimKey,
  roleSlashAnimKey,
  uniqueSheetRoles,
  walkAnimKey,
  walkFramesFor,
  type AnimRole,
} from './assetManifest';
import { PEASANT_VISUAL_KEYS } from './resolveSubjectTexture';

function ensureAnim(
  scene: Phaser.Scene,
  key: string,
  config: Phaser.Types.Animations.Animation
) {
  if (scene.anims.exists(key)) {
    scene.anims.remove(key);
  }
  scene.anims.create(config);
}

function registerRole(scene: Phaser.Scene, role: AnimRole) {
  ensureAnim(scene, idleAnimKey(role), {
    key: idleAnimKey(role),
    frames: [{ key: role, frame: UnitFrame.idle }],
    frameRate: 1,
    repeat: -1,
  });

  for (const dir of DIRECTIONS) {
    const frames = walkFramesFor(dir).map((frame) => ({ key: role, frame }));
    ensureAnim(scene, walkAnimKey(role, dir), {
      key: walkAnimKey(role, dir),
      frames,
      frameRate: 8,
      repeat: -1,
    });
  }
}

function registerJesterAnims(scene: Phaser.Scene): void {
  if (!scene.textures.exists('jester')) return;

  ensureAnim(scene, idleAnimKey('jester'), {
    key: idleAnimKey('jester'),
    frames: [
      { key: 'jester', frame: UnitFrame.idle },
      { key: 'jester', frame: JesterPerformFrame.flourish },
      { key: 'jester', frame: UnitFrame.idle },
      { key: 'jester', frame: JesterPerformFrame.bow },
    ],
    frameRate: 4,
    repeat: -1,
  });

  for (const dir of DIRECTIONS) {
    const frames = walkFramesFor(dir).map((frame) => ({ key: 'jester', frame }));
    ensureAnim(scene, walkAnimKey('jester', dir), {
      key: walkAnimKey('jester', dir),
      frames,
      frameRate: 10,
      repeat: -1,
    });
  }

  ensureAnim(scene, jesterJuggleAnimKey(), {
    key: jesterJuggleAnimKey(),
    frames: [
      { key: 'jester', frame: JesterPerformFrame.toss1 },
      { key: 'jester', frame: JesterPerformFrame.toss2 },
      { key: 'jester', frame: JesterPerformFrame.toss3 },
      { key: 'jester', frame: JesterPerformFrame.toss4 },
    ],
    frameRate: 12,
    repeat: -1,
  });
}

function registerCelebrateAnims(scene: Phaser.Scene): void {
  for (const key of CELEBRATE_VISUAL_KEYS) {
    if (!scene.textures.exists(key)) continue;
    ensureAnim(scene, celebrateDanceAnimKey(key), {
      key: celebrateDanceAnimKey(key),
      frames: [
        { key, frame: CelebrateFrame.dance1 },
        { key, frame: CelebrateFrame.dance2 },
      ],
      frameRate: 6,
      repeat: -1,
    });
    ensureAnim(scene, celebrateCheerAnimKey(key), {
      key: celebrateCheerAnimKey(key),
      frames: [
        { key, frame: CelebrateFrame.cheer },
        { key, frame: CelebrateFrame.bow },
      ],
      frameRate: 4,
      repeat: -1,
    });
  }
}

function registerHorseAnims(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PROP_KEYS.horse)) return;
  ensureAnim(scene, horseTrotAnimKey(), {
    key: horseTrotAnimKey(),
    frames: HORSE_TROT_FRAMES.map((frame) => ({
      key: PROP_KEYS.horse,
      frame,
    })),
    frameRate: 8,
    repeat: -1,
  });
  ensureAnim(scene, horseGallopAnimKey(), {
    key: horseGallopAnimKey(),
    frames: HORSE_GALLOP_FRAMES.map((frame) => ({
      key: PROP_KEYS.horse,
      frame,
    })),
    frameRate: 12,
    repeat: -1,
  });
}

function registerMilitarySlashAnims(scene: Phaser.Scene): void {
  for (const role of MILITARY_SLASH_ROLES) {
    if (!scene.textures.exists(role)) continue;
    ensureAnim(scene, roleSlashAnimKey(role), {
      key: roleSlashAnimKey(role),
      frames: [
        { key: role, frame: MilitaryPerformFrame.slash },
        { key: role, frame: MilitaryPerformFrame.recover },
      ],
      frameRate: 10,
      repeat: 0,
    });
  }
}

export function registerAnims(scene: Phaser.Scene): void {
  for (const role of uniqueSheetRoles()) {
    if (role === 'jester') continue;
    registerRole(scene, role);
  }
  for (const key of PEASANT_VISUAL_KEYS) {
    if (scene.textures.exists(key)) {
      registerRole(scene, key as AnimRole);
    }
  }
  registerJesterAnims(scene);
  registerCelebrateAnims(scene);
  registerHorseAnims(scene);
  registerMilitarySlashAnims(scene);

  if (scene.textures.exists(PROP_KEYS.hearthFire)) {
    ensureAnim(scene, HEARTH_FIRE_ANIM, {
      key: HEARTH_FIRE_ANIM,
      frames: scene.anims.generateFrameNumbers(PROP_KEYS.hearthFire, {
        start: 0,
        end: HEARTH_FIRE_FRAMES - 1,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }
}

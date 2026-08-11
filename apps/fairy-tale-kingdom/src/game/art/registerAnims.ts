import Phaser from 'phaser';
import {
  DIRECTIONS,
  ENEMY_ROLES,
  HEARTH_FIRE_ANIM,
  HEARTH_FIRE_FRAMES,
  MONSTER_ROLES,
  PROP_KEYS,
  UNIT_ROLES,
  UnitFrame,
  idleAnimKey,
  walkAnimKey,
  walkFramesFor,
  type AnimRole,
} from './assetManifest';

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

export function registerAnims(scene: Phaser.Scene): void {
  for (const role of UNIT_ROLES) {
    registerRole(scene, role);
  }
  for (const role of ENEMY_ROLES) {
    registerRole(scene, role);
  }
  for (const role of MONSTER_ROLES) {
    registerRole(scene, role);
  }

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

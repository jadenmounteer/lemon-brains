import Phaser from 'phaser';
import {
  DIRECTIONS,
  UNIT_ROLES,
  UnitFrame,
  idleAnimKey,
  walkAnimKey,
  walkFramesFor,
  type UnitRole,
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

function registerRole(scene: Phaser.Scene, role: UnitRole) {
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
}

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { KingdomScene } from './scenes/KingdomScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2d5a3d',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 600,
    },
    scene: [BootScene, KingdomScene],
    banner: false,
  });
}

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { KingdomScene } from './scenes/KingdomScene';
import { palette } from './art/palette';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: palette.grassDark,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
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

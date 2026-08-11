import Phaser from 'phaser';
import { generateTextures } from '../art/generateTextures';
import { registerAnims } from '../art/registerAnims';
// Future PNG path: import { assetUrl } from '../../config';
// Future PNG path: import { dropInPaths } from '../art/assetManifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Phase 1: always generate procedural textures with stable keys.
    // Later: prefer this.load.spritesheet(key, assetUrl(dropInPaths.*), …) when PNGs exist.
    generateTextures(this);
    registerAnims(this);
    this.scene.start('KingdomScene');
  }
}

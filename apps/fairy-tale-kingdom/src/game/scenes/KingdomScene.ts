import Phaser from 'phaser';

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;

export class KingdomScene extends Phaser.Scene {
  private dragStart: Phaser.Math.Vector2 | null = null;
  private cameraStart: Phaser.Math.Vector2 | null = null;

  constructor() {
    super('KingdomScene');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    // Placeholder ground — Phase 1 replaces this with a pixel tileset.
    const ground = this.add.rectangle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      0x3d7a4a
    );
    ground.setStrokeStyle(4, 0x2d5a3d);

    // Soft “paths” so the empty map isn’t a flat void.
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH * 0.08, WORLD_HEIGHT, 0x4a8f5c, 0.35);
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT * 0.06, 0x4a8f5c, 0.35);

    // Placeholder keep marker (geometry only until Phase 1 art).
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 96, 96, 0x6b5b45).setStrokeStyle(3, 0x3e3428);
    this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 70, 'Royal Keep (coming soon)', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f4efe4',
      })
      .setOrigin(0.5);

    this.add
      .text(24, 24, 'Drag to look around the kingdom', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#e8f5e9',
        backgroundColor: '#1b3324aa',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.dragStart = new Phaser.Math.Vector2(pointer.x, pointer.y);
      this.cameraStart = new Phaser.Math.Vector2(
        this.cameras.main.scrollX,
        this.cameras.main.scrollY
      );
    });

    this.input.on('pointerup', () => {
      this.dragStart = null;
      this.cameraStart = null;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragStart || !this.cameraStart) {
        return;
      }
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      this.cameras.main.setScroll(
        this.cameraStart.x - dx,
        this.cameraStart.y - dy
      );
    });
  }
}

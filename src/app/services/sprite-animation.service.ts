import { Injectable } from '@angular/core';

export interface SpriteConfig {
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  fps: number;
  displayWidth: number;
  displayHeight: number;
}

@Injectable({
  providedIn: 'root',
})
export class SpriteAnimationService {
  loadSprite(config: SpriteConfig): HTMLCanvasElement {
    console.log('Loading sprite with config:', config);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Could not get canvas context');
      return canvas;
    }

    canvas.width = config.displayWidth;
    canvas.height = config.displayHeight;

    const spriteImage = new Image();
    let currentFrame = 0;

    spriteImage.onload = () => {
      console.log('Sprite image loaded successfully:', config.imageUrl);

      // Draw initial frame immediately
      ctx.drawImage(
        spriteImage,
        0,
        0,
        config.frameWidth,
        config.frameHeight,
        0,
        0,
        config.displayWidth,
        config.displayHeight
      );

      // Only set up animation if we have multiple frames
      if (config.totalFrames > 1) {
        setInterval(() => {
          ctx.clearRect(0, 0, config.displayWidth, config.displayHeight);

          const frameX =
            (currentFrame % (spriteImage.width / config.frameWidth)) *
            config.frameWidth;

          ctx.drawImage(
            spriteImage,
            frameX,
            0,
            config.frameWidth,
            config.frameHeight,
            0,
            0,
            config.displayWidth,
            config.displayHeight
          );

          currentFrame = (currentFrame + 1) % config.totalFrames;
        }, 1000 / config.fps);
      }
    };

    spriteImage.onerror = (e) => {
      console.error('Failed to load sprite image:', config.imageUrl, e);
    };

    spriteImage.src = config.imageUrl;

    return canvas;
  }
}

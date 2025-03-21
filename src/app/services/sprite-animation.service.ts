import { Injectable } from '@angular/core';

export interface SpriteConfig {
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  fps: number;
}

@Injectable({
  providedIn: 'root',
})
export class SpriteAnimationService {
  loadSprite(config: SpriteConfig): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return canvas;

    canvas.width = config.frameWidth;
    canvas.height = config.frameHeight;

    const spriteImage = new Image();
    spriteImage.src = config.imageUrl;

    let currentFrame = 0;

    spriteImage.onload = () => {
      setInterval(() => {
        ctx.clearRect(0, 0, config.frameWidth, config.frameHeight);

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
          config.frameWidth,
          config.frameHeight
        );

        currentFrame = (currentFrame + 1) % config.totalFrames;
      }, 1000 / config.fps);
    };

    return canvas;
  }
}

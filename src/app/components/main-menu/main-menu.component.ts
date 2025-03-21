import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SpriteAnimationService } from '../../services/sprite-animation.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="main-menu">
      <div class="title-container">
        <h1 class="game-title">Lemon Brains</h1>
        <div #lemonadeContainer class="lemonade-container"></div>
      </div>
      <div class="description">
        Help the zombies quench their thirst for knowledge! Answer math
        questions correctly to serve them refreshing lemonade and keep them from
        reaching your stand.
      </div>
      <button class="start-button" (click)="startGame()">Start Game</button>
    </div>
  `,
  styleUrls: ['./main-menu.component.scss'],
})
export class MainMenuComponent implements OnInit, AfterViewInit {
  @ViewChild('lemonadeContainer') lemonadeContainer!: ElementRef;

  constructor(
    private router: Router,
    private spriteAnimationService: SpriteAnimationService
  ) {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.initLemonadeAnimation();
  }

  private initLemonadeAnimation() {
    const lemonadeConfig = {
      imageUrl: 'assets/sprites/lemonade.png',
      frameWidth: 128, // Width of one frame (256/2 columns)
      frameHeight: 128, // Height of one frame (384/3 rows)
      totalFrames: 6, // Total frames in sprite sheet
      fps: 4, // Slower animation speed
      displayWidth: 128, // Larger display size
      displayHeight: 128, // Keep it square
    };

    const canvas = this.spriteAnimationService.loadSprite(lemonadeConfig);
    canvas.classList.add('menu-lemonade');
    this.lemonadeContainer.nativeElement.appendChild(canvas);
  }

  startGame() {
    this.router.navigate(['/game']);
  }
}

import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MathService } from '../../services/math.service';
import { MathQuestion } from '../../models/math-question.interface';
import { SpriteAnimationService } from '../../services/sprite-animation.service';
import { ZombieState } from '../../models/zombie.interface';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameArea') gameAreaRef!: ElementRef;
  currentQuestion?: MathQuestion;
  wrongAnswer: number | null = null;
  zombies: ZombieState[] = [];
  private nextZombieId = 0;
  private gameAreaRect?: DOMRect;
  private zombieSpawnInterval?: any;
  private resizeObserver?: ResizeObserver;

  constructor(
    private mathService: MathService,
    private spriteAnimationService: SpriteAnimationService
  ) {}

  ngOnInit() {
    this.generateNewQuestion();
    this.preventZoom();
  }

  ngAfterViewInit() {
    this.initLemonadeStand();
    this.setupResizeObserver();
    this.startZombieSpawning();
  }

  private initLemonadeStand() {
    const lemonadeStandConfig = {
      imageUrl: 'assets/sprites/lemonade-stand.png',
      frameWidth: 320,
      frameHeight: 320,
      totalFrames: 2,
      fps: 1,
      displayWidth: 64,
      displayHeight: 64,
    };

    const canvas = this.spriteAnimationService.loadSprite(lemonadeStandConfig);
    canvas.classList.add('lemonade-stand');
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.bottom = '15%';
    canvas.style.transform = 'translate(-50%, 0)';
    canvas.style.width = '64px';
    canvas.style.height = '64px';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.zIndex = '2';
    this.gameAreaRef.nativeElement.appendChild(canvas);
  }

  generateNewQuestion() {
    this.currentQuestion = this.mathService.generateQuestion();
  }

  checkAnswer(selectedAnswer: number) {
    if (this.currentQuestion?.correctAnswer === selectedAnswer) {
      console.log('Correct!');
      this.wrongAnswer = null;
      this.generateNewQuestion();
    } else {
      console.log('Wrong answer!');
      this.wrongAnswer = selectedAnswer;
    }
  }

  private preventZoom() {
    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  private startZombieSpawning() {
    // Spawn a new zombie every 3 seconds
    this.zombieSpawnInterval = setInterval(() => {
      this.spawnZombie();
    }, 3000);
  }

  private spawnZombie() {
    const gameArea = this.gameAreaRef.nativeElement;
    const rect = gameArea.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Use percentage-based positioning
    const lemonadeStandY = height * 0.9; // 90% from top
    const padding = 32;

    // Initialize with default values
    let x = 0;
    let y = 0;

    // Randomly choose a side to spawn from (0: top, 1: right, 2: left)
    const side = Math.floor(Math.random() * 3);

    switch (side) {
      case 0: // top
        x = Math.random() * (width - padding * 2) + padding;
        y = 0; // Start at the very top
        break;
      case 1: // right
        x = width - padding;
        y = Math.random() * (lemonadeStandY - padding * 2);
        break;
      case 2: // left
        x = padding;
        y = Math.random() * (lemonadeStandY - padding * 2);
        break;
    }

    const zombie: ZombieState = {
      x,
      y,
      facingLeft: x > width / 2,
      id: this.nextZombieId++,
    };

    this.zombies.push(zombie);
    this.createZombieSprite(zombie);
  }

  private createZombieSprite(zombie: ZombieState) {
    const zombieConfig = {
      imageUrl: 'assets/sprites/zombie.png',
      frameWidth: 320,
      frameHeight: 320,
      totalFrames: 2,
      fps: 2,
      displayWidth: 32,
      displayHeight: 32,
    };

    const canvas = this.spriteAnimationService.loadSprite(zombieConfig);
    canvas.classList.add('zombie');
    canvas.setAttribute('data-zombie-id', zombie.id.toString());
    canvas.style.position = 'absolute';
    canvas.style.left = `${zombie.x}px`;
    canvas.style.top = `${zombie.y}px`;
    canvas.style.transform = `scaleX(${zombie.facingLeft ? 1 : -1})`;
    this.gameAreaRef.nativeElement.appendChild(canvas);

    this.moveZombie(zombie, canvas);
  }

  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.gameAreaRect =
        this.gameAreaRef.nativeElement.getBoundingClientRect();
    });
    this.resizeObserver.observe(this.gameAreaRef.nativeElement);
  }

  private moveZombie(zombie: ZombieState, canvas: HTMLCanvasElement) {
    const gameArea = this.gameAreaRef.nativeElement;
    const rect = gameArea.getBoundingClientRect();

    // Target is the lemonade stand position (matching CSS)
    const targetX = rect.width / 2; // 50% from left
    const targetY = rect.height * 0.85; // 85% from top (matches lemonade stand at bottom 15%)

    const moveInterval = setInterval(() => {
      const dx = targetX - zombie.x;
      const dy = targetY - zombie.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If zombie reaches near the lemonade stand
      if (distance < 5) {
        clearInterval(moveInterval);
        // TODO: Implement game over or health reduction logic
        return;
      }

      // Update facing direction
      zombie.facingLeft = zombie.x > targetX;

      // Move zombie
      const speed = 0.5;
      zombie.x += (dx / distance) * speed;
      zombie.y += (dy / distance) * speed;

      // Update zombie position
      canvas.style.left = `${zombie.x}px`;
      canvas.style.top = `${zombie.y}px`;
      canvas.style.transform = `scaleX(${zombie.facingLeft ? 1 : -1})`;
    }, 16);
  }

  ngOnDestroy() {
    if (this.zombieSpawnInterval) {
      clearInterval(this.zombieSpawnInterval);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

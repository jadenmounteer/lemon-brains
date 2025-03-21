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
  private zombieSpawnInterval?: ReturnType<typeof setInterval>;
  private resizeObserver?: ResizeObserver;
  private moveIntervals: Map<number, ReturnType<typeof setInterval>> =
    new Map();

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
      this.removeClosestZombie();
      this.generateNewQuestion();
    } else {
      console.log('Wrong answer!');
      this.wrongAnswer = selectedAnswer;
    }
  }

  private removeClosestZombie() {
    if (this.zombies.length === 0) return;

    // Get the game area dimensions
    const rect = this.gameAreaRef.nativeElement.getBoundingClientRect();
    const targetX = rect.width / 2;
    const targetY = rect.height * 0.85;

    // Find the closest zombie
    let closestZombie = this.zombies[0];
    let closestDistance = Number.MAX_VALUE;

    this.zombies.forEach((zombie) => {
      const dx = zombie.x - targetX;
      const dy = zombie.y - targetY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestZombie = zombie;
      }
    });

    // Remove the zombie from our array
    this.zombies = this.zombies.filter((z) => z.id !== closestZombie.id);

    // Clear the movement interval
    const interval = this.moveIntervals.get(closestZombie.id);
    if (interval) {
      clearInterval(interval);
      this.moveIntervals.delete(closestZombie.id);
    }

    // Find and remove the zombie's canvas element with a fade-out animation
    const zombieCanvas = this.gameAreaRef.nativeElement.querySelector(
      `[data-zombie-id="${closestZombie.id}"]`
    ) as HTMLCanvasElement;

    if (zombieCanvas) {
      // Add fade-out animation
      zombieCanvas.style.transition = 'opacity 0.5s ease-out';
      zombieCanvas.style.opacity = '0';

      // Remove the element after animation
      setTimeout(() => {
        zombieCanvas.remove();
      }, 500);
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

  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.gameAreaRect =
        this.gameAreaRef.nativeElement.getBoundingClientRect();
      // Update all zombie positions when window resizes
      this.updateAllZombiePositions();
    });
    this.resizeObserver.observe(this.gameAreaRef.nativeElement);
  }

  private updateAllZombiePositions() {
    const gameArea = this.gameAreaRef.nativeElement;
    this.zombies.forEach((zombie) => {
      const canvas = gameArea.querySelector(
        `[data-zombie-id="${zombie.id}"]`
      ) as HTMLCanvasElement;
      if (canvas) {
        // Convert current positions to percentages
        const rect = gameArea.getBoundingClientRect();
        zombie.xPercent = (zombie.x / rect.width) * 100;
        zombie.yPercent = (zombie.y / rect.height) * 100;

        // Update positions based on new dimensions
        zombie.x = (zombie.xPercent * rect.width) / 100;
        zombie.y = (zombie.yPercent * rect.height) / 100;

        // Update canvas position
        canvas.style.left = `${zombie.x}px`;
        canvas.style.top = `${zombie.y}px`;
      }
    });
  }

  private spawnZombie() {
    const gameArea = this.gameAreaRef.nativeElement;
    const rect = gameArea.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Use percentage-based positioning
    const lemonadeStandY = height * 0.9; // 90% from top
    const padding = Math.min(32, width * 0.05); // Responsive padding

    // Initialize with default values
    let x = 0;
    let y = 0;
    let xPercent = 0;
    let yPercent = 0;

    // Randomly choose a side to spawn from (0: top, 1: right, 2: left)
    const side = Math.floor(Math.random() * 3);

    switch (side) {
      case 0: // top
        xPercent = Math.random() * (90 - 10) + 10; // 10% to 90% width
        yPercent = 0;
        x = (xPercent * width) / 100;
        y = 0;
        break;
      case 1: // right
        xPercent = 95;
        yPercent = Math.random() * 70; // 0% to 70% height
        x = (xPercent * width) / 100;
        y = (yPercent * height) / 100;
        break;
      case 2: // left
        xPercent = 5;
        yPercent = Math.random() * 70; // 0% to 70% height
        x = (xPercent * width) / 100;
        y = (yPercent * height) / 100;
        break;
    }

    const zombie: ZombieState = {
      x,
      y,
      xPercent,
      yPercent,
      facingLeft: xPercent > 50,
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
      displayWidth: 48,
      displayHeight: 48,
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

  private moveZombie(zombie: ZombieState, canvas: HTMLCanvasElement) {
    const gameArea = this.gameAreaRef.nativeElement;
    const rect = gameArea.getBoundingClientRect();

    // Target is the lemonade stand position (matching CSS)
    const targetXPercent = 50; // Center
    const targetYPercent = 85; // 85% from top

    const moveInterval = setInterval(() => {
      const rect = gameArea.getBoundingClientRect();
      const targetX = (targetXPercent * rect.width) / 100;
      const targetY = (targetYPercent * rect.height) / 100;

      const dx = targetX - zombie.x;
      const dy = targetY - zombie.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If zombie reaches near the lemonade stand
      if (distance < 5) {
        this.moveIntervals.delete(zombie.id);
        clearInterval(moveInterval);
        // TODO: Implement game over or health reduction logic
        return;
      }

      // Update facing direction
      zombie.facingLeft = zombie.x > targetX;

      // Move zombie
      const speed = 0.3;
      zombie.x += (dx / distance) * speed;
      zombie.y += (dy / distance) * speed;

      // Update percentages
      zombie.xPercent = (zombie.x / rect.width) * 100;
      zombie.yPercent = (zombie.y / rect.height) * 100;

      // Update zombie position
      canvas.style.left = `${zombie.x}px`;
      canvas.style.top = `${zombie.y}px`;
      canvas.style.transform = `scaleX(${zombie.facingLeft ? 1 : -1})`;
    }, 16);

    this.moveIntervals.set(zombie.id, moveInterval);
  }

  ngOnDestroy() {
    if (this.zombieSpawnInterval) {
      clearInterval(this.zombieSpawnInterval);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    // Clear all move intervals
    this.moveIntervals.forEach((interval) => clearInterval(interval));
    this.moveIntervals.clear();
  }
}

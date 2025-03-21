import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MathService } from '../../services/math.service';
import { AudioService } from '../../services/audio.service';
import { SpriteAnimationService } from '../../services/sprite-animation.service';
import { MathQuestion } from '../../models/math-question.interface';
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
  isGameOver = false;
  isMusicPlaying = false;
  lemonadeGiven = 0;
  private nextZombieId = 0;
  private gameAreaRect?: DOMRect;
  private zombieSpawnInterval?: ReturnType<typeof setInterval>;
  private kingSpawnTimeout?: ReturnType<typeof setTimeout>;
  private resizeObserver?: ResizeObserver;
  private moveIntervals: Map<number, ReturnType<typeof setInterval>> =
    new Map();
  private spawnTimeoutMs = 5000; // Starting spawn rate: 5 seconds
  private minSpawnTimeoutMs = 1500; // Minimum spawn rate: 1.5 seconds
  private spawnRateDecreaseInterval?: ReturnType<typeof setInterval>;
  @Output() exitGame = new EventEmitter<void>();

  constructor(
    private mathService: MathService,
    private spriteAnimationService: SpriteAnimationService,
    private router: Router,
    private audioService: AudioService
  ) {}

  ngOnInit() {
    this.generateNewQuestion();
  }

  ngAfterViewInit() {
    this.initLemonadeStand();
    this.setupResizeObserver();
    this.startZombieSpawning();
    // Start playing music when game starts
    this.audioService.play();
    this.isMusicPlaying = true;
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
    if (this.currentQuestion) {
      if (selectedAnswer === this.currentQuestion.answer) {
        this.handleCorrectAnswer();
      } else {
        this.wrongAnswer = selectedAnswer;
        // Play zombie sound and spawn a new zombie
        this.audioService.playZombieSound();
        this.spawnZombie();

        setTimeout(() => {
          this.wrongAnswer = null;
        }, 1000);
      }
    }
  }

  private handleCorrectAnswer() {
    console.log('Correct!');
    this.wrongAnswer = null;
    this.removeClosestZombie();
    this.lemonadeGiven++;
    this.generateNewQuestion();
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

    // Create and animate lemonade projectile
    this.shootLemonadeAt(closestZombie);

    // Reduce zombie health
    closestZombie.health--;

    // Only remove zombie if health is 0
    if (closestZombie.health <= 0) {
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
    } else {
      // Flash the zombie to indicate it was hit but not defeated
      const zombieCanvas = this.gameAreaRef.nativeElement.querySelector(
        `[data-zombie-id="${closestZombie.id}"]`
      ) as HTMLCanvasElement;

      if (zombieCanvas) {
        zombieCanvas.style.filter = 'brightness(2)';
        setTimeout(() => {
          zombieCanvas.style.filter = 'none';
        }, 200);
      }
    }
  }

  private shootLemonadeAt(zombie: ZombieState) {
    console.log('Shooting lemonade at zombie:', zombie.id);

    const rect = this.gameAreaRef.nativeElement.getBoundingClientRect();
    const projectileSize = Math.min(rect.width, rect.height) * 0.15; // 15% of smallest screen dimension

    const lemonadeConfig = {
      imageUrl: 'assets/sprites/lemonade.png',
      frameWidth: 128,
      frameHeight: 128,
      totalFrames: 1,
      currentFrame: 0,
      fps: 1,
      displayWidth: projectileSize,
      displayHeight: projectileSize,
    };

    console.log('Loading lemonade sprite with config:', lemonadeConfig);
    const canvas = this.spriteAnimationService.loadSprite(lemonadeConfig);

    canvas.classList.add('lemonade-projectile');
    console.log('Added lemonade-projectile class');

    // Start from lemonade stand position
    const gameArea = this.gameAreaRef.nativeElement;
    const startX = rect.width / 2;
    const startY = rect.height * 0.85;

    // Set initial position and style
    canvas.style.position = 'absolute';
    canvas.style.width = `${lemonadeConfig.displayWidth}px`;
    canvas.style.height = `${lemonadeConfig.displayHeight}px`;
    canvas.style.left = `${startX}px`;
    canvas.style.top = `${startY}px`;
    canvas.style.opacity = '1';
    canvas.style.transform = 'translate(-50%, -50%) scale(1) rotate(-45deg)';
    canvas.style.zIndex = '3';

    console.log('Initial lemonade position:', { startX, startY });
    gameArea.appendChild(canvas);

    // Calculate offset based on zombie size
    const zombieOffset =
      zombie.type === 'king' ? 72 : zombie.type === 'fat' ? 48 : 36;

    // Animate to zombie position
    requestAnimationFrame(() => {
      canvas.style.transition = 'all 0.5s ease-out';
      canvas.style.left = `${zombie.x + zombieOffset}px`;
      canvas.style.top = `${zombie.y + zombieOffset}px`;
      canvas.style.transform = 'translate(-50%, -50%) scale(0.5) rotate(45deg)';
      canvas.style.opacity = '0';
    });

    // Remove the projectile after animation
    setTimeout(() => {
      canvas.remove();
    }, 500);
  }

  private startZombieSpawning() {
    // Initial spawn rate
    this.spawnTimeoutMs = 5000;

    // Spawn zombies at current rate
    this.zombieSpawnInterval = setInterval(() => {
      this.spawnZombie();
    }, this.spawnTimeoutMs);

    // Schedule first king spawn
    this.scheduleNextKing();

    // Increase difficulty every 15 seconds
    this.spawnRateDecreaseInterval = setInterval(() => {
      if (this.spawnTimeoutMs > this.minSpawnTimeoutMs) {
        // Clear existing spawn interval
        if (this.zombieSpawnInterval) {
          clearInterval(this.zombieSpawnInterval);
        }

        // Decrease spawn time by 150ms
        this.spawnTimeoutMs = Math.max(
          this.minSpawnTimeoutMs,
          this.spawnTimeoutMs - 150
        );

        // Create new spawn interval with updated rate
        this.zombieSpawnInterval = setInterval(() => {
          this.spawnZombie();
        }, this.spawnTimeoutMs);
      }
    }, 15000); // Check every 15 seconds
  }

  private scheduleNextKing() {
    // Schedule king spawn check every 3 minutes (180,000ms)
    const kingSpawnDelay = 180000;
    this.kingSpawnTimeout = setTimeout(() => {
      // 40% chance to spawn a king
      if (Math.random() < 0.4) {
        this.spawnKing();
      }
      this.scheduleNextKing(); // Schedule next king check
    }, kingSpawnDelay);
  }

  private spawnKing() {
    const gameArea = this.gameAreaRef.nativeElement;
    const rect = gameArea.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Kings always spawn at the top
    const xPercent = Math.random() * 100;
    const yPercent = 5;
    const x = (xPercent * width) / 100;
    const y = (yPercent * height) / 100;

    const zombie: ZombieState = {
      x,
      y,
      xPercent,
      yPercent,
      facingLeft: xPercent > 50,
      id: this.nextZombieId++,
      speed: 0.4, // Kings are slow but menacing
      type: 'king',
      health: 8, // Takes 8 hits to defeat
    };

    this.zombies.push(zombie);
    this.createZombieSprite(zombie);
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
        xPercent = Math.random() * 100;
        yPercent = 5;
        x = (xPercent * width) / 100;
        y = (yPercent * height) / 100;
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

    // 15% chance to spawn a fat zombie (reduced from 20%)
    const isFatZombie = Math.random() < 0.15;

    let speed;
    if (isFatZombie) {
      // Fat zombies are always slow (0.3x to 0.5x speed)
      speed = 0.3 + Math.random() * 0.2;
    } else {
      // Normal zombies have tiered speeds
      const speedRoll = Math.random();
      if (speedRoll < 0.2) {
        speed = 1.4 + Math.random() * 0.4; // 1.4x to 1.8x speed (fast)
      } else if (speedRoll < 0.5) {
        speed = 0.9 + Math.random() * 0.3; // 0.9x to 1.2x speed (medium)
      } else {
        speed = 0.5 + Math.random() * 0.3; // 0.5x to 0.8x speed (slow)
      }
    }

    const zombie: ZombieState = {
      x,
      y,
      xPercent,
      yPercent,
      facingLeft: xPercent > 50,
      id: this.nextZombieId++,
      speed: speed,
      type: isFatZombie ? 'fat' : 'normal',
      health: isFatZombie ? 2 : 1,
    };

    this.zombies.push(zombie);
    this.createZombieSprite(zombie);
  }

  private createZombieSprite(zombie: ZombieState) {
    let spriteConfig;

    switch (zombie.type) {
      case 'king':
        spriteConfig = {
          imageUrl: 'assets/sprites/zombie-king.png',
          frameWidth: 320,
          frameHeight: 320,
          totalFrames: 2,
          fps: 2,
          displayWidth: 144, // King is much larger
          displayHeight: 144,
        };
        break;
      case 'fat':
        spriteConfig = {
          imageUrl: 'assets/sprites/fat-zombie.png',
          frameWidth: 320,
          frameHeight: 320,
          totalFrames: 2,
          fps: 2,
          displayWidth: 96,
          displayHeight: 96,
        };
        break;
      default:
        spriteConfig = {
          imageUrl: 'assets/sprites/zombie.png',
          frameWidth: 320,
          frameHeight: 320,
          totalFrames: 2,
          fps: 2,
          displayWidth: 72,
          displayHeight: 72,
        };
    }

    const canvas = this.spriteAnimationService.loadSprite(spriteConfig);
    canvas.classList.add('zombie');
    canvas.setAttribute('data-zombie-id', zombie.id.toString());
    canvas.style.position = 'absolute';
    canvas.style.left = `${zombie.x}px`;
    canvas.style.top = `${zombie.y}px`;
    canvas.style.transform = `scaleX(${zombie.facingLeft ? 1 : -1})`;

    // Add special effects for the king
    if (zombie.type === 'king') {
      canvas.style.filter = 'drop-shadow(0 0 10px rgba(255,0,0,0.5))';
    }

    this.gameAreaRef.nativeElement.appendChild(canvas);
    this.moveZombie(zombie, canvas);
  }

  private moveZombie(zombie: ZombieState, canvas: HTMLCanvasElement) {
    const rect = this.gameAreaRef.nativeElement.getBoundingClientRect();
    const targetX = rect.width / 2;
    const targetY = rect.height * 0.85;

    // Calculate collision distance based on screen size
    const baseCollisionDistance = Math.min(rect.width, rect.height) * 0.05; // 5% of smallest screen dimension

    // Calculate base speed relative to screen size
    const baseSpeed = Math.min(rect.width, rect.height) * 0.0003; // 0.03% of smallest screen dimension

    // Base movement interval
    const moveInterval = setInterval(() => {
      const rect = this.gameAreaRef.nativeElement.getBoundingClientRect();
      const targetX = rect.width / 2;
      const targetY = rect.height * 0.85;

      // Recalculate distance for collision detection
      const dx = targetX - zombie.x;
      const dy = targetY - zombie.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if zombie has reached the lemonade stand
      if (distance < baseCollisionDistance) {
        this.handleGameOver();
        return;
      }

      // Base speed multiplied by zombie's speed factor, scaled to screen size
      const speed = baseSpeed * zombie.speed;
      zombie.x += (dx / distance) * speed;
      zombie.y += (dy / distance) * speed;

      // Update percentages
      zombie.xPercent = (zombie.x / rect.width) * 100;
      zombie.yPercent = (zombie.y / rect.height) * 100;

      // Update zombie position and direction
      canvas.style.left = `${zombie.x}px`;
      canvas.style.top = `${zombie.y}px`;
      canvas.style.transform = `scaleX(${zombie.facingLeft ? 1 : -1})`;

      // Update facing direction based on current movement
      zombie.facingLeft = dx > 0;
    }, 16);

    this.moveIntervals.set(zombie.id, moveInterval);
  }

  private handleGameOver() {
    this.isGameOver = true;

    // Stop spawning new zombies
    if (this.zombieSpawnInterval) {
      clearInterval(this.zombieSpawnInterval);
    }

    // Stop spawn rate progression
    if (this.spawnRateDecreaseInterval) {
      clearInterval(this.spawnRateDecreaseInterval);
    }

    // Stop all zombie movement
    this.moveIntervals.forEach((interval) => clearInterval(interval));
    this.moveIntervals.clear();
  }

  restartGame() {
    this.isGameOver = false;

    // Remove all zombie sprites from the DOM
    const gameArea = this.gameAreaRef.nativeElement;
    const zombieSprites = gameArea.querySelectorAll('.zombie');
    zombieSprites.forEach((sprite: HTMLElement) => sprite.remove());

    // Clear game state
    this.zombies = [];
    this.nextZombieId = 0;
    this.lemonadeGiven = 0;

    // Clear existing king spawn timeout
    if (this.kingSpawnTimeout) {
      clearTimeout(this.kingSpawnTimeout);
    }

    // Reset spawn timing
    this.spawnTimeoutMs = 5000; // Reset to initial spawn rate

    this.generateNewQuestion();
    this.startZombieSpawning();
  }

  goToMainMenu() {
    // Clean up game state
    this.ngOnDestroy();

    // Emit exit event
    this.exitGame.emit();
  }

  ngOnDestroy() {
    // Cleanup all intervals and timeouts
    this.audioService.cleanup();
    if (this.zombieSpawnInterval) {
      clearInterval(this.zombieSpawnInterval);
    }
    if (this.spawnRateDecreaseInterval) {
      clearInterval(this.spawnRateDecreaseInterval);
    }
    if (this.kingSpawnTimeout) {
      clearTimeout(this.kingSpawnTimeout);
    }
    this.moveIntervals.forEach((interval) => clearInterval(interval));
    this.moveIntervals.clear();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  toggleMusic() {
    this.isMusicPlaying = this.audioService.toggle();
  }

  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.gameAreaRect =
        this.gameAreaRef.nativeElement.getBoundingClientRect();
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
}

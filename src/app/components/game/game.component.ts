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
import { trigger, transition, style, animate } from '@angular/animations';
import { MathService } from '../../services/math.service';
import { PortugueseService } from '../../services/portuguese.service';
import { AudioService } from '../../services/audio.service';
import { SpriteAnimationService } from '../../services/sprite-animation.service';
import { MathQuestion } from '../../models/math-question.interface';
import { ZombieState } from '../../models/zombie.interface';
import { SettingsService, GameSettings } from '../../services/settings.service';
import { ColorQuestionsService } from '../../services/color-questions.service';
import { ShapeQuestionsService } from '../../services/shape-questions.service';

interface Question {
  question: string;
  answer: string | number;
  options: any[];
  curriculum: 'math' | 'portuguese' | 'colors' | 'shapes';
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
  animations: [
    trigger('powerUpAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translate(-50%, -50%) scale(0)' }),
        animate(
          '0.5s ease-out',
          style({ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '0.3s ease-in',
          style({ opacity: 0, transform: 'translate(-50%, -50%) scale(0)' })
        ),
      ]),
    ]),
  ],
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameArea') gameAreaRef!: ElementRef;
  currentQuestion: Question | null = null;
  wrongAnswer: string | number | null = null;
  selectedAnswer: string | number | null = null;
  zombies: ZombieState[] = [];
  isGameOver = false;
  isMusicPlaying = false;
  lemonadeGiven = 0;
  scoreMultiplier = 1;
  showPowerUp = false;
  showQuenched = false;
  private nextZombieId = 0;
  private gameAreaRect?: DOMRect;
  private zombieSpawnInterval?: ReturnType<typeof setInterval>;
  private kingSpawnTimeout?: ReturnType<typeof setTimeout>;
  private resizeObserver?: ResizeObserver;
  private moveIntervals: Map<number, ReturnType<typeof setInterval>> =
    new Map();
  settings: GameSettings;
  private correctStreak = 0;
  private powerUpThreshold = 10; // Initial threshold for power-up

  // Difficulty-based settings
  private spawnTimeoutMs: number;
  private minSpawnTimeoutMs: number;
  private spawnRateDecreaseInterval?: ReturnType<typeof setInterval>;
  private difficultySettings: Record<
    GameSettings['gameDifficulty'],
    {
      initialSpawnRate: number;
      minSpawnRate: number;
      spawnRateDecrease: number;
      checkInterval: number;
      kingHealth: number;
      fatZombieMinHealth: number;
      fatZombieMaxHealth: number;
      speedMultiplier: number;
      kingSpawnDelay: number;
      kingSpawnChance: number;
      doubleSpawnChance: number;
    }
  > = {
    easy: {
      initialSpawnRate: 5000,
      minSpawnRate: 2000,
      spawnRateDecrease: 100,
      checkInterval: 20000,
      kingHealth: 10,
      fatZombieMinHealth: 3,
      fatZombieMaxHealth: 4,
      speedMultiplier: 0.8,
      kingSpawnDelay: 180000, // 3 minutes
      kingSpawnChance: 0.3, // 30% chance
      doubleSpawnChance: 0.25, // 25% chance for double spawn
    },
    normal: {
      initialSpawnRate: 4000,
      minSpawnRate: 1500,
      spawnRateDecrease: 150,
      checkInterval: 15000,
      kingHealth: 8,
      fatZombieMinHealth: 2,
      fatZombieMaxHealth: 3,
      speedMultiplier: 1,
      kingSpawnDelay: 120000, // 2 minutes
      kingSpawnChance: 0.6, // 60% chance
      doubleSpawnChance: 0.5, // 50% chance for double spawn
    },
    hard: {
      initialSpawnRate: 3000,
      minSpawnRate: 1000,
      spawnRateDecrease: 200,
      checkInterval: 10000,
      kingHealth: 6,
      fatZombieMinHealth: 2,
      fatZombieMaxHealth: 2,
      speedMultiplier: 1.2,
      kingSpawnDelay: 90000, // 1.5 minutes
      kingSpawnChance: 0.8, // 80% chance
      doubleSpawnChance: 0.9, // 90% chance for double spawn
    },
  };

  @Output() exitGame = new EventEmitter<void>();

  constructor(
    private mathService: MathService,
    private portugueseService: PortugueseService,
    private colorQuestionsService: ColorQuestionsService,
    private spriteAnimationService: SpriteAnimationService,
    private router: Router,
    private audioService: AudioService,
    private settingsService: SettingsService,
    private shapeQuestionsService: ShapeQuestionsService
  ) {
    this.settings = this.settingsService.getCurrentSettings();
    const difficulty = this.difficultySettings[this.settings.gameDifficulty];
    this.spawnTimeoutMs = difficulty.initialSpawnRate;
    this.minSpawnTimeoutMs = difficulty.minSpawnRate;
  }

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
    this.selectedAnswer = null;
    switch (this.settings.curriculum) {
      case 'colors': {
        const colorQ = this.colorQuestionsService.generateQuestion();
        this.currentQuestion = {
          ...colorQ,
          curriculum: 'colors',
        };
        break;
      }
      case 'shapes': {
        const shapeQ = this.shapeQuestionsService.generateQuestion();
        this.currentQuestion = {
          ...shapeQ,
          curriculum: 'shapes',
        };
        break;
      }
      case 'math': {
        const mathQ = this.mathService.generateQuestion();
        this.currentQuestion = {
          ...mathQ,
          curriculum: 'math',
        };
        break;
      }
      case 'portuguese': {
        const portQ = this.portugueseService.generateQuestion();
        this.currentQuestion = {
          ...portQ,
          curriculum: 'portuguese',
        };
        break;
      }
    }
  }

  checkAnswer(answer: string | number) {
    this.selectedAnswer = answer;
    const isCorrect =
      this.settings.curriculum === 'shapes'
        ? answer === this.currentQuestion?.answer
        : answer === this.currentQuestion?.answer;

    if (isCorrect) {
      this.handleCorrectAnswer();
    } else {
      this.wrongAnswer = answer;
      this.handleWrongAnswer();
    }
  }

  private handleCorrectAnswer() {
    console.log('Correct!');
    this.wrongAnswer = null;
    this.selectedAnswer = null;
    this.removeClosestZombie();
    this.lemonadeGiven++;
    this.correctStreak++;
    if (this.correctStreak > 1) {
      this.scoreMultiplier = this.correctStreak;
    }
    // Check for power-up at current threshold
    if (this.correctStreak === this.powerUpThreshold) {
      this.showPowerUp = true;
    }
    this.generateNewQuestion();
  }

  private handleWrongAnswer() {
    console.log('Wrong answer!');
    this.wrongAnswer = null;
    this.selectedAnswer = null;
    this.showPowerUp = false; // Hide power-up on wrong answer
    // Play zombie sound and spawn a new zombie
    this.audioService.playZombieSound();
    this.spawnZombie();
  }

  private removeClosestZombie() {
    if (this.zombies.length === 0) return;

    // Add logging
    console.log('Attempting to remove closest zombie');
    console.log(
      'Current zombies before removal: ',
      this.zombies.map((z) => z.id)
    );

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
    const difficulty = this.difficultySettings[this.settings.gameDifficulty];
    this.spawnTimeoutMs = difficulty.initialSpawnRate;

    // Spawn zombies at current rate
    this.zombieSpawnInterval = setInterval(() => {
      // Always spawn at least one zombie
      this.spawnZombie();

      // Check for double spawn based on difficulty
      if (Math.random() < difficulty.doubleSpawnChance) {
        // Add a small delay for the second zombie to make it look more natural
        setTimeout(() => {
          this.spawnZombie();
        }, 200);
      }
    }, this.spawnTimeoutMs);

    // Schedule first king spawn
    this.scheduleNextKing();

    // Increase difficulty based on settings
    this.spawnRateDecreaseInterval = setInterval(() => {
      if (this.spawnTimeoutMs > difficulty.minSpawnRate) {
        // Clear existing spawn interval
        if (this.zombieSpawnInterval) {
          clearInterval(this.zombieSpawnInterval);
        }

        // Decrease spawn time by configured amount
        this.spawnTimeoutMs = Math.max(
          difficulty.minSpawnRate,
          this.spawnTimeoutMs - difficulty.spawnRateDecrease
        );

        // Create new spawn interval with updated rate
        this.zombieSpawnInterval = setInterval(() => {
          this.spawnZombie();
        }, this.spawnTimeoutMs);
      }
    }, difficulty.checkInterval);
  }

  private scheduleNextKing() {
    const difficulty = this.difficultySettings[this.settings.gameDifficulty];
    this.kingSpawnTimeout = setTimeout(() => {
      // Check spawn chance based on difficulty
      if (Math.random() < difficulty.kingSpawnChance) {
        this.spawnKing();
      }
      this.scheduleNextKing(); // Schedule next king check
    }, difficulty.kingSpawnDelay);
  }

  private spawnKing() {
    this.audioService.playKingZombieSpawnSound();
    const difficulty = this.difficultySettings[this.settings.gameDifficulty];
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
      speed: 0.4 * difficulty.speedMultiplier,
      type: 'king',
      health: difficulty.kingHealth,
    };

    this.zombies.push(zombie);
    this.createZombieSprite(zombie);
  }

  private spawnZombie() {
    // Add logging
    console.log(`Spawning zombie with ID: ${this.nextZombieId}`);

    const difficulty = this.difficultySettings[this.settings.gameDifficulty];
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
      speed = (0.3 + Math.random() * 0.2) * difficulty.speedMultiplier;
    } else {
      // Normal zombies have tiered speeds
      const speedRoll = Math.random();
      if (speedRoll < 0.2) {
        speed = (1.4 + Math.random() * 0.4) * difficulty.speedMultiplier; // fast
      } else if (speedRoll < 0.5) {
        speed = (0.9 + Math.random() * 0.3) * difficulty.speedMultiplier; // medium
      } else {
        speed = (0.5 + Math.random() * 0.3) * difficulty.speedMultiplier; // slow
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
      health: isFatZombie
        ? Math.floor(
            Math.random() *
              (difficulty.fatZombieMaxHealth -
                difficulty.fatZombieMinHealth +
                1)
          ) + difficulty.fatZombieMinHealth
        : 1,
    };

    this.zombies.push(zombie);
    this.createZombieSprite(zombie);
    console.log(
      `Current zombies: `,
      this.zombies.map((z) => z.id)
    );
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
    this.scoreMultiplier = 1;
    this.correctStreak = 0;
    this.showPowerUp = false;
    this.powerUpThreshold = 10; // Reset threshold on game restart

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
    this.spawnTimeoutMs = this.minSpawnTimeoutMs;

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

  getColorHex(
    option: string | number | { name: string; color: string }
  ): string {
    if (typeof option === 'object' && 'color' in option) {
      return option.color;
    }
    return this.colorQuestionsService.getColorHex(String(option));
  }

  getSvgPath(
    shapeName: string | number | { name: string; color: string }
  ): string {
    if (typeof shapeName === 'object' && 'name' in shapeName) {
      return this.shapeQuestionsService.getShapeSvg(shapeName.name);
    }
    return this.shapeQuestionsService.getShapeSvg(String(shapeName));
  }

  getOptionValue(option: any): string | number {
    return this.settings.curriculum === 'shapes' ? option.name : option;
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

  activatePowerUp() {
    if (!this.showPowerUp) return;

    // Filter out king zombies and regular zombies
    const regularZombies = this.zombies.filter(
      (zombie) => zombie.type !== 'king'
    );
    const kingZombies = this.zombies.filter((zombie) => zombie.type === 'king');

    // Create explosion effect for regular zombies only
    regularZombies.forEach((zombie) => {
      const zombieCanvas = this.gameAreaRef.nativeElement.querySelector(
        `[data-zombie-id="${zombie.id}"]`
      ) as HTMLCanvasElement;

      if (zombieCanvas) {
        // Add explosion effect
        zombieCanvas.style.transition = 'all 0.3s ease-out';
        zombieCanvas.style.transform = 'scale(1.5)';
        zombieCanvas.style.filter = 'brightness(2)';
        zombieCanvas.style.opacity = '0';
      }
    });

    // Clear movement intervals for regular zombies only
    regularZombies.forEach((zombie) => {
      const interval = this.moveIntervals.get(zombie.id);
      if (interval) {
        clearInterval(interval);
        this.moveIntervals.delete(zombie.id);
      }
    });

    // Show QUENCHED! message and play sound
    this.showQuenched = true;
    this.audioService.playQuenchedSound();

    // Remove regular zombies after animation
    setTimeout(() => {
      // Keep king zombies in the array
      this.zombies = kingZombies;

      // Remove only regular zombie sprites
      regularZombies.forEach((zombie) => {
        const zombieSprite = this.gameAreaRef.nativeElement.querySelector(
          `[data-zombie-id="${zombie.id}"]`
        );
        if (zombieSprite) {
          zombieSprite.remove();
        }
      });
    }, 300);

    // Hide QUENCHED! message after a delay
    setTimeout(() => {
      this.showQuenched = false;
    }, 1500);

    // Increase power-up threshold and reset state
    this.powerUpThreshold += 5;
    this.showPowerUp = false;
    this.correctStreak = 0;
    this.scoreMultiplier = 1;
  }
}

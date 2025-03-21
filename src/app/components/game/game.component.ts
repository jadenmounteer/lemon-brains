import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  isGameOver = false;
  private nextZombieId = 0;
  private gameAreaRect?: DOMRect;
  private zombieSpawnInterval?: ReturnType<typeof setInterval>;
  private resizeObserver?: ResizeObserver;
  private moveIntervals: Map<number, ReturnType<typeof setInterval>> =
    new Map();

  constructor(
    private mathService: MathService,
    private spriteAnimationService: SpriteAnimationService,
    private router: Router
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

    // Create and animate lemonade projectile
    this.shootLemonadeAt(closestZombie);

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

  private shootLemonadeAt(zombie: ZombieState) {
    console.log('Shooting lemonade at zombie:', zombie.id);

    const lemonadeConfig = {
      imageUrl: 'assets/sprites/lemonade.png',
      frameWidth: 128, // Width of one frame (256/2 columns)
      frameHeight: 128, // Height of one frame (384/3 rows)
      totalFrames: 1, // We only want to show one frame
      currentFrame: 0, // Use first frame
      fps: 1,
      displayWidth: 96, // Larger display size
      displayHeight: 96, // Keep it square
    };

    console.log('Loading lemonade sprite with config:', lemonadeConfig);
    const canvas = this.spriteAnimationService.loadSprite(lemonadeConfig);

    canvas.classList.add('lemonade-projectile');
    console.log('Added lemonade-projectile class');

    // Start from lemonade stand position
    const gameArea = this.gameAreaRef.nativeElement;
    const rect = gameArea.getBoundingClientRect();
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

    // Animate to zombie position
    requestAnimationFrame(() => {
      canvas.style.transition = 'all 0.5s ease-out';
      canvas.style.left = `${zombie.x + 36}px`;
      canvas.style.top = `${zombie.y + 36}px`;
      canvas.style.transform = 'translate(-50%, -50%) scale(0.5) rotate(45deg)';
      canvas.style.opacity = '0';
      console.log('Animating to position:', {
        x: zombie.x + 36,
        y: zombie.y + 36,
      });
    });

    // Remove the projectile after animation
    setTimeout(() => {
      canvas.remove();
      console.log('Removed lemonade projectile');
    }, 500);
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
      displayWidth: 72,
      displayHeight: 72,
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
        this.handleGameOver();
        return;
      }

      // Update facing direction
      zombie.facingLeft = zombie.x > targetX;

      // Move zombie (reduced speed from 0.3 to 0.15)
      const speed = 0.15;
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

  private handleGameOver() {
    this.isGameOver = true;

    // Stop spawning new zombies
    if (this.zombieSpawnInterval) {
      clearInterval(this.zombieSpawnInterval);
    }

    // Stop all zombie movement
    this.moveIntervals.forEach((interval) => clearInterval(interval));
    this.moveIntervals.clear();
  }

  restartGame() {
    // Reset game state
    this.isGameOver = false;

    // Clear all zombies
    this.zombies = [];
    const gameArea = this.gameAreaRef.nativeElement;
    const zombieElements = gameArea.querySelectorAll('.zombie');
    zombieElements.forEach((zombie: Element) => zombie.remove());

    // Reset zombie ID counter
    this.nextZombieId = 0;

    // Clear all intervals
    this.moveIntervals.forEach((interval) => clearInterval(interval));
    this.moveIntervals.clear();

    // Start spawning zombies again
    this.startZombieSpawning();

    // Generate new question
    this.generateNewQuestion();
  }

  goToMainMenu() {
    // Clean up game state
    this.ngOnDestroy();
    // Navigate to main menu
    this.router.navigate(['/']);
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

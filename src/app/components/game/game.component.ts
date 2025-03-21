import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MathService } from '../../services/math.service';
import { MathQuestion } from '../../models/math-question.interface';
import { SpriteAnimationService } from '../../services/sprite-animation.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit, AfterViewInit {
  @ViewChild('gameArea') gameAreaRef!: ElementRef;
  currentQuestion?: MathQuestion;
  wrongAnswer: number | null = null;

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
}

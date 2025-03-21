import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MathService } from '../../services/math.service';
import { MathQuestion } from '../../models/math-question.interface';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit {
  currentQuestion?: MathQuestion;
  wrongAnswer: number | null = null;

  constructor(private mathService: MathService) {}

  ngOnInit() {
    this.generateNewQuestion();
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
}

import { Injectable } from '@angular/core';
import { MathQuestion } from '../models/math-question.interface';

@Injectable({
  providedIn: 'root',
})
export class MathService {
  private operations = ['+', '-', '*'];
  private maxNumber = 10;

  generateQuestion(): MathQuestion {
    const num1 = Math.floor(Math.random() * this.maxNumber) + 1;
    const num2 = Math.floor(Math.random() * this.maxNumber) + 1;
    const operation =
      this.operations[Math.floor(Math.random() * this.operations.length)];

    let correctAnswer: number;
    switch (operation) {
      case '+':
        correctAnswer = num1 + num2;
        break;
      case '-':
        correctAnswer = num1 - num2;
        break;
      case '*':
        correctAnswer = num1 * num2;
        break;
      default:
        correctAnswer = 0;
    }

    // Generate wrong options
    const options = this.generateOptions(correctAnswer);

    return {
      question: `${num1} ${operation} ${num2} = ?`,
      options: options,
      correctAnswer: correctAnswer,
    };
  }

  private generateOptions(correctAnswer: number): number[] {
    const options = [correctAnswer];

    while (options.length < 4) {
      const wrongAnswer = correctAnswer + Math.floor(Math.random() * 10) - 5;
      if (wrongAnswer !== correctAnswer && !options.includes(wrongAnswer)) {
        options.push(wrongAnswer);
      }
    }

    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  }
}

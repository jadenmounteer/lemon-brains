import { Injectable } from '@angular/core';
import { MathQuestion } from '../models/math-question.interface';
import { SettingsService, GameSettings } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class MathService {
  private settings: GameSettings;

  constructor(private settingsService: SettingsService) {
    this.settings = this.settingsService.getCurrentSettings();
    this.settingsService.getSettings().subscribe((settings) => {
      this.settings = settings;
    });
  }

  generateQuestion(): MathQuestion {
    const availableOperations = this.getAvailableOperations();
    if (availableOperations.length === 0) {
      throw new Error('No question types selected in settings');
    }

    const operation =
      availableOperations[
        Math.floor(Math.random() * availableOperations.length)
      ];
    const { num1, num2 } = this.generateNumbers(operation);

    let question: string;
    let answer: number;

    switch (operation) {
      case 'addition':
        question = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
        break;
      case 'subtraction':
        question = `${num1} - ${num2} = ?`;
        answer = num1 - num2;
        break;
      case 'multiplication':
        question = `${num1} × ${num2} = ?`;
        answer = num1 * num2;
        break;
      case 'division':
        // Ensure clean division
        answer = num1;
        question = `${num1 * num2} ÷ ${num2} = ?`;
        break;
      default:
        throw new Error('Invalid operation');
    }

    const options = this.generateOptions(answer);
    return { question, options, answer };
  }

  private getAvailableOperations(): string[] {
    return Object.entries(this.settings.questionTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type);
  }

  private generateNumbers(operation: string): { num1: number; num2: number } {
    const difficulty = this.settings.difficulty;
    let range: { min: number; max: number };
    let num1: number;
    let num2: number;

    switch (difficulty) {
      case 'easy':
        range = { min: 1, max: 5 };
        break;
      case 'medium':
        range = { min: 1, max: 10 };
        break;
      case 'hard':
        range = { min: 5, max: 20 };
        break;
      default:
        range = { min: 1, max: 10 };
    }

    switch (operation) {
      case 'addition':
      case 'subtraction':
        num1 =
          Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        num2 =
          Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        if (operation === 'subtraction') {
          // Ensure num1 is larger for subtraction
          [num1, num2] = [Math.max(num1, num2), Math.min(num1, num2)];
        }
        break;
      case 'multiplication':
        // For multiplication, use full range for easy, but limit factors for medium/hard
        if (difficulty === 'easy') {
          num1 =
            Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
          num2 =
            Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        } else {
          // For medium and hard, limit one factor to make it more manageable
          const maxFactor = Math.min(10, Math.floor(Math.sqrt(range.max)));
          num1 = Math.floor(Math.random() * maxFactor) + 1;
          num2 = Math.floor(Math.random() * (range.max / num1)) + 1;
        }
        break;
      case 'division':
        if (difficulty === 'easy') {
          // For easy, ensure clean division with small numbers
          num2 = Math.floor(Math.random() * 3) + 1; // divisors 1-3
          num1 = Math.floor(Math.random() * 2) + 1; // quotient 1-2
        } else {
          // For medium and hard, still ensure clean division
          num2 = Math.floor(Math.random() * (Math.sqrt(range.max) - 1)) + 1;
          num1 = Math.floor(Math.random() * (range.max / num2)) + 1;
        }
        break;
      default:
        throw new Error('Invalid operation');
    }

    return { num1, num2 };
  }

  private generateOptions(answer: number): number[] {
    const options = [answer];
    const range = Math.max(5, Math.floor(answer * 0.5));

    while (options.length < 4) {
      const offset = Math.floor(Math.random() * range) + 1;
      const option = Math.random() < 0.5 ? answer + offset : answer - offset;

      if (!options.includes(option) && option >= 0) {
        options.push(option);
      }
    }

    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  }
}

import { Curriculum } from '../curriculum';
import { AppSettings } from '../models/app-settings';
import {
  LearningOption,
  LearningQuestion,
} from '../models/learning-question';
import { pickRandom, shuffle } from '../utils/shuffle';

export class MathCurriculum implements Curriculum {
  readonly id = 'math';
  readonly label = 'Mathematics';

  isConfigured(settings: AppSettings): boolean {
    const hasOperation = Object.values(settings.math.operations).some(Boolean);
    const hasRange = Object.values(settings.math.numberRanges).some(Boolean);
    return hasOperation && hasRange;
  }

  generateQuestion(settings: AppSettings): LearningQuestion {
    const availableOperations = Object.entries(settings.math.operations)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type);

    if (availableOperations.length === 0) {
      throw new Error('No question types selected in settings');
    }

    const operation = pickRandom(availableOperations);
    const { num1, num2 } = this.generateNumbers(operation, settings);

    let prompt: string;
    let answer: number;

    switch (operation) {
      case 'addition':
        prompt = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
        break;
      case 'subtraction':
        prompt = `${num1} - ${num2} = ?`;
        answer = num1 - num2;
        break;
      case 'multiplication':
        prompt = `${num1} × ${num2} = ?`;
        answer = num1 * num2;
        break;
      case 'division':
        answer = num1;
        prompt = `${num1 * num2} ÷ ${num2} = ?`;
        break;
      default:
        throw new Error('Invalid operation');
    }

    const options: LearningOption[] = this.generateOptions(answer).map(
      (value) => ({
        value,
        label: String(value),
      })
    );

    return {
      prompt,
      options,
      answer,
      optionDisplay: 'text',
      curriculumId: this.id,
    };
  }

  private generateNumbers(
    operation: string,
    settings: AppSettings
  ): { num1: number; num2: number } {
    const availableRanges: { min: number; max: number }[] = [];

    if (settings.math.numberRanges.range0to5) {
      availableRanges.push({ min: 0, max: 5 });
    }
    if (settings.math.numberRanges.range5to10) {
      availableRanges.push({ min: 5, max: 10 });
    }
    if (settings.math.numberRanges.range10to20) {
      availableRanges.push({ min: 10, max: 20 });
    }

    if (availableRanges.length === 0) {
      availableRanges.push({ min: 0, max: 5 });
    }

    const range = pickRandom(availableRanges);
    let num1: number;
    let num2: number;

    switch (operation) {
      case 'addition':
      case 'subtraction':
        num1 =
          Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        num2 =
          Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        if (operation === 'subtraction') {
          [num1, num2] = [Math.max(num1, num2), Math.min(num1, num2)];
        }
        break;
      case 'multiplication': {
        const maxFactor = Math.min(10, Math.floor(Math.sqrt(range.max)));
        num1 = Math.floor(Math.random() * maxFactor) + 1;
        num2 = Math.floor(Math.random() * (range.max / num1)) + 1;
        break;
      }
      case 'division':
        num2 =
          Math.floor(Math.random() * Math.min(5, range.max - range.min)) + 1;
        num1 =
          Math.floor(
            Math.random() * Math.min(5, (range.max - range.min) / num2)
          ) + 1;
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

    return shuffle(options);
  }
}

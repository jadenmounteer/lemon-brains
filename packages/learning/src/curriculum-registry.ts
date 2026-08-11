import { Curriculum } from './curriculum';
import { AppSettings } from './models/app-settings';
import { LearningQuestion } from './models/learning-question';

export class CurriculumRegistry {
  constructor(private readonly curricula: Curriculum[]) {}

  list(): Curriculum[] {
    return this.curricula;
  }

  get(id: string): Curriculum | undefined {
    return this.curricula.find((curriculum) => curriculum.id === id);
  }

  getActive(settings: AppSettings): Curriculum {
    const curriculum = this.get(settings.curriculumId);
    if (!curriculum) {
      throw new Error(`Unknown curriculum: ${settings.curriculumId}`);
    }
    return curriculum;
  }

  generateQuestion(settings: AppSettings): LearningQuestion {
    return this.getActive(settings).generateQuestion(settings);
  }

  isCorrect(selected: string | number, question: LearningQuestion): boolean {
    return selected === question.answer;
  }

  isConfigured(settings: AppSettings): boolean {
    const curriculum = this.get(settings.curriculumId);
    return curriculum?.isConfigured(settings) ?? false;
  }
}

import { AppSettings } from './models/app-settings';
import { LearningQuestion } from './models/learning-question';

export interface Curriculum {
  readonly id: string;
  readonly label: string;
  generateQuestion(settings: AppSettings): LearningQuestion;
  isConfigured(settings: AppSettings): boolean;
}

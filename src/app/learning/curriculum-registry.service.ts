import { Inject, Injectable } from '@angular/core';
import { Curriculum } from './curriculum';
import { CURRICULA } from './curriculum.token';
import { AppSettings } from './models/app-settings';
import { LearningQuestion } from './models/learning-question';
import { SettingsService } from '../services/settings.service';

@Injectable({
  providedIn: 'root',
})
export class CurriculumRegistry {
  constructor(
    @Inject(CURRICULA) private readonly curricula: Curriculum[],
    private readonly settingsService: SettingsService
  ) {}

  list(): Curriculum[] {
    return this.curricula;
  }

  get(id: string): Curriculum | undefined {
    return this.curricula.find((curriculum) => curriculum.id === id);
  }

  getActive(settings: AppSettings = this.settingsService.getCurrentSettings()): Curriculum {
    const curriculum = this.get(settings.curriculumId);
    if (!curriculum) {
      throw new Error(`Unknown curriculum: ${settings.curriculumId}`);
    }
    return curriculum;
  }

  generateQuestion(
    settings: AppSettings = this.settingsService.getCurrentSettings()
  ): LearningQuestion {
    return this.getActive(settings).generateQuestion(settings);
  }

  isCorrect(
    selected: string | number,
    question: LearningQuestion
  ): boolean {
    return selected === question.answer;
  }

  isConfigured(
    settings: AppSettings = this.settingsService.getCurrentSettings()
  ): boolean {
    const curriculum = this.get(settings.curriculumId);
    return curriculum?.isConfigured(settings) ?? false;
  }
}

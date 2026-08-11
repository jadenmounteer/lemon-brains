import { APP_INITIALIZER, Provider } from '@angular/core';
import {
  createCurriculumRegistry,
  CurriculumRegistry,
  SpeechSynthesisService,
} from '@knowledge-quest/learning';
import { SettingsService } from './services/settings.service';

export function provideKnowledgeQuest(): Provider[] {
  return [
    {
      provide: CurriculumRegistry,
      useFactory: () => createCurriculumRegistry(),
    },
    {
      provide: SpeechSynthesisService,
      useFactory: () => new SpeechSynthesisService(),
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [SettingsService],
      useFactory: (settings: SettingsService) => () => settings.init(),
    },
  ];
}

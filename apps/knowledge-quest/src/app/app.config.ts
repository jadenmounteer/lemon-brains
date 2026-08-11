import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { createCurriculumRegistry, CurriculumRegistry } from '@knowledge-quest/learning';
import { routes } from './app.routes';
import { SettingsService } from './services/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: CurriculumRegistry,
      useFactory: () => createCurriculumRegistry(),
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [SettingsService],
      useFactory: (settings: SettingsService) => () => settings.init(),
    },
  ],
};

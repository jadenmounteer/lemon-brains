import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideCurricula } from './learning/provide-curricula';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideCurricula()],
};

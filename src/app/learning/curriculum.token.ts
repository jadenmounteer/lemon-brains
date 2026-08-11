import { InjectionToken } from '@angular/core';
import { Curriculum } from './curriculum';

export const CURRICULA = new InjectionToken<Curriculum[]>('CURRICULA');

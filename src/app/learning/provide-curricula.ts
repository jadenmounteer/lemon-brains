import { Provider } from '@angular/core';
import { CURRICULA } from './curriculum.token';
import { ColorsCurriculum } from './curricula/colors.curriculum';
import { MathCurriculum } from './curricula/math.curriculum';
import { PortugueseCurriculum } from './curricula/portuguese.curriculum';
import { ReadingCurriculum } from './curricula/reading.curriculum';
import { ShapesCurriculum } from './curricula/shapes.curriculum';

export function provideCurricula(): Provider {
  return {
    provide: CURRICULA,
    useFactory: () => [
      new MathCurriculum(),
      new PortugueseCurriculum(),
      new ColorsCurriculum(),
      new ShapesCurriculum(),
      new ReadingCurriculum(),
    ],
  };
}

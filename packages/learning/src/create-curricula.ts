import { Curriculum } from './curriculum';
import { CurriculumRegistry } from './curriculum-registry';
import { ColorsCurriculum } from './curricula/colors.curriculum';
import { MathCurriculum } from './curricula/math.curriculum';
import { PortugueseCurriculum } from './curricula/portuguese.curriculum';
import { ReadingCurriculum } from './curricula/reading.curriculum';
import { ShapesCurriculum } from './curricula/shapes.curriculum';

export function createDefaultCurricula(): Curriculum[] {
  return [
    new MathCurriculum(),
    new PortugueseCurriculum(),
    new ColorsCurriculum(),
    new ShapesCurriculum(),
    new ReadingCurriculum(),
  ];
}

export function createCurriculumRegistry(
  curricula: Curriculum[] = createDefaultCurricula()
): CurriculumRegistry {
  return new CurriculumRegistry(curricula);
}

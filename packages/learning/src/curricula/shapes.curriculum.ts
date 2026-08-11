import { Curriculum } from '../curriculum';
import { AppSettings } from '../models/app-settings';
import {
  LearningOption,
  LearningQuestion,
} from '../models/learning-question';
import { pickRandom, shuffle } from '../utils/shuffle';

const FILL_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEEAD',
  '#D4A5A5',
  '#9B59B6',
  '#3498DB',
  '#E67E22',
  '#2ECC71',
];

const SHAPES = [
  {
    name: 'Circle',
    svg: 'M50,50 m-45,0 a45,45 0 1,0 90,0 a45,45 0 1,0 -90,0',
  },
  { name: 'Square', svg: 'M10,10 h80 v80 h-80 Z' },
  { name: 'Triangle', svg: 'M50,10 L90,90 L10,90 Z' },
  { name: 'Rectangle', svg: 'M10,25 h80 v50 h-80 Z' },
  { name: 'Pentagon', svg: 'M50,10 L90,40 L80,90 L20,90 L10,40 Z' },
  { name: 'Hexagon', svg: 'M50,10 L90,35 L90,65 L50,90 L10,65 L10,35 Z' },
  {
    name: 'Star',
    svg: 'M50,10 L61,40 L94,40 L68,60 L79,90 L50,73 L21,90 L32,60 L6,40 L39,40 Z',
  },
  { name: 'Diamond', svg: 'M50,10 L90,50 L50,90 L10,50 Z' },
  { name: 'Oval', svg: 'M25,50 a25,50 0 1,0 50,0 a25,50 0 1,0 -50,0' },
  {
    name: 'Heart',
    svg: 'M50,90 C26.5,67.5 3,53.5 3,31.6 3,15.8 15.7,10 25,10 c5.5,0 17.3,2.1 25,18.6 6.6-16.5 18.6-18.5 25-18.5 10.6,0 22,6.8 22,21.6 0,17-23.5,35.9-47,58.3',
  },
];

export class ShapesCurriculum implements Curriculum {
  readonly id = 'shapes';
  readonly label = 'Shapes';

  isConfigured(_settings: AppSettings): boolean {
    return true;
  }

  generateQuestion(_settings: AppSettings): LearningQuestion {
    const correctShape = pickRandom(SHAPES);
    const wrongShapes = shuffle(
      SHAPES.filter((shape) => shape.name !== correctShape.name)
    ).slice(0, 3);

    const options: LearningOption[] = shuffle([
      correctShape,
      ...wrongShapes,
    ]).map((shape) => ({
      value: shape.name,
      label: shape.name,
      svgPath: shape.svg,
      fillColor: pickRandom(FILL_COLORS),
    }));

    return {
      prompt: `Where is the ${correctShape.name.toLowerCase()}?`,
      options,
      answer: correctShape.name,
      optionDisplay: 'shapeSvg',
      curriculumId: this.id,
    };
  }
}

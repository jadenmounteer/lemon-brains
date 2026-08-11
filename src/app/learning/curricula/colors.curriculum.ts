import { Curriculum } from '../curriculum';
import { AppSettings } from '../models/app-settings';
import {
  LearningOption,
  LearningQuestion,
} from '../models/learning-question';
import { pickRandom, shuffle } from '../utils/shuffle';

const COLORS = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Brown', hex: '#A52A2A' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
] as const;

export class ColorsCurriculum implements Curriculum {
  readonly id = 'colors';
  readonly label = 'Colors';

  isConfigured(_settings: AppSettings): boolean {
    return true;
  }

  generateQuestion(_settings: AppSettings): LearningQuestion {
    const correctColor = pickRandom([...COLORS]);
    const wrongColors = shuffle(
      COLORS.filter((color) => color.name !== correctColor.name)
    ).slice(0, 3);

    const options: LearningOption[] = shuffle([
      correctColor,
      ...wrongColors,
    ]).map((color) => ({
      value: color.name,
      label: color.name,
      colorHex: color.hex,
    }));

    return {
      prompt: `What color is ${correctColor.name.toLowerCase()}?`,
      options,
      answer: correctColor.name,
      optionDisplay: 'colorSwatch',
      curriculumId: this.id,
    };
  }
}

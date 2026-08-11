export type OptionDisplay = 'text' | 'colorSwatch' | 'shapeSvg' | 'emoji';

export interface LearningOption {
  value: string | number;
  label?: string;
  colorHex?: string;
  svgPath?: string;
  fillColor?: string;
}

export interface LearningQuestion {
  prompt: string;
  options: LearningOption[];
  answer: string | number;
  optionDisplay: OptionDisplay;
  curriculumId: string;
}

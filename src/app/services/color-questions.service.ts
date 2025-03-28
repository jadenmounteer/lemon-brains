import { Injectable } from '@angular/core';

export interface ColorQuestion {
  question: string;
  answer: string;
  options: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ColorQuestionsService {
  private colors = [
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
  ];

  generateQuestion(): ColorQuestion {
    const correctColor =
      this.colors[Math.floor(Math.random() * this.colors.length)];

    // Get 3 random wrong colors
    const wrongColors = this.colors
      .filter((c) => c.name !== correctColor.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Combine correct and wrong answers and shuffle
    const options = [correctColor, ...wrongColors]
      .sort(() => Math.random() - 0.5)
      .map((c) => c.name);

    return {
      question: `What color is ${correctColor.name.toLowerCase()}?`,
      answer: correctColor.name,
      options: options,
    };
  }

  getColorHex(colorName: string): string {
    return this.colors.find((c) => c.name === colorName)?.hex || '#000000';
  }
}

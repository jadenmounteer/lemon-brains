import { Injectable } from '@angular/core';

export interface ShapeQuestion {
  question: string;
  answer: string;
  options: Array<{
    name: string;
    color: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ShapeQuestionsService {
  private colors = [
    '#FF6B6B', // coral red
    '#4ECDC4', // turquoise
    '#45B7D1', // sky blue
    '#96CEB4', // sage
    '#FFEEAD', // cream
    '#D4A5A5', // dusty rose
    '#9B59B6', // purple
    '#3498DB', // blue
    '#E67E22', // orange
    '#2ECC71', // green
  ];

  private shapes = [
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
      svg: 'M50,30 A20,20 0,0,1 90,30 A20,20 0,0,1 50,70 A20,20 0,0,1 10,30 A20,20 0,0,1 50,30 Z',
    },
  ];

  private getRandomColor(): string {
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }

  generateQuestion(): ShapeQuestion {
    const correctShape =
      this.shapes[Math.floor(Math.random() * this.shapes.length)];
    const wrongShapes = this.shapes
      .filter((s) => s.name !== correctShape.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Assign random colors to each shape
    const options = [correctShape, ...wrongShapes]
      .sort(() => Math.random() - 0.5)
      .map((s) => ({
        name: s.name,
        color: this.getRandomColor(),
      }));

    return {
      question: `Where is the ${correctShape.name.toLowerCase()}?`,
      answer: correctShape.name,
      options: options,
    };
  }

  getShapeSvg(shapeName: string): string {
    return this.shapes.find((s) => s.name === shapeName)?.svg || '';
  }
}

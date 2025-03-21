import { Injectable } from '@angular/core';
import { MathQuestion } from '../models/math-question.interface';
import { SettingsService, GameSettings } from './settings.service';

interface PortugueseWord {
  portuguese: string;
  english: string;
  category: 'vocabulary' | 'phrases' | 'numbers' | 'colors';
}

@Injectable({
  providedIn: 'root',
})
export class PortugueseService {
  private settings: GameSettings;
  private vocabulary: PortugueseWord[] = [
    { portuguese: 'casa', english: 'house', category: 'vocabulary' },
    { portuguese: 'cachorro', english: 'dog', category: 'vocabulary' },
    { portuguese: 'gato', english: 'cat', category: 'vocabulary' },
    { portuguese: 'água', english: 'water', category: 'vocabulary' },
    { portuguese: 'comida', english: 'food', category: 'vocabulary' },
  ];

  private phrases: PortugueseWord[] = [
    { portuguese: 'Bom dia', english: 'Good morning', category: 'phrases' },
    { portuguese: 'Boa noite', english: 'Good night', category: 'phrases' },
    { portuguese: 'Como vai?', english: 'How are you?', category: 'phrases' },
    { portuguese: 'Obrigado(a)', english: 'Thank you', category: 'phrases' },
    { portuguese: 'Por favor', english: 'Please', category: 'phrases' },
  ];

  private numbers: PortugueseWord[] = [
    { portuguese: 'um', english: 'one', category: 'numbers' },
    { portuguese: 'dois', english: 'two', category: 'numbers' },
    { portuguese: 'três', english: 'three', category: 'numbers' },
    { portuguese: 'quatro', english: 'four', category: 'numbers' },
    { portuguese: 'cinco', english: 'five', category: 'numbers' },
  ];

  private colors: PortugueseWord[] = [
    { portuguese: 'vermelho', english: 'red', category: 'colors' },
    { portuguese: 'azul', english: 'blue', category: 'colors' },
    { portuguese: 'verde', english: 'green', category: 'colors' },
    { portuguese: 'amarelo', english: 'yellow', category: 'colors' },
    { portuguese: 'preto', english: 'black', category: 'colors' },
  ];

  constructor(private settingsService: SettingsService) {
    this.settings = this.settingsService.getCurrentSettings();
    this.settingsService.getSettings().subscribe((settings) => {
      this.settings = settings;
    });
  }

  generateQuestion(): MathQuestion {
    const availableCategories = this.getAvailableCategories();
    if (availableCategories.length === 0) {
      throw new Error('No question types selected in settings');
    }

    const category =
      availableCategories[
        Math.floor(Math.random() * availableCategories.length)
      ];
    let words: PortugueseWord[] = [];

    switch (category) {
      case 'vocabulary':
        words = this.vocabulary;
        break;
      case 'phrases':
        words = this.phrases;
        break;
      case 'numbers':
        words = this.numbers;
        break;
      case 'colors':
        words = this.colors;
        break;
    }

    const word = words[Math.floor(Math.random() * words.length)];
    const options = this.generateOptions(word, words);

    return {
      question: `What is the English translation of "${word.portuguese}"?`,
      options: options,
      answer: word.english,
    };
  }

  private getAvailableCategories(): string[] {
    return Object.entries(this.settings.portugueseTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type);
  }

  private generateOptions(
    correctWord: PortugueseWord,
    wordList: PortugueseWord[]
  ): string[] {
    const options = [correctWord.english];
    const availableWords = wordList.filter((w) => w !== correctWord);

    while (options.length < 4 && availableWords.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableWords.length);
      const word = availableWords[randomIndex];

      if (!options.includes(word.english)) {
        options.push(word.english);
        availableWords.splice(randomIndex, 1);
      }
    }

    // If we don't have enough words in the category, add some from other categories
    while (options.length < 4) {
      const allOtherWords = [
        ...this.vocabulary,
        ...this.phrases,
        ...this.numbers,
        ...this.colors,
      ].filter((w) => w !== correctWord && !options.includes(w.english));

      if (allOtherWords.length === 0) break;

      const randomWord =
        allOtherWords[Math.floor(Math.random() * allOtherWords.length)];
      options.push(randomWord.english);
    }

    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  }
}

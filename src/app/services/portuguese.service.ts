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
    // Basic nouns
    { portuguese: 'casa', english: 'house', category: 'vocabulary' },
    { portuguese: 'cachorro', english: 'dog', category: 'vocabulary' },
    { portuguese: 'gato', english: 'cat', category: 'vocabulary' },
    { portuguese: 'água', english: 'water', category: 'vocabulary' },
    { portuguese: 'comida', english: 'food', category: 'vocabulary' },
    // Family
    { portuguese: 'mãe', english: 'mother', category: 'vocabulary' },
    { portuguese: 'pai', english: 'father', category: 'vocabulary' },
    { portuguese: 'irmão', english: 'brother', category: 'vocabulary' },
    { portuguese: 'irmã', english: 'sister', category: 'vocabulary' },
    { portuguese: 'avó', english: 'grandmother', category: 'vocabulary' },
    { portuguese: 'avô', english: 'grandfather', category: 'vocabulary' },
    { portuguese: 'filho', english: 'son', category: 'vocabulary' },
    { portuguese: 'filha', english: 'daughter', category: 'vocabulary' },
    { portuguese: 'tio', english: 'uncle', category: 'vocabulary' },
    { portuguese: 'tia', english: 'aunt', category: 'vocabulary' },
    { portuguese: 'primo', english: 'cousin (male)', category: 'vocabulary' },
    { portuguese: 'prima', english: 'cousin (female)', category: 'vocabulary' },
    // Food and drinks
    { portuguese: 'pão', english: 'bread', category: 'vocabulary' },
    { portuguese: 'café', english: 'coffee', category: 'vocabulary' },
    { portuguese: 'leite', english: 'milk', category: 'vocabulary' },
    { portuguese: 'arroz', english: 'rice', category: 'vocabulary' },
    { portuguese: 'feijão', english: 'beans', category: 'vocabulary' },
    { portuguese: 'fruta', english: 'fruit', category: 'vocabulary' },
    { portuguese: 'carne', english: 'meat', category: 'vocabulary' },
    { portuguese: 'peixe', english: 'fish', category: 'vocabulary' },
    { portuguese: 'suco', english: 'juice', category: 'vocabulary' },
    { portuguese: 'cerveja', english: 'beer', category: 'vocabulary' },
    { portuguese: 'vinho', english: 'wine', category: 'vocabulary' },
    { portuguese: 'sobremesa', english: 'dessert', category: 'vocabulary' },
    { portuguese: 'sorvete', english: 'ice cream', category: 'vocabulary' },
    // Common objects
    { portuguese: 'livro', english: 'book', category: 'vocabulary' },
    { portuguese: 'mesa', english: 'table', category: 'vocabulary' },
    { portuguese: 'cadeira', english: 'chair', category: 'vocabulary' },
    { portuguese: 'cama', english: 'bed', category: 'vocabulary' },
    { portuguese: 'porta', english: 'door', category: 'vocabulary' },
    { portuguese: 'janela', english: 'window', category: 'vocabulary' },
    { portuguese: 'computador', english: 'computer', category: 'vocabulary' },
    { portuguese: 'telefone', english: 'phone', category: 'vocabulary' },
    { portuguese: 'televisão', english: 'television', category: 'vocabulary' },
    { portuguese: 'chave', english: 'key', category: 'vocabulary' },
    { portuguese: 'relógio', english: 'clock/watch', category: 'vocabulary' },
    // Places
    { portuguese: 'praia', english: 'beach', category: 'vocabulary' },
    { portuguese: 'escola', english: 'school', category: 'vocabulary' },
    {
      portuguese: 'restaurante',
      english: 'restaurant',
      category: 'vocabulary',
    },
    { portuguese: 'hospital', english: 'hospital', category: 'vocabulary' },
    { portuguese: 'mercado', english: 'market', category: 'vocabulary' },
    { portuguese: 'banco', english: 'bank', category: 'vocabulary' },
    { portuguese: 'parque', english: 'park', category: 'vocabulary' },
    { portuguese: 'igreja', english: 'church', category: 'vocabulary' },
    // Weather and Nature
    { portuguese: 'sol', english: 'sun', category: 'vocabulary' },
    { portuguese: 'chuva', english: 'rain', category: 'vocabulary' },
    { portuguese: 'vento', english: 'wind', category: 'vocabulary' },
    { portuguese: 'nuvem', english: 'cloud', category: 'vocabulary' },
    { portuguese: 'mar', english: 'sea', category: 'vocabulary' },
    { portuguese: 'montanha', english: 'mountain', category: 'vocabulary' },
    { portuguese: 'floresta', english: 'forest', category: 'vocabulary' },
    { portuguese: 'rio', english: 'river', category: 'vocabulary' },
  ];

  private phrases: PortugueseWord[] = [
    // Greetings
    { portuguese: 'Bom dia', english: 'Good morning', category: 'phrases' },
    { portuguese: 'Boa tarde', english: 'Good afternoon', category: 'phrases' },
    { portuguese: 'Boa noite', english: 'Good night', category: 'phrases' },
    { portuguese: 'Olá', english: 'Hello', category: 'phrases' },
    { portuguese: 'Tchau', english: 'Goodbye', category: 'phrases' },
    { portuguese: 'Até logo', english: 'See you later', category: 'phrases' },
    {
      portuguese: 'Até amanhã',
      english: 'See you tomorrow',
      category: 'phrases',
    },
    { portuguese: 'Bem-vindo(a)', english: 'Welcome', category: 'phrases' },
    // Common expressions
    { portuguese: 'Como vai?', english: 'How are you?', category: 'phrases' },
    { portuguese: 'Tudo bem?', english: 'All good?', category: 'phrases' },
    { portuguese: 'Obrigado(a)', english: 'Thank you', category: 'phrases' },
    { portuguese: 'Por favor', english: 'Please', category: 'phrases' },
    { portuguese: 'De nada', english: "You're welcome", category: 'phrases' },
    {
      portuguese: 'Prazer',
      english: 'Nice to meet you',
      category: 'phrases',
    },
    { portuguese: 'Desculpe', english: 'Sorry', category: 'phrases' },
    { portuguese: 'Parabéns', english: 'Congratulations', category: 'phrases' },
    // Useful phrases
    {
      portuguese: 'Eu não entendo',
      english: "I don't understand",
      category: 'phrases',
    },
    {
      portuguese: 'Fala mais devagar',
      english: 'Speak more slowly',
      category: 'phrases',
    },
    {
      portuguese: 'Como se diz?',
      english: 'How do you say?',
      category: 'phrases',
    },
    { portuguese: 'Onde está?', english: 'Where is?', category: 'phrases' },
    {
      portuguese: 'Quanto custa?',
      english: 'How much is it?',
      category: 'phrases',
    },
    { portuguese: 'Com licença', english: 'Excuse me', category: 'phrases' },
    {
      portuguese: 'Me ajuda?',
      english: 'Can you help me?',
      category: 'phrases',
    },
    // Restaurant phrases
    {
      portuguese: 'A conta, por favor',
      english: 'The bill, please',
      category: 'phrases',
    },
    {
      portuguese: 'Estou com fome',
      english: 'I am hungry',
      category: 'phrases',
    },
    {
      portuguese: 'Estou com sede',
      english: 'I am thirsty',
      category: 'phrases',
    },
    {
      portuguese: 'Está delicioso',
      english: 'It is delicious',
      category: 'phrases',
    },
    {
      portuguese: 'Quero fazer um pedido',
      english: 'I want to order',
      category: 'phrases',
    },
    // Travel phrases
    {
      portuguese: 'Onde fica o banheiro?',
      english: 'Where is the bathroom?',
      category: 'phrases',
    },
    {
      portuguese: 'Quanto tempo leva?',
      english: 'How long does it take?',
      category: 'phrases',
    },
    {
      portuguese: 'Você fala inglês?',
      english: 'Do you speak English?',
      category: 'phrases',
    },
    {
      portuguese: 'Eu estou perdido(a)',
      english: 'I am lost',
      category: 'phrases',
    },
    {
      portuguese: 'Que horas são?',
      english: 'What time is it?',
      category: 'phrases',
    },
    // Emergency phrases
    {
      portuguese: 'Preciso de ajuda',
      english: 'I need help',
      category: 'phrases',
    },
    {
      portuguese: 'Chame a polícia',
      english: 'Call the police',
      category: 'phrases',
    },
    {
      portuguese: 'Chame uma ambulância',
      english: 'Call an ambulance',
      category: 'phrases',
    },
    {
      portuguese: 'É uma emergência',
      english: 'It is an emergency',
      category: 'phrases',
    },
  ];

  private numbers: PortugueseWord[] = [
    { portuguese: 'zero', english: 'zero', category: 'numbers' },
    { portuguese: 'um', english: 'one', category: 'numbers' },
    { portuguese: 'dois', english: 'two', category: 'numbers' },
    { portuguese: 'três', english: 'three', category: 'numbers' },
    { portuguese: 'quatro', english: 'four', category: 'numbers' },
    { portuguese: 'cinco', english: 'five', category: 'numbers' },
    { portuguese: 'seis', english: 'six', category: 'numbers' },
    { portuguese: 'sete', english: 'seven', category: 'numbers' },
    { portuguese: 'oito', english: 'eight', category: 'numbers' },
    { portuguese: 'nove', english: 'nine', category: 'numbers' },
    { portuguese: 'dez', english: 'ten', category: 'numbers' },
    { portuguese: 'onze', english: 'eleven', category: 'numbers' },
    { portuguese: 'doze', english: 'twelve', category: 'numbers' },
    { portuguese: 'treze', english: 'thirteen', category: 'numbers' },
    { portuguese: 'quatorze', english: 'fourteen', category: 'numbers' },
    { portuguese: 'quinze', english: 'fifteen', category: 'numbers' },
    { portuguese: 'vinte', english: 'twenty', category: 'numbers' },
    { portuguese: 'trinta', english: 'thirty', category: 'numbers' },
    { portuguese: 'cem', english: 'one hundred', category: 'numbers' },
    { portuguese: 'mil', english: 'one thousand', category: 'numbers' },
  ];

  private colors: PortugueseWord[] = [
    { portuguese: 'vermelho', english: 'red', category: 'colors' },
    { portuguese: 'azul', english: 'blue', category: 'colors' },
    { portuguese: 'verde', english: 'green', category: 'colors' },
    { portuguese: 'amarelo', english: 'yellow', category: 'colors' },
    { portuguese: 'preto', english: 'black', category: 'colors' },
    { portuguese: 'branco', english: 'white', category: 'colors' },
    { portuguese: 'cinza', english: 'gray', category: 'colors' },
    { portuguese: 'marrom', english: 'brown', category: 'colors' },
    { portuguese: 'roxo', english: 'purple', category: 'colors' },
    { portuguese: 'rosa', english: 'pink', category: 'colors' },
    { portuguese: 'laranja', english: 'orange', category: 'colors' },
    { portuguese: 'dourado', english: 'gold', category: 'colors' },
    { portuguese: 'prateado', english: 'silver', category: 'colors' },
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

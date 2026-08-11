import { Curriculum } from '../curriculum';
import { AppSettings } from '../models/app-settings';
import {
  LearningOption,
  LearningQuestion,
} from '../models/learning-question';
import { pickRandom, shuffle } from '../utils/shuffle';

type PortugueseCategory = 'vocabulary' | 'phrases' | 'numbers' | 'colors';

interface PortugueseWord {
  portuguese: string;
  english: string;
  category: PortugueseCategory;
}

const VOCABULARY: PortugueseWord[] = [
  { portuguese: 'casa', english: 'house', category: 'vocabulary' },
  { portuguese: 'cachorro', english: 'dog', category: 'vocabulary' },
  { portuguese: 'gato', english: 'cat', category: 'vocabulary' },
  { portuguese: 'água', english: 'water', category: 'vocabulary' },
  { portuguese: 'comida', english: 'food', category: 'vocabulary' },
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
  { portuguese: 'pão', english: 'bread', category: 'vocabulary' },
  { portuguese: 'café', english: 'coffee', category: 'vocabulary' },
  { portuguese: 'leite', english: 'milk', category: 'vocabulary' },
  { portuguese: 'arroz', english: 'rice', category: 'vocabulary' },
  { portuguese: 'feijão', english: 'beans', category: 'vocabulary' },
  { portuguese: 'fruta', english: 'fruit', category: 'vocabulary' },
  { portuguese: 'carne', english: 'meat', category: 'vocabulary' },
  { portuguese: 'peixe', english: 'fish', category: 'vocabulary' },
  { portuguese: 'suco', english: 'juice', category: 'vocabulary' },
  { portuguese: 'lanche', english: 'snack', category: 'vocabulary' },
  { portuguese: 'biscoito', english: 'cookie', category: 'vocabulary' },
  { portuguese: 'sorvete', english: 'ice cream', category: 'vocabulary' },
  {
    portuguese: 'batata frita',
    english: 'french fries',
    category: 'vocabulary',
  },
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
  { portuguese: 'sol', english: 'sun', category: 'vocabulary' },
  { portuguese: 'chuva', english: 'rain', category: 'vocabulary' },
  { portuguese: 'vento', english: 'wind', category: 'vocabulary' },
  { portuguese: 'nuvem', english: 'cloud', category: 'vocabulary' },
  { portuguese: 'mar', english: 'sea', category: 'vocabulary' },
  { portuguese: 'montanha', english: 'mountain', category: 'vocabulary' },
  { portuguese: 'floresta', english: 'forest', category: 'vocabulary' },
  { portuguese: 'rio', english: 'river', category: 'vocabulary' },
];

const PHRASES: PortugueseWord[] = [
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
  { portuguese: 'Como vai?', english: 'How are you?', category: 'phrases' },
  { portuguese: 'Tudo bem?', english: 'All good?', category: 'phrases' },
  { portuguese: 'Obrigado(a)', english: 'Thank you', category: 'phrases' },
  { portuguese: 'Por favor', english: 'Please', category: 'phrases' },
  { portuguese: 'De nada', english: "You're welcome", category: 'phrases' },
  { portuguese: 'Prazer', english: 'Nice to meet you', category: 'phrases' },
  { portuguese: 'Desculpe', english: 'Sorry', category: 'phrases' },
  { portuguese: 'Parabéns', english: 'Congratulations', category: 'phrases' },
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

const NUMBERS: PortugueseWord[] = [
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

const COLORS: PortugueseWord[] = [
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

const WORDS_BY_CATEGORY: Record<PortugueseCategory, PortugueseWord[]> = {
  vocabulary: VOCABULARY,
  phrases: PHRASES,
  numbers: NUMBERS,
  colors: COLORS,
};

const ALL_WORDS = [...VOCABULARY, ...PHRASES, ...NUMBERS, ...COLORS];

export class PortugueseCurriculum implements Curriculum {
  readonly id = 'portuguese';
  readonly label = 'Portuguese';

  isConfigured(settings: AppSettings): boolean {
    return Object.values(settings.portuguese.categories).some(Boolean);
  }

  generateQuestion(settings: AppSettings): LearningQuestion {
    const availableCategories = Object.entries(settings.portuguese.categories)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type as PortugueseCategory);

    if (availableCategories.length === 0) {
      throw new Error('No question types selected in settings');
    }

    const category = pickRandom(availableCategories);
    const words = WORDS_BY_CATEGORY[category];
    const word = pickRandom(words);
    const optionValues = this.generateOptionValues(word, words);

    const options: LearningOption[] = optionValues.map((value) => ({
      value,
      label: value,
    }));

    return {
      prompt: `What is the English translation of "${word.portuguese}"?`,
      options,
      answer: word.english,
      optionDisplay: 'text',
      curriculumId: this.id,
    };
  }

  private generateOptionValues(
    correctWord: PortugueseWord,
    wordList: PortugueseWord[]
  ): string[] {
    const options = [correctWord.english];
    const availableWords = wordList.filter((word) => word !== correctWord);

    while (options.length < 4 && availableWords.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableWords.length);
      const word = availableWords[randomIndex];

      if (!options.includes(word.english)) {
        options.push(word.english);
        availableWords.splice(randomIndex, 1);
      }
    }

    while (options.length < 4) {
      const allOtherWords = ALL_WORDS.filter(
        (word) => word !== correctWord && !options.includes(word.english)
      );

      if (allOtherWords.length === 0) {
        break;
      }

      options.push(pickRandom(allOtherWords).english);
    }

    return shuffle(options);
  }
}

import { Curriculum } from '../curriculum';
import { AppSettings } from '../models/app-settings';
import {
  LearningOption,
  LearningQuestion,
} from '../models/learning-question';
import { pickRandom, shuffle } from '../utils/shuffle';
import {
  CVC_WORDS,
  LETTERS,
  SIGHT_WORD_DISTRACTORS,
  SIGHT_WORDS,
} from './reading-content';

type ReadingTopic = 'letterRecognition' | 'cvcWords' | 'sightWords';

export class ReadingCurriculum implements Curriculum {
  readonly id = 'reading';
  readonly label = 'Reading';

  isConfigured(settings: AppSettings): boolean {
    return Object.values(settings.reading).some(Boolean);
  }

  generateQuestion(settings: AppSettings): LearningQuestion {
    const topics = (
      Object.entries(settings.reading) as [ReadingTopic, boolean][]
    )
      .filter(([, enabled]) => enabled)
      .map(([topic]) => topic);

    if (topics.length === 0) {
      throw new Error('No reading topics selected in settings');
    }

    switch (pickRandom(topics)) {
      case 'letterRecognition':
        return this.generateLetterQuestion();
      case 'cvcWords':
        return this.generateCvcQuestion();
      case 'sightWords':
        return this.generateSightWordQuestion();
    }
  }

  private generateLetterQuestion(): LearningQuestion {
    const answer = pickRandom(LETTERS);
    const distractors = shuffle(LETTERS.filter((letter) => letter !== answer))
      .slice(0, 3);

    const options: LearningOption[] = shuffle([answer, ...distractors]).map(
      (letter) => ({
        value: letter,
        label: letter,
      })
    );

    return {
      prompt: `Which letter is ${answer}?`,
      options,
      answer,
      optionDisplay: 'text',
      curriculumId: this.id,
    };
  }

  private generateCvcQuestion(): LearningQuestion {
    const correct = pickRandom(CVC_WORDS);
    const distractors = shuffle(
      CVC_WORDS.filter((entry) => entry.word !== correct.word)
    ).slice(0, 3);

    const options: LearningOption[] = shuffle([correct, ...distractors]).map(
      (entry) => ({
        value: entry.word,
        label: entry.emoji,
      })
    );

    const spaced = correct.word.split('').join('-');

    return {
      prompt: `Which picture matches ${spaced}?`,
      options,
      answer: correct.word,
      optionDisplay: 'emoji',
      curriculumId: this.id,
    };
  }

  private generateSightWordQuestion(): LearningQuestion {
    const answer = pickRandom(SIGHT_WORDS);
    const key = answer.toLowerCase();
    const preferredDistractors = SIGHT_WORD_DISTRACTORS[key] ?? [];
    const fallback = SIGHT_WORDS.filter(
      (word) => word.toLowerCase() !== key
    );
    const distractors = shuffle([
      ...preferredDistractors,
      ...fallback.filter(
        (word) => !preferredDistractors.includes(word.toLowerCase())
      ),
    ])
      .filter((word) => word.toLowerCase() !== key)
      .slice(0, 3);

    const options: LearningOption[] = shuffle([answer, ...distractors]).map(
      (word) => ({
        value: word,
        label: word,
      })
    );

    return {
      prompt: `Find the word: ${answer}`,
      options,
      answer,
      optionDisplay: 'text',
      curriculumId: this.id,
    };
  }
}

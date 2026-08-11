import { Curriculum } from '../curriculum';
import { AppSettings } from '../models/app-settings';
import {
  LearningOption,
  LearningQuestion,
} from '../models/learning-question';
import { pickRandom, shuffle } from '../utils/shuffle';
import {
  CVC_WORDS,
  LETTER_PICTURES,
  LETTERS,
  SIGHT_WORD_DISTRACTORS,
  SIGHT_WORDS,
} from './reading-content';

type ReadingTopic = 'letterRecognition' | 'cvcWords' | 'sightWords';

type LetterSubtype = 'beginning' | 'caseMatch' | 'hearLetter';

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
    const subtype = pickRandom<LetterSubtype>([
      'beginning',
      'caseMatch',
      'hearLetter',
    ]);

    switch (subtype) {
      case 'beginning':
        return this.generateBeginningLetterQuestion();
      case 'caseMatch':
        return this.generateCaseMatchQuestion();
      case 'hearLetter':
        return this.generateHearLetterQuestion();
    }
  }

  private generateBeginningLetterQuestion(): LearningQuestion {
    const correct = pickRandom(LETTER_PICTURES);
    const distractorLetters = shuffle(
      LETTER_PICTURES.filter((entry) => entry.letter !== correct.letter).map(
        (entry) => entry.letter
      )
    ).slice(0, 3);

    return {
      prompt: `${correct.emoji}\nWhat letter does this start with?`,
      options: this.letterOptions([correct.letter, ...distractorLetters]),
      answer: correct.letter,
      optionDisplay: 'text',
      curriculumId: this.id,
    };
  }

  private generateCaseMatchQuestion(): LearningQuestion {
    const answer = pickRandom(LETTERS);
    const lowercase = answer.toLowerCase();
    const distractors = shuffle(LETTERS.filter((letter) => letter !== answer))
      .slice(0, 3);

    return {
      prompt: `Which capital letter matches: ${lowercase}`,
      options: this.letterOptions([answer, ...distractors]),
      answer,
      optionDisplay: 'text',
      curriculumId: this.id,
    };
  }

  private generateHearLetterQuestion(): LearningQuestion {
    const answer = pickRandom(LETTERS);
    const distractors = shuffle(LETTERS.filter((letter) => letter !== answer))
      .slice(0, 3);

    return {
      prompt: 'Which letter do you hear?',
      options: this.letterOptions([answer, ...distractors]),
      answer,
      optionDisplay: 'text',
      curriculumId: this.id,
      promptSpeech: `the letter ${answer}`,
    };
  }

  private letterOptions(letters: string[]): LearningOption[] {
    return shuffle(letters).map((letter) => ({
      value: letter,
      label: letter,
    }));
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

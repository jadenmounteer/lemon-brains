import { DEFAULT_APP_SETTINGS } from '../models/app-settings';
import { LearningQuestion } from '../models/learning-question';
import { ReadingCurriculum } from './reading.curriculum';

describe('ReadingCurriculum', () => {
  const curriculum = new ReadingCurriculum();

  const letterOnlySettings = {
    ...DEFAULT_APP_SETTINGS,
    curriculumId: 'reading' as const,
    reading: {
      letterRecognition: true,
      cvcWords: false,
      sightWords: false,
    },
  };

  function classifyLetterQuestion(question: LearningQuestion): string {
    if (question.promptSpeech) {
      return 'hearLetter';
    }
    if (question.prompt.includes('capital letter matches')) {
      return 'caseMatch';
    }
    if (question.prompt.includes('start with')) {
      return 'beginning';
    }
    return 'unknown';
  }

  it('is configured when any reading topic is enabled', () => {
    expect(
      curriculum.isConfigured({
        ...DEFAULT_APP_SETTINGS,
        reading: {
          letterRecognition: false,
          cvcWords: false,
          sightWords: false,
        },
      })
    ).toBe(false);

    expect(
      curriculum.isConfigured({
        ...DEFAULT_APP_SETTINGS,
        reading: {
          letterRecognition: true,
          cvcWords: false,
          sightWords: false,
        },
      })
    ).toBe(true);
  });

  it('generates valid 4-option questions with the answer included', () => {
    const settings = {
      ...DEFAULT_APP_SETTINGS,
      curriculumId: 'reading' as const,
      reading: {
        letterRecognition: true,
        cvcWords: true,
        sightWords: true,
      },
    };

    for (let i = 0; i < 30; i++) {
      const question = curriculum.generateQuestion(settings);
      expect(question.curriculumId).toBe('reading');
      expect(question.options.length).toBe(4);
      expect(question.options.map((option) => option.value)).toContain(
        question.answer
      );
      expect(
        ['text', 'emoji'].includes(question.optionDisplay)
      ).toBeTrue();
    }
  });

  it('can generate letter-only, cvc-only, and sight-word-only questions', () => {
    const letterQ = curriculum.generateQuestion(letterOnlySettings);
    expect(letterQ.optionDisplay).toBe('text');
    expect(String(letterQ.answer).length).toBe(1);

    const cvcQ = curriculum.generateQuestion({
      ...DEFAULT_APP_SETTINGS,
      reading: {
        letterRecognition: false,
        cvcWords: true,
        sightWords: false,
      },
    });
    expect(cvcQ.optionDisplay).toBe('emoji');

    const sightQ = curriculum.generateQuestion({
      ...DEFAULT_APP_SETTINGS,
      reading: {
        letterRecognition: false,
        cvcWords: false,
        sightWords: true,
      },
    });
    expect(sightQ.optionDisplay).toBe('text');
    expect(sightQ.prompt.toLowerCase()).toContain('find the word');
  });

  it('produces all three letter-recognition subtypes over many generations', () => {
    const seen = new Set<string>();

    for (let i = 0; i < 80; i++) {
      seen.add(classifyLetterQuestion(curriculum.generateQuestion(letterOnlySettings)));
    }

    expect(seen.has('beginning')).toBeTrue();
    expect(seen.has('caseMatch')).toBeTrue();
    expect(seen.has('hearLetter')).toBeTrue();
    expect(seen.has('unknown')).toBeFalse();
  });

  it('keeps hear-letter prompts free of an answer glyph', () => {
    let heard = 0;

    for (let i = 0; i < 60; i++) {
      const question = curriculum.generateQuestion(letterOnlySettings);
      if (!question.promptSpeech) {
        continue;
      }

      heard += 1;
      // Fixed prompt has no answer glyph; the letter is only in speech + options.
      expect(question.prompt).toBe('Which letter do you hear?');
      expect(question.promptSpeech).toBe(`the letter ${question.answer}`);
      expect(question.prompt).not.toMatch(
        new RegExp(`\\b${question.answer}\\b`, 'i')
      );
      expect(question.options.map((option) => option.value)).toContain(
        question.answer
      );
    }

    expect(heard).toBeGreaterThan(0);
  });

  it('builds beginning-letter questions with emoji cues and letter options', () => {
    let beginning: LearningQuestion | undefined;

    for (let i = 0; i < 40; i++) {
      const question = curriculum.generateQuestion(letterOnlySettings);
      if (classifyLetterQuestion(question) === 'beginning') {
        beginning = question;
        break;
      }
    }

    expect(beginning).toBeTruthy();
    expect(beginning!.optionDisplay).toBe('text');
    expect(beginning!.prompt).toContain('start with');
    expect(beginning!.options.every((option) => String(option.value).length === 1)).toBeTrue();
    expect(beginning!.options.map((option) => option.value)).toContain(
      beginning!.answer
    );
  });

  it('builds case-match questions with uppercase answers for lowercase cues', () => {
    let caseMatch: LearningQuestion | undefined;

    for (let i = 0; i < 40; i++) {
      const question = curriculum.generateQuestion(letterOnlySettings);
      if (classifyLetterQuestion(question) === 'caseMatch') {
        caseMatch = question;
        break;
      }
    }

    expect(caseMatch).toBeTruthy();
    const answer = String(caseMatch!.answer);
    expect(answer).toBe(answer.toUpperCase());
    expect(caseMatch!.prompt).toContain(`matches: ${answer.toLowerCase()}`);
    expect(caseMatch!.prompt).not.toContain(`matches: ${answer}`);
  });
});

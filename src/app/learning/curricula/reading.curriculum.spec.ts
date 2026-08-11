import { DEFAULT_APP_SETTINGS } from '../models/app-settings';
import { ReadingCurriculum } from './reading.curriculum';

describe('ReadingCurriculum', () => {
  const curriculum = new ReadingCurriculum();

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
    const letterQ = curriculum.generateQuestion({
      ...DEFAULT_APP_SETTINGS,
      reading: {
        letterRecognition: true,
        cvcWords: false,
        sightWords: false,
      },
    });
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
});

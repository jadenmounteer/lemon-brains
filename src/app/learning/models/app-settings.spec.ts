import {
  DEFAULT_APP_SETTINGS,
  migrateSettings,
} from './app-settings';

describe('migrateSettings', () => {
  it('returns defaults for empty input', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(migrateSettings(undefined)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('migrates legacy flat settings into nested AppSettings', () => {
    const migrated = migrateSettings({
      curriculum: 'portuguese',
      gameDifficulty: 'hard',
      questionTypes: {
        addition: true,
        subtraction: false,
        multiplication: false,
        division: false,
      },
      numberRanges: {
        range0to5: false,
        range5to10: true,
        range10to20: false,
      },
      portugueseTypes: {
        vocabulary: true,
        phrases: false,
        numbers: false,
        colors: false,
      },
    });

    expect(migrated.curriculumId).toBe('portuguese');
    expect(migrated.gameDifficulty).toBe('hard');
    expect(migrated.math.operations.addition).toBe(true);
    expect(migrated.math.operations.subtraction).toBe(false);
    expect(migrated.math.numberRanges.range5to10).toBe(true);
    expect(migrated.portuguese.categories.vocabulary).toBe(true);
    expect(migrated.portuguese.categories.phrases).toBe(false);
    expect(migrated.reading.letterRecognition).toBe(true);
  });

  it('preserves already-migrated nested settings', () => {
    const migrated = migrateSettings({
      curriculumId: 'reading',
      gameDifficulty: 'easy',
      reading: {
        letterRecognition: true,
        cvcWords: false,
        sightWords: true,
      },
    });

    expect(migrated.curriculumId).toBe('reading');
    expect(migrated.reading.cvcWords).toBe(false);
    expect(migrated.reading.sightWords).toBe(true);
  });
});

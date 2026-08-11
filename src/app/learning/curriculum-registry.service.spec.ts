import { TestBed } from '@angular/core/testing';
import { CurriculumRegistry } from './curriculum-registry.service';
import { provideCurricula } from './provide-curricula';
import { SettingsService } from '../services/settings.service';
import { DEFAULT_APP_SETTINGS } from './models/app-settings';

describe('CurriculumRegistry', () => {
  let registry: CurriculumRegistry;
  let settingsService: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideCurricula()],
    });
    registry = TestBed.inject(CurriculumRegistry);
    settingsService = TestBed.inject(SettingsService);
  });

  it('lists all registered curricula including reading', () => {
    const ids = registry.list().map((curriculum) => curriculum.id);
    expect(ids).toEqual([
      'math',
      'portuguese',
      'colors',
      'shapes',
      'reading',
    ]);
  });

  it('generates questions for the active curriculum', () => {
    settingsService.updateSettings({
      ...DEFAULT_APP_SETTINGS,
      curriculumId: 'colors',
    });

    const question = registry.generateQuestion();
    expect(question.curriculumId).toBe('colors');
    expect(question.optionDisplay).toBe('colorSwatch');
    expect(question.options.every((option) => !!option.colorHex)).toBeTrue();
  });

  it('uses per-curriculum configuration checks', () => {
    expect(
      registry.isConfigured({
        ...DEFAULT_APP_SETTINGS,
        curriculumId: 'math',
        math: {
          operations: {
            addition: false,
            subtraction: false,
            multiplication: false,
            division: false,
          },
          numberRanges: {
            range0to5: true,
            range5to10: false,
            range10to20: false,
          },
        },
      })
    ).toBe(false);

    expect(
      registry.isConfigured({
        ...DEFAULT_APP_SETTINGS,
        curriculumId: 'colors',
      })
    ).toBe(true);

    expect(
      registry.isConfigured({
        ...DEFAULT_APP_SETTINGS,
        curriculumId: 'reading',
        reading: {
          letterRecognition: false,
          cvcWords: false,
          sightWords: false,
        },
      })
    ).toBe(false);
  });

  it('checks answers by value equality', () => {
    const question = {
      prompt: 'test',
      options: [
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
      ],
      answer: 'a',
      optionDisplay: 'text' as const,
      curriculumId: 'reading',
    };

    expect(registry.isCorrect('a', question)).toBeTrue();
    expect(registry.isCorrect('b', question)).toBeFalse();
  });
});

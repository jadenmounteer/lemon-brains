import { createCurriculumRegistry } from './create-curricula';
import { DEFAULT_APP_SETTINGS } from './models/app-settings';

describe('CurriculumRegistry', () => {
  const registry = createCurriculumRegistry();

  it('lists all default curricula including reading', () => {
    expect(registry.list().map((curriculum) => curriculum.id)).toEqual([
      'math',
      'portuguese',
      'colors',
      'shapes',
      'reading',
    ]);
  });

  it('generates questions for the requested curriculum', () => {
    const question = registry.generateQuestion({
      ...DEFAULT_APP_SETTINGS,
      curriculumId: 'colors',
    });
    expect(question.curriculumId).toBe('colors');
    expect(question.optionDisplay).toBe('colorSwatch');
  });

  it('checks configuration per curriculum', () => {
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
          numberRanges: DEFAULT_APP_SETTINGS.math.numberRanges,
        },
      })
    ).toBe(false);

    expect(
      registry.isConfigured({
        ...DEFAULT_APP_SETTINGS,
        curriculumId: 'colors',
      })
    ).toBe(true);
  });
});

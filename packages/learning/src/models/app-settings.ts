export type CurriculumId =
  | 'math'
  | 'portuguese'
  | 'colors'
  | 'shapes'
  | 'reading';

export type GameDifficulty = 'easy' | 'normal' | 'hard';

export interface MathSettings {
  operations: {
    addition: boolean;
    subtraction: boolean;
    multiplication: boolean;
    division: boolean;
  };
  numberRanges: {
    range0to5: boolean;
    range5to10: boolean;
    range10to20: boolean;
  };
}

export interface PortugueseSettings {
  categories: {
    vocabulary: boolean;
    phrases: boolean;
    numbers: boolean;
    colors: boolean;
  };
}

export interface ReadingSettings {
  letterRecognition: boolean;
  cvcWords: boolean;
  sightWords: boolean;
}

export interface AppSettings {
  curriculumId: CurriculumId;
  gameDifficulty: GameDifficulty;
  /** When true, every question is spoken aloud and shows a replay control. */
  readQuestionsAloud: boolean;
  math: MathSettings;
  portuguese: PortugueseSettings;
  reading: ReadingSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  curriculumId: 'math',
  gameDifficulty: 'normal',
  readQuestionsAloud: false,
  math: {
    operations: {
      addition: true,
      subtraction: true,
      multiplication: true,
      division: true,
    },
    numberRanges: {
      range0to5: true,
      range5to10: false,
      range10to20: false,
    },
  },
  portuguese: {
    categories: {
      vocabulary: true,
      phrases: true,
      numbers: true,
      colors: true,
    },
  },
  reading: {
    letterRecognition: true,
    cvcWords: true,
    sightWords: true,
  },
};

/** Legacy flat settings shape stored before the learning-engine refactor. */
export interface LegacyGameSettings {
  curriculum?: string;
  curriculumId?: CurriculumId;
  questionTypes?: Partial<MathSettings['operations']>;
  portugueseTypes?: Partial<PortugueseSettings['categories']>;
  numberRanges?: Partial<MathSettings['numberRanges']>;
  gameDifficulty?: GameDifficulty;
  readQuestionsAloud?: boolean;
  math?: Partial<MathSettings> & {
    operations?: Partial<MathSettings['operations']>;
    numberRanges?: Partial<MathSettings['numberRanges']>;
  };
  portuguese?: Partial<PortugueseSettings> & {
    categories?: Partial<PortugueseSettings['categories']>;
  };
  reading?: Partial<ReadingSettings>;
}

const VALID_CURRICULUM_IDS: CurriculumId[] = [
  'math',
  'portuguese',
  'colors',
  'shapes',
  'reading',
];

function asCurriculumId(value: unknown): CurriculumId | null {
  return typeof value === 'string' &&
    VALID_CURRICULUM_IDS.includes(value as CurriculumId)
    ? (value as CurriculumId)
    : null;
}

export function migrateSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_APP_SETTINGS);
  }

  const parsed = raw as LegacyGameSettings;
  const curriculumId =
    asCurriculumId(parsed.curriculumId) ??
    asCurriculumId(parsed.curriculum) ??
    DEFAULT_APP_SETTINGS.curriculumId;

  return {
    curriculumId,
    gameDifficulty: parsed.gameDifficulty ?? DEFAULT_APP_SETTINGS.gameDifficulty,
    readQuestionsAloud:
      typeof parsed.readQuestionsAloud === 'boolean'
        ? parsed.readQuestionsAloud
        : DEFAULT_APP_SETTINGS.readQuestionsAloud,
    math: {
      operations: {
        ...DEFAULT_APP_SETTINGS.math.operations,
        ...(parsed.math?.operations ?? parsed.questionTypes ?? {}),
      },
      numberRanges: {
        ...DEFAULT_APP_SETTINGS.math.numberRanges,
        ...(parsed.math?.numberRanges ?? parsed.numberRanges ?? {}),
      },
    },
    portuguese: {
      categories: {
        ...DEFAULT_APP_SETTINGS.portuguese.categories,
        ...(parsed.portuguese?.categories ?? parsed.portugueseTypes ?? {}),
      },
    },
    reading: {
      ...DEFAULT_APP_SETTINGS.reading,
      ...(parsed.reading ?? {}),
    },
  };
}

export type { Curriculum } from './curriculum';
export { CurriculumRegistry } from './curriculum-registry';
export {
  createCurriculumRegistry,
  createDefaultCurricula,
} from './create-curricula';
export { SpeechSynthesisService } from './speech-synthesis';
export type {
  AppSettings,
  CurriculumId,
  GameDifficulty,
  MathSettings,
  PortugueseSettings,
  ReadingSettings,
  LegacyGameSettings,
} from './models/app-settings';
export {
  DEFAULT_APP_SETTINGS,
  migrateSettings,
} from './models/app-settings';
export type {
  LearningOption,
  LearningQuestion,
  OptionDisplay,
} from './models/learning-question';
export {
  promptToSpeechText,
  resolveQuestionSpeech,
} from './utils/spoken-question';
export { pickRandom, shuffle } from './utils/shuffle';

import { StoragePort } from './storage-port';

export const PROGRESS_STORAGE_KEY = 'knowledgeQuest.progress';

export interface ProgressSave {
  questionsAnswered: number;
  questionsCorrect: number;
  currentStreak: number;
  bestStreak: number;
}

export const DEFAULT_PROGRESS: ProgressSave = {
  questionsAnswered: 0,
  questionsCorrect: 0,
  currentStreak: 0,
  bestStreak: 0,
};

const STREAK_MILESTONES = [3, 5, 10] as const;

export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

export interface AnswerRecordResult extends ProgressSave {
  /** Set when a streak milestone was just reached. */
  streakMilestone?: StreakMilestone;
}

function normalize(raw: Partial<ProgressSave> | null | undefined): ProgressSave {
  if (!raw) return structuredClone(DEFAULT_PROGRESS);
  return {
    questionsAnswered: Math.max(0, Math.floor(raw.questionsAnswered ?? 0)),
    questionsCorrect: Math.max(0, Math.floor(raw.questionsCorrect ?? 0)),
    currentStreak: Math.max(0, Math.floor(raw.currentStreak ?? 0)),
    bestStreak: Math.max(0, Math.floor(raw.bestStreak ?? 0)),
  };
}

export class ProgressRepository {
  constructor(
    private readonly storage: StoragePort,
    private readonly key: string = PROGRESS_STORAGE_KEY
  ) {}

  async load(): Promise<ProgressSave> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return structuredClone(DEFAULT_PROGRESS);
    try {
      return normalize(JSON.parse(raw) as Partial<ProgressSave>);
    } catch {
      return structuredClone(DEFAULT_PROGRESS);
    }
  }

  async save(data: ProgressSave): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(normalize(data)));
  }

  /** Pure streak logic — also used in tests without storage. */
  recordAnswer(current: ProgressSave, correct: boolean): AnswerRecordResult {
    const next = normalize(current);
    next.questionsAnswered += 1;

    let streakMilestone: StreakMilestone | undefined;
    if (correct) {
      next.questionsCorrect += 1;
      next.currentStreak += 1;
      next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
      if (
        STREAK_MILESTONES.includes(next.currentStreak as StreakMilestone)
      ) {
        streakMilestone = next.currentStreak as StreakMilestone;
      }
    } else {
      next.currentStreak = 0;
    }

    return streakMilestone ? { ...next, streakMilestone } : next;
  }

  async recordAndSave(correct: boolean): Promise<AnswerRecordResult> {
    const current = await this.load();
    const next = this.recordAnswer(current, correct);
    const { streakMilestone: _m, ...savePayload } = next;
    await this.save(savePayload);
    return next;
  }
}

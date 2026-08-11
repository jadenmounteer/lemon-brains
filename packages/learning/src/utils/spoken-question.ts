import { LearningQuestion } from '../models/learning-question';

/** Strip emoji so TTS reads the question cleanly (keeps letters, numbers, math signs). */
export function promptToSpeechText(prompt: string): string {
  return prompt
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve what the shell should speak for a question.
 * - read-aloud on: spoken prompt, plus promptSpeech cue when present
 * - read-aloud off: only curriculum-provided promptSpeech (e.g. hear-letter)
 */
export function resolveQuestionSpeech(
  question: LearningQuestion | null | undefined,
  readQuestionsAloud: boolean
): string | null {
  if (!question) {
    return null;
  }

  if (readQuestionsAloud) {
    const spokenPrompt = promptToSpeechText(question.prompt);
    if (question.promptSpeech) {
      if (!spokenPrompt) {
        return question.promptSpeech;
      }
      const separator = /[.!?]$/.test(spokenPrompt) ? ' ' : '. ';
      return `${spokenPrompt}${separator}${question.promptSpeech}`;
    }
    return spokenPrompt || null;
  }

  return question.promptSpeech ?? null;
}

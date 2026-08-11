import { LearningQuestion } from '../models/learning-question';
import { promptToSpeechText, resolveQuestionSpeech } from './spoken-question';

describe('spoken-question utils', () => {
  const baseQuestion: LearningQuestion = {
    prompt: 'What is 2 + 2?',
    options: [{ value: 4, label: '4' }],
    answer: 4,
    optionDisplay: 'text',
    curriculumId: 'math',
  };

  it('strips emoji from prompt speech text', () => {
    expect(promptToSpeechText('🍎\nWhat letter does this start with?')).toBe(
      'What letter does this start with?'
    );
  });

  it('speaks only promptSpeech when read-aloud is off', () => {
    expect(
      resolveQuestionSpeech(
        { ...baseQuestion, promptSpeech: 'the letter N' },
        false
      )
    ).toBe('the letter N');

    expect(resolveQuestionSpeech(baseQuestion, false)).toBeNull();
  });

  it('speaks the prompt when read-aloud is on', () => {
    expect(resolveQuestionSpeech(baseQuestion, true)).toBe('What is 2 + 2?');
  });

  it('combines prompt and promptSpeech when read-aloud is on', () => {
    expect(
      resolveQuestionSpeech(
        {
          ...baseQuestion,
          prompt: 'Which letter do you hear?',
          promptSpeech: 'the letter N',
        },
        true
      )
    ).toBe('Which letter do you hear? the letter N');
  });
});

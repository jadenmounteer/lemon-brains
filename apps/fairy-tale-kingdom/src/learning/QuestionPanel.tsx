import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SpeechSynthesisService,
  createCurriculumRegistry,
  resolveQuestionSpeech,
  type AppSettings,
  type LearningOption,
  type LearningQuestion,
} from '@knowledge-quest/learning';
import { GOLD_PER_CORRECT } from './GoldRepository';

const registry = createCurriculumRegistry();
const speech = new SpeechSynthesisService();

interface QuestionPanelProps {
  settings: AppSettings;
  ready: boolean;
  onGoldEarned: () => Promise<number> | number;
  onClose?: () => void;
}

export function QuestionPanel({
  settings,
  ready,
  onGoldEarned,
  onClose,
}: QuestionPanelProps) {
  const [question, setQuestion] = useState<LearningQuestion | null>(null);
  const [wrongValue, setWrongValue] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const questionKey = useRef(0);

  const configured = useMemo(
    () => ready && registry.isConfigured(settings),
    [ready, settings]
  );

  const canReplay = useMemo(() => {
    if (!speech.isSupported()) return false;
    return !!resolveQuestionSpeech(question, settings.readQuestionsAloud);
  }, [question, settings.readQuestionsAloud]);

  const loadQuestion = () => {
    if (!configured) return;
    speech.cancel();
    setWrongValue(null);
    setFeedback(null);
    setLocked(false);
    questionKey.current += 1;
    const next = registry.generateQuestion(settings);
    setQuestion(next);
  };

  useEffect(() => {
    if (!configured) {
      setQuestion(null);
      return;
    }
    loadQuestion();
    return () => speech.cancel();
  }, [configured, settings.curriculumId, settings.readQuestionsAloud]);

  useEffect(() => {
    if (!question) return;
    const text = resolveQuestionSpeech(question, settings.readQuestionsAloud);
    if (text && speech.isSupported()) {
      speech.speak(text);
    }
  }, [question, settings.readQuestionsAloud]);

  const replay = () => {
    const text = resolveQuestionSpeech(question, settings.readQuestionsAloud);
    if (text && speech.isSupported()) {
      speech.speak(text);
    }
  };

  const onSelect = async (option: LearningOption) => {
    if (!question || locked) return;

    if (registry.isCorrect(option.value, question)) {
      setLocked(true);
      setWrongValue(null);
      setFeedback(`Correct! +${GOLD_PER_CORRECT} gold`);
      await onGoldEarned();
      window.setTimeout(() => {
        loadQuestion();
      }, 650);
    } else {
      setWrongValue(option.value);
      setFeedback('Try again');
      window.setTimeout(() => {
        setWrongValue(null);
        setFeedback(null);
      }, 700);
    }
  };

  const header = (
    <div className="sheet-header">
      <h2>Questions</h2>
      {onClose && (
        <button
          type="button"
          className="inspector-close touch-btn"
          onClick={onClose}
        >
          Close
        </button>
      )}
    </div>
  );

  if (!ready) {
    return (
      <section className="panel">
        {header}
        <p className="muted">Loading shared settings…</p>
      </section>
    );
  }

  if (!configured) {
    return (
      <section className="panel">
        {header}
        <p className="muted">
          Configure a curriculum in Knowledge Quest, then come back to earn gold.
        </p>
      </section>
    );
  }

  return (
    <section className="panel question-panel">
      <div className="sheet-header">
        <h2>Questions</h2>
        <div className="question-tools">
          {canReplay && (
            <button type="button" className="inspector-close touch-btn" onClick={replay}>
              Replay
            </button>
          )}
          <button type="button" className="inspector-close touch-btn" onClick={loadQuestion}>
            Next
          </button>
          {onClose && (
            <button
              type="button"
              className="inspector-close touch-btn"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
      {question && (
        <>
          <p className="question-prompt" key={questionKey.current}>
            {question.prompt}
          </p>
          <div
            className={`question-options display-${question.optionDisplay}`}
          >
            {question.options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={[
                  'question-option',
                  question.optionDisplay === 'colorSwatch' ? 'color-option' : '',
                  question.optionDisplay === 'shapeSvg' ? 'shape-option' : '',
                  question.optionDisplay === 'emoji' ? 'emoji-option' : '',
                  wrongValue === option.value ? 'wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  question.optionDisplay === 'colorSwatch' && option.colorHex
                    ? { backgroundColor: option.colorHex }
                    : undefined
                }
                disabled={locked}
                onClick={() => onSelect(option)}
              >
                {question.optionDisplay === 'text' && (
                  <span>{option.label}</span>
                )}
                {question.optionDisplay === 'emoji' && (
                  <span className="emoji-label">{option.label}</span>
                )}
                {question.optionDisplay === 'shapeSvg' && (
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <path
                      d={option.svgPath}
                      fill={option.fillColor ?? '#ccc'}
                      stroke="#333"
                      strokeWidth="2"
                    />
                  </svg>
                )}
                {question.optionDisplay === 'colorSwatch' && (
                  <span className="sr-only">{option.label ?? String(option.value)}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      {feedback && <p className="question-feedback">{feedback}</p>}
      <p className="muted curriculum-hint">
        Curriculum: {settings.curriculumId}
        {settings.readQuestionsAloud ? ' · read aloud on' : ''}
      </p>
    </section>
  );
}

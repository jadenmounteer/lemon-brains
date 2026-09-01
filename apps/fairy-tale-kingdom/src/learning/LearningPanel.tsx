import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SpeechSynthesisService,
  createCurriculumRegistry,
  resolveQuestionSpeech,
  type AppSettings,
  type LearningOption,
  type LearningQuestion,
} from '@knowledge-quest/learning';
import {
  LocalStorageAdapter,
  ProgressRepository,
  type ProgressSave,
} from '@knowledge-quest/storage';
import { config } from '../config';
import { QuestionOptions } from './QuestionOptions';

const registry = createCurriculumRegistry();
const speech = new SpeechSynthesisService();
const progressRepo = new ProgressRepository(new LocalStorageAdapter());

interface LearningPanelProps {
  settings: AppSettings;
  ready: boolean;
  goldPerCorrect: number;
  onGoldEarned: (amount: number) => Promise<number> | number;
  onStreakMilestone?: (milestone: number) => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void | Promise<void>;
  onQuickStart: () => void | Promise<void>;
  onClose?: () => void;
}

export function LearningPanel({
  settings,
  ready,
  goldPerCorrect,
  onGoldEarned,
  onStreakMilestone,
  onUpdateSettings,
  onQuickStart,
  onClose,
}: LearningPanelProps) {
  const [question, setQuestion] = useState<LearningQuestion | null>(null);
  const [wrongValue, setWrongValue] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState<ProgressSave | null>(null);
  const questionKey = useRef(0);

  const configured = useMemo(
    () => ready && registry.isConfigured(settings),
    [ready, settings]
  );

  const configureUrl = `${config.hostUrl.replace(/\/?$/, '/')}configure`;

  useEffect(() => {
    void progressRepo.load().then(setProgress);
  }, []);

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
    setQuestion(registry.generateQuestion(settings));
  };

  useEffect(() => {
    if (!configured) {
      setQuestion(null);
      return;
    }
    loadQuestion();
    return () => speech.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on curriculum / read-aloud
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
      setFeedback(`Correct! +${goldPerCorrect} gold`);
      await onGoldEarned(goldPerCorrect);
      const result = await progressRepo.recordAndSave(true);
      setProgress(result);
      if (result.streakMilestone) {
        onStreakMilestone?.(result.streakMilestone);
      }
      window.setTimeout(loadQuestion, 650);
    } else {
      setWrongValue(option.value);
      setFeedback('Try again');
      const result = await progressRepo.recordAndSave(false);
      setProgress(result);
      window.setTimeout(() => {
        setWrongValue(null);
        setFeedback(null);
      }, 700);
    }
  };

  const settingsStrip = (
    <div className="learning-settings-strip">
      <label className="learning-curriculum">
        Curriculum
        <select
          value={settings.curriculumId}
          onChange={(e) => {
            void onUpdateSettings({
              curriculumId: e.target.value as AppSettings['curriculumId'],
            });
          }}
        >
          {registry.list().map((curriculum) => (
            <option key={curriculum.id} value={curriculum.id}>
              {curriculum.label}
            </option>
          ))}
        </select>
      </label>
      <label className="learning-toggle">
        <input
          type="checkbox"
          checked={settings.readQuestionsAloud}
          onChange={(e) => {
            void onUpdateSettings({ readQuestionsAloud: e.target.checked });
          }}
        />
        Read aloud
      </label>
      {settings.curriculumId === 'reading' && (
        <div className="learning-reading-topics">
          <label className="learning-toggle">
            <input
              type="checkbox"
              checked={settings.reading.letterRecognition}
              onChange={(e) => {
                void onUpdateSettings({
                  reading: {
                    ...settings.reading,
                    letterRecognition: e.target.checked,
                  },
                });
              }}
            />
            Letters
          </label>
          <label className="learning-toggle">
            <input
              type="checkbox"
              checked={settings.reading.cvcWords}
              onChange={(e) => {
                void onUpdateSettings({
                  reading: {
                    ...settings.reading,
                    cvcWords: e.target.checked,
                  },
                });
              }}
            />
            CVC words
          </label>
          <label className="learning-toggle">
            <input
              type="checkbox"
              checked={settings.reading.sightWords}
              onChange={(e) => {
                void onUpdateSettings({
                  reading: {
                    ...settings.reading,
                    sightWords: e.target.checked,
                  },
                });
              }}
            />
            Sight words
          </label>
        </div>
      )}
      {progress && (
        <p className="muted learning-stats">
          Streak {progress.currentStreak} · Best {progress.bestStreak} ·{' '}
          {progress.questionsCorrect}/{progress.questionsAnswered} correct
        </p>
      )}
    </div>
  );

  const header = (
    <div className="sheet-header">
      <h2>Learning</h2>
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
      <section className="panel learning-panel">
        {header}
        <p className="muted">Let&apos;s set up reading!</p>
        <p className="muted">
          Quick Start turns on reading questions with read-aloud — perfect for
          learning letters.
        </p>
        <button type="button" className="market-buy" onClick={() => void onQuickStart()}>
          Reading Quick Start
        </button>
        <p className="muted">
          Or{' '}
          <a href={configureUrl} target="_blank" rel="noreferrer">
            open full configure
          </a>{' '}
          in Knowledge Quest for math, Portuguese, and more.
        </p>
      </section>
    );
  }

  return (
    <section className="panel question-panel learning-panel">
      <div className="sheet-header">
        <h2>Learning</h2>
        <div className="question-tools">
          {canReplay && (
            <button
              type="button"
              className="inspector-close touch-btn"
              onClick={replay}
            >
              Replay
            </button>
          )}
          <button
            type="button"
            className="inspector-close touch-btn"
            onClick={loadQuestion}
          >
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
      {settingsStrip}
      {question && (
        <>
          <p className="question-prompt" key={questionKey.current}>
            {question.prompt}
          </p>
          <QuestionOptions
            question={question}
            wrongValue={wrongValue}
            locked={locked}
            onSelect={(opt) => void onSelect(opt)}
          />
        </>
      )}
      {feedback && <p className="question-feedback">{feedback}</p>}
      <p className="muted curriculum-hint">
        Curriculum: {settings.curriculumId}
        {settings.readQuestionsAloud ? ' · read aloud on' : ''}
        {' · '}
        <a href={configureUrl} target="_blank" rel="noreferrer">
          Configure
        </a>
      </p>
    </section>
  );
}

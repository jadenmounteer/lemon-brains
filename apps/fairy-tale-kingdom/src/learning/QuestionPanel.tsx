import type { AppSettings } from '@knowledge-quest/learning';

interface QuestionPanelProps {
  settings: AppSettings;
  ready: boolean;
}

export function QuestionPanel({ settings, ready }: QuestionPanelProps) {
  return (
    <section className="panel">
      <h2>Questions</h2>
      <p className="muted">
        Phase 3 will let you answer Knowledge Quest questions here to earn gold.
      </p>
      {ready ? (
        <p>
          Ready curriculum: <strong>{settings.curriculumId}</strong>
          {settings.readQuestionsAloud ? ' (read aloud on)' : ''}
        </p>
      ) : (
        <p className="muted">Loading shared settings…</p>
      )}
    </section>
  );
}

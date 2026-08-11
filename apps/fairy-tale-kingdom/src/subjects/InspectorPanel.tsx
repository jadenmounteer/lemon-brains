import type { SubjectSnapshot } from '../game/subjects/types';

interface InspectorPanelProps {
  subject: SubjectSnapshot;
  onClose: () => void;
}

export function InspectorPanel({ subject, onClose }: InspectorPanelProps) {
  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>{subject.name}</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="inspector-role">{subject.roleLabel}</p>
      <p>
        <span className="muted">Now:</span> {subject.activityLabel}
      </p>
      <h3 className="inspector-subhead">Today’s schedule</h3>
      <ul className="schedule-list">
        {subject.scheduleSummary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

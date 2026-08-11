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
      <p className="muted">
        {subject.dayPhase} · {formatClock(subject.hour)}
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

function formatClock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:${m.toString().padStart(2, '0')}${suffix}`;
}

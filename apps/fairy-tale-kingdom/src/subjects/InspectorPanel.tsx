import type { SubjectSnapshot } from '../game/subjects/types';

interface InspectorPanelProps {
  subject: SubjectSnapshot;
  onClose: () => void;
  onTransformPeasant?: () => void;
}

export function InspectorPanel({
  subject,
  onClose,
  onTransformPeasant,
}: InspectorPanelProps) {
  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>{subject.name}</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="inspector-role">{subject.roleLabel}</p>
      <p className="muted">{subject.genderLabel}</p>
      <p>
        <span className="muted">Health</span> {subject.hp} / {subject.maxHp}
        {subject.onWall ? (
          <span className="muted"> · On the wall</span>
        ) : null}
        {subject.sick ? <span className="muted"> · Sick</span> : null}
        {subject.inspired ? (
          <span className="muted"> · Inspired!</span>
        ) : null}
        {subject.temporaryPrincess ? (
          <span className="muted"> · Ball princess</span>
        ) : null}
        {subject.married ? <span className="muted"> · Married</span> : null}
      </p>
      <p>
        <span className="muted">Hunger</span> {Math.round(subject.hunger)} / 100
      </p>
      <p>
        <span className="muted">Lives at</span> {subject.homeLabel}
      </p>
      <p>
        <span className="muted">Now:</span> {subject.activityLabel}
      </p>
      {subject.canTransformPeasant && onTransformPeasant && (
        <button
          type="button"
          className="market-buy"
          style={{ marginBottom: '0.75rem' }}
          onClick={onTransformPeasant}
        >
          Transform nearby female peasant
        </button>
      )}
      {subject.canTransformPeasant && onTransformPeasant && (
        <p className="muted">Only during a royal ball.</p>
      )}
      <h3 className="inspector-subhead">Today’s schedule</h3>
      <ul className="schedule-list">
        {subject.scheduleSummary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

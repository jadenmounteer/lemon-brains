import type { SubjectSnapshot } from '../game/subjects/types';
import { useState } from 'react';

interface InspectorPanelProps {
  subject: SubjectSnapshot;
  militaryAvailable?: number;
  onClose: () => void;
  onTransformPeasant?: () => void;
  onCommandTroops?: (troopCount: number) => void;
  /** When true, show a compact follow bar instead of the full sheet. */
  collapsed?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}

export function InspectorPanel({
  subject,
  militaryAvailable = 0,
  onClose,
  onTransformPeasant,
  onCommandTroops,
  collapsed = false,
  onExpand,
  onCollapse,
}: InspectorPanelProps) {
  const [troopCount, setTroopCount] = useState(3);

  const canToggle = Boolean(onExpand || onCollapse);

  const actions = (
    <div className="inspector-follow-actions">
      {canToggle && (
        <button
          type="button"
          className="inspector-close touch-btn"
          aria-expanded={!collapsed}
          onClick={() => {
            if (collapsed) onExpand?.();
            else onCollapse?.();
          }}
        >
          {collapsed ? 'Details' : 'Hide'}
        </button>
      )}
      <button
        type="button"
        className="inspector-close touch-btn"
        onClick={onClose}
      >
        Unfollow
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <section
        className="panel inspector-panel inspector-collapsed"
        aria-live="polite"
      >
        <div className="inspector-follow-bar">
          <div className="inspector-follow-meta">
            <h2>{subject.name}</h2>
            <p className="muted">
              {subject.roleLabel}
              {subject.activityLabel ? ` · ${subject.activityLabel}` : ''}
            </p>
          </div>
          {actions}
        </div>
      </section>
    );
  }

  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>{subject.name}</h2>
        {actions}
      </div>
      <p className="inspector-role">{subject.roleLabel}</p>
      <p className="muted">{subject.genderLabel}</p>
      {subject.titleLabel ? (
        <p className="muted">{subject.titleLabel}</p>
      ) : null}
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
      {typeof subject.happiness === 'number' && (
        <p>
          <span className="muted">Happiness</span>{' '}
          {Math.round(subject.happiness)} / 100
        </p>
      )}
      {typeof subject.ageYears === 'number' && (
        <p>
          <span className="muted">Age</span> {Math.round(subject.ageYears)}
          {subject.body ? (
            <span className="muted"> · {subject.body}</span>
          ) : null}
        </p>
      )}
      {subject.jobLabel ? (
        <p>
          <span className="muted">Job</span> {subject.jobLabel}
        </p>
      ) : null}
      <p>
        <span className="muted">Works at</span>{' '}
        {subject.workplaceLabel ?? 'No assigned workplace'}
      </p>
      {subject.roomLabel ? (
        <p>
          <span className="muted">At</span> {subject.roomLabel}
        </p>
      ) : null}
      <p>
        <span className="muted">Lives at</span> {subject.homeLabel}
      </p>
      <p>
        <span className="muted">Now:</span> {subject.activityLabel}
      </p>
      {subject.thought ? (
        <p>
          <span className="muted">Thinking</span> “{subject.thought}”
        </p>
      ) : null}
      {subject.goalLabel ? (
        <p>
          <span className="muted">Goal</span> {subject.goalLabel}
        </p>
      ) : null}
      {subject.lineageLabel ? (
        <p>
          <span className="muted">Lineage</span> {subject.lineageLabel}
        </p>
      ) : null}
      {subject.spouseLabel ? (
        <p>
          <span className="muted">Spouse</span> {subject.spouseLabel}
        </p>
      ) : null}
      {subject.pregnantLabel ? (
        <p>
          <span className="muted">Expecting</span> {subject.pregnantLabel}
        </p>
      ) : null}
      {subject.backstory ? (
        <p className="muted">{subject.backstory}</p>
      ) : null}
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
      {subject.canCommandTroops && onCommandTroops && (
        <div style={{ marginBottom: '0.75rem' }}>
          <p className="muted">
            Command guards &amp; archers ({militaryAvailable} free)
          </p>
          <label className="muted" htmlFor="troop-count">
            Troop count
          </label>
          <input
            id="troop-count"
            type="number"
            min={1}
            max={Math.max(1, militaryAvailable || 12)}
            value={troopCount}
            onChange={(e) =>
              setTroopCount(Math.max(1, Number(e.target.value) || 1))
            }
            style={{ width: '4rem', marginLeft: '0.5rem' }}
          />
          <button
            type="button"
            className="market-buy"
            style={{ display: 'block', marginTop: '0.5rem' }}
            disabled={militaryAvailable <= 0}
            onClick={() => onCommandTroops(troopCount)}
          >
            Attack nearest encampment
          </button>
        </div>
      )}
      {subject.lifeLog && subject.lifeLog.length > 0 && (
        <>
          <h3 className="inspector-subhead">Life log</h3>
          <ul className="schedule-list">
            {[...subject.lifeLog].reverse().slice(0, 8).map((entry, i) => (
              <li key={`${entry.day}-${i}`}>
                Day {entry.day}: {entry.text}
              </li>
            ))}
          </ul>
        </>
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

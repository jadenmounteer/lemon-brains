import { useMemo } from 'react';
import type { SubjectSnapshot, KingdomStats } from '../game/subjects/types';
import type { UnitRole } from '../game/art/assetManifest';
import {
  evaluateCareerAspiration,
  type CareerAspirationView,
} from '../game/career/evaluateAspiration';
import { isFamilyGoalKind } from '../game/family/familyGoals';
import type { FamilyAspirationSnapshot } from '../game/subjects/types';
import { useState } from 'react';

interface InspectorPanelProps {
  subject: SubjectSnapshot;
  stats: KingdomStats;
  gold: number;
  infiniteGold?: boolean;
  militaryAvailable?: number;
  onClose: () => void;
  onTransformPeasant?: () => void;
  onCommandTroops?: (troopCount: number) => void;
  onPromoteCareer?: (targetRole: UnitRole, cost: number) => void;
  onGrantMarriage?: () => void;
  onGrantChild?: () => void;
  collapsed?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}

function buildAspirationInput(stats: KingdomStats): Parameters<
  typeof evaluateCareerAspiration
>[1] {
  return {
    hasDungeon: stats.hasDungeon,
    hasBarracks: stats.hasBarracks,
    hasCathedral: stats.hasCathedral,
    hasInfirmary: stats.hasInfirmary,
    hasGallows: stats.hasGallows,
    tavernCount: stats.tavernCount,
    roleCounts: {
      guard: stats.militaryAvailable,
      bishop: stats.hasBishop ? 1 : 0,
      executioner: stats.hasExecutioner ? 1 : 0,
    },
  };
}

function FamilyAspirationSection({
  aspiration,
  onGrant,
  grantLabel,
}: {
  aspiration: FamilyAspirationSnapshot;
  onGrant?: () => void;
  grantLabel: string;
}) {
  return (
    <div className="inspector-aspiration">
      <h3 className="inspector-subhead">Family aspiration</h3>
      <p>{aspiration.title}</p>
      {aspiration.partnerName ? (
        <p className="muted">With {aspiration.partnerName}</p>
      ) : null}
      <h4 className="inspector-subhead">Requirements</h4>
      <ul className="schedule-list">
        {aspiration.criteria.map((c) => (
          <li key={c.id}>
            {c.met ? '✓' : '✗'} {c.label}
          </li>
        ))}
      </ul>
      {onGrant && (
        <button
          type="button"
          className="market-buy"
          style={{ marginTop: '0.75rem' }}
          disabled={!aspiration.canGrant}
          title={aspiration.blockReason}
          onClick={onGrant}
        >
          {grantLabel}
          {aspiration.cost > 0 ? ` — ${aspiration.cost}g` : ''}
        </button>
      )}
      {!aspiration.canGrant && aspiration.blockReason && (
        <p className="muted">{aspiration.blockReason}</p>
      )}
    </div>
  );
}

function AspirationSection({
  aspiration,
  onPromote,
}: {
  aspiration: CareerAspirationView;
  onPromote?: () => void;
}) {
  return (
    <div className="inspector-aspiration">
      <h3 className="inspector-subhead">Aspiration</h3>
      <p>Wants to become {aspiration.targetLabel}</p>
      <h4 className="inspector-subhead">Requirements</h4>
      <ul className="schedule-list">
        {aspiration.criteria.map((c) => (
          <li key={c.id}>
            {c.met ? '✓' : '✗'} {c.label}
          </li>
        ))}
      </ul>
      {onPromote && (
        <button
          type="button"
          className="market-buy"
          style={{ marginTop: '0.75rem' }}
          disabled={!aspiration.canPromote}
          title={aspiration.blockReason}
          onClick={onPromote}
        >
          Grant wish — {aspiration.cost}g
        </button>
      )}
      {!aspiration.canPromote && aspiration.blockReason && (
        <p className="muted">{aspiration.blockReason}</p>
      )}
    </div>
  );
}

export function InspectorPanel({
  subject,
  stats,
  gold,
  infiniteGold = false,
  militaryAvailable = 0,
  onClose,
  onTransformPeasant,
  onCommandTroops,
  onPromoteCareer,
  onGrantMarriage,
  onGrantChild,
  collapsed = false,
  onExpand,
  onCollapse,
}: InspectorPanelProps) {
  const [troopCount, setTroopCount] = useState(3);

  const aspiration = useMemo(() => {
    if (!subject.goal || isFamilyGoalKind(subject.goal.kind)) return null;
    return evaluateCareerAspiration(
      { role: subject.role, goal: subject.goal },
      buildAspirationInput(stats),
      { royaltyUnlocked: stats.royaltyUnlocked },
      gold,
      infiniteGold
    );
  }, [subject.role, subject.goal, stats, gold, infiniteGold]);

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
      {subject.loyaltyLabel ? (
        <p>
          <span className="muted">Loyalty</span> {subject.loyaltyLabel}
        </p>
      ) : null}
      <p>
        <span className="muted">Now:</span> {subject.activityLabel}
      </p>
      {subject.thought ? (
        <p>
          <span className="muted">Thinking</span> “{subject.thought}”
        </p>
      ) : null}
      {subject.familyAspiration ? (
        <FamilyAspirationSection
          aspiration={subject.familyAspiration}
          grantLabel={
            subject.familyAspiration.kind === 'marry'
              ? 'Grant marriage'
              : 'Grant child'
          }
          onGrant={
            subject.familyAspiration.kind === 'marry'
              ? onGrantMarriage
              : subject.familyAspiration.kind === 'have_child'
                ? onGrantChild
                : undefined
          }
        />
      ) : aspiration ? (
        <AspirationSection
          aspiration={aspiration}
          onPromote={
            onPromoteCareer
              ? () => onPromoteCareer(aspiration.targetRole, aspiration.cost)
              : undefined
          }
        />
      ) : subject.goalLabel ? (
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
            Command soldiers, guards &amp; archers ({militaryAvailable} free)
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

import type { KingdomFeedItem } from './useKingdomEventFeed';

interface KingdomEventsRailProps {
  pinned: KingdomFeedItem[];
  recent: KingdomFeedItem[];
  criticalCount: number;
  warnCount: number;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onFocusEvent: (item: KingdomFeedItem) => void;
  onDismissPinned: (id: string) => void;
}

function severityLabel(s: string): string {
  switch (s) {
    case 'critical':
      return 'Threat';
    case 'warn':
      return 'Watch';
    case 'joy':
      return 'Joy';
    default:
      return 'Note';
  }
}

/** Persistent tension feed — Active (pinned) + Recent. */
export function KingdomEventsRail({
  pinned,
  recent,
  criticalCount,
  warnCount,
  mobileOpen,
  onMobileOpenChange,
  onFocusEvent,
  onDismissPinned,
}: KingdomEventsRailProps) {
  const chipLabel =
    criticalCount > 0
      ? `Threat · ${criticalCount}`
      : warnCount > 0
        ? `Watch · ${warnCount}`
        : pinned.length + recent.length > 0
          ? 'Events'
          : 'All quiet';

  const body = (
    <div className="kingdom-events-body">
      {pinned.length > 0 && (
        <section className="kingdom-events-section">
          <h3>Active</h3>
          <ul>
            {pinned.map((e) => (
              <li key={`${e.id}-${e.at}`} className={`event-item severity-${e.severity}`}>
                <button
                  type="button"
                  className="event-item-main"
                  onClick={() => onFocusEvent(e)}
                >
                  <span className="event-sev">{severityLabel(e.severity)}</span>
                  <span className="event-title">{e.title}</span>
                  {e.detail ? <span className="event-detail">{e.detail}</span> : null}
                </button>
                <button
                  type="button"
                  className="event-dismiss"
                  aria-label="Dismiss"
                  onClick={() => onDismissPinned(e.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recent.length > 0 && (
        <section className="kingdom-events-section">
          <h3>Recent</h3>
          <ul>
            {recent.map((e) => (
              <li key={`${e.id}-${e.at}`} className={`event-item severity-${e.severity}`}>
                <button
                  type="button"
                  className="event-item-main"
                  onClick={() => onFocusEvent(e)}
                >
                  <span className="event-sev">{severityLabel(e.severity)}</span>
                  <span className="event-title">{e.title}</span>
                  {e.detail ? <span className="event-detail">{e.detail}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pinned.length === 0 && recent.length === 0 && (
        <p className="kingdom-events-empty muted">The realm is quiet… for now.</p>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={`kingdom-events-chip touch-btn${criticalCount ? ' is-critical' : warnCount ? ' is-warn' : ''}`}
        aria-expanded={mobileOpen}
        onClick={() => onMobileOpenChange(!mobileOpen)}
      >
        {chipLabel}
      </button>
      <aside
        className={`kingdom-events-rail${mobileOpen ? ' is-open' : ''}`}
        aria-label="Kingdom events"
      >
        <header className="kingdom-events-header">
          <h2>Kingdom events</h2>
          <button
            type="button"
            className="sheet-close kingdom-events-close-mobile"
            aria-label="Close events"
            onClick={() => onMobileOpenChange(false)}
          >
            Close
          </button>
        </header>
        {body}
      </aside>
    </>
  );
}

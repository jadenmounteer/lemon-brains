interface OpeningGuideCardProps {
  kingdomName: string;
  onEarnGold: () => void;
  onDismiss: () => void;
}

/** Compact first-session welcome — answer-first, not a wall of text. */
export function OpeningGuideCard({
  kingdomName,
  onEarnGold,
  onDismiss,
}: OpeningGuideCardProps) {
  return (
    <div className="modal-backdrop opening-guide-backdrop" role="dialog" aria-modal="true">
      <section className="panel modal-card opening-guide-card">
        <h2>Welcome to {kingdomName || 'your kingdom'}</h2>
        <p className="muted opening-guide-lead">
          Rule by learning. Answer reading questions for gold, then grow and defend
          the realm.
        </p>
        <ol className="opening-guide-steps">
          <li>
            <strong>Answer questions</strong> — fill the treasury
          </li>
          <li>
            <strong>Feed the realm</strong> — granary, then fields
          </li>
          <li>
            <strong>Guard the keep</strong> — walls before the raids grow
          </li>
        </ol>
        <div className="menu-form-actions opening-guide-actions">
          <button type="button" className="menu-secondary" onClick={onDismiss}>
            Explore first
          </button>
          <button type="button" className="menu-action" onClick={onEarnGold}>
            Earn gold
          </button>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { PlayingManualPanel } from './PlayingManualPanel';

interface KingdomMenuProps {
  kingdomName: string;
  daysPlayed: number;
  onStartNewKingdom: (name: string) => void | Promise<void>;
  forceOpen?: boolean;
  forceTitle?: string;
  infiniteGold?: boolean;
  onToggleInfiniteGold?: (on: boolean) => void;
}

export function KingdomMenu({
  kingdomName,
  daysPlayed,
  onStartNewKingdom,
  forceOpen = false,
  forceTitle,
  infiniteGold = false,
  onToggleInfiniteGold,
}: KingdomMenuProps) {
  const [open, setOpen] = useState(forceOpen);
  const [showNewForm, setShowNewForm] = useState(forceOpen);
  const [showManual, setShowManual] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setShowNewForm(true);
    }
  }, [forceOpen]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onStartNewKingdom(trimmed);
      setName('');
      setShowNewForm(false);
      if (!forceOpen) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kingdom-menu">
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-label="Kingdom menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hamburger" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <div className="menu-dropdown panel">
          <p className="menu-kingdom-name">{kingdomName || 'Unnamed kingdom'}</p>
          <p className="muted">Day {daysPlayed}</p>
          {!showNewForm ? (
            <>
              <button
                type="button"
                className="menu-action"
                onClick={() => {
                  setShowManual(true);
                  setOpen(false);
                }}
              >
                Playing manual
              </button>
              <button
                type="button"
                className="menu-action"
                onClick={() => {
                  setShowNewForm(true);
                  setName('');
                }}
              >
                Start new kingdom
              </button>
              {onToggleInfiniteGold && (
                <button
                  type="button"
                  className="menu-action"
                  aria-pressed={infiniteGold}
                  onClick={() => onToggleInfiniteGold(!infiniteGold)}
                >
                  {infiniteGold
                    ? 'Cheat: infinite gold ON'
                    : 'Cheat: infinite gold'}
                </button>
              )}
            </>
          ) : (
            <form
              className="new-kingdom-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <h3>{forceTitle ?? 'Name your kingdom'}</h3>
              <p className="muted">
                Starting fresh resets gold, days, buildings, and generates a new
                random map. Raids begin again.
              </p>
              <label className="sr-only" htmlFor="kingdom-name-input">
                Kingdom name
              </label>
              <input
                id="kingdom-name-input"
                type="text"
                maxLength={32}
                placeholder="e.g. Briarhold"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              <div className="menu-form-actions">
                {!forceOpen && (
                  <button
                    type="button"
                    className="inspector-close"
                    onClick={() => setShowNewForm(false)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="menu-action"
                  disabled={!name.trim() || busy}
                >
                  {busy ? 'Starting…' : 'Begin'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {showManual && (
        <PlayingManualPanel onClose={() => setShowManual(false)} />
      )}
    </div>
  );
}

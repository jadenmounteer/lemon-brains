import { useEffect, useState } from 'react';
import { PlayingManualPanel } from './PlayingManualPanel';
import { SandboxSettingsPanel } from './SandboxSettingsPanel';
import type { SandboxSettings, SandboxSpawnAction } from './sandboxSettings';

interface KingdomMenuProps {
  kingdomName: string;
  daysPlayed: number;
  onStartNewKingdom: (name: string) => void | Promise<void>;
  forceOpen?: boolean;
  forceTitle?: string;
  infiniteGold?: boolean;
  onToggleInfiniteGold?: (on: boolean) => void;
  showCareerTodos?: boolean;
  onToggleShowCareerTodos?: (on: boolean) => void;
  sandboxSettings?: SandboxSettings;
  onSandboxSettingsChange?: (next: SandboxSettings) => void;
  onSandboxSettingsReset?: () => void;
  onSandboxSpawn?: (action: SandboxSpawnAction) => void;
  /** Controlled open (App closes menu when Market opens). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Mobile menu extras — secondary HUD actions */
  knowledgeQuestUrl?: string;
  captiveCount?: number;
  showRansomOpen?: boolean;
  onOpenQuestions?: () => void;
  onOpenRansom?: () => void;
  onOverlayChange?: (open: boolean) => void;
}

export function KingdomMenu({
  kingdomName,
  daysPlayed,
  onStartNewKingdom,
  forceOpen = false,
  forceTitle,
  infiniteGold = false,
  onToggleInfiniteGold,
  showCareerTodos = true,
  onToggleShowCareerTodos,
  sandboxSettings,
  onSandboxSettingsChange,
  onSandboxSettingsReset,
  onSandboxSpawn,
  open: openProp,
  onOpenChange,
  knowledgeQuestUrl,
  captiveCount = 0,
  showRansomOpen = false,
  onOpenQuestions,
  onOpenRansom,
  onOverlayChange,
}: KingdomMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(forceOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) onOpenChange(value);
    else setUncontrolledOpen(value);
  };

  const [showNewForm, setShowNewForm] = useState(forceOpen);
  const [showManual, setShowManual] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setShowNewForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to forceOpen
  }, [forceOpen]);

  useEffect(() => {
    onOverlayChange?.(showManual || showSandbox);
  }, [showManual, showSandbox, onOverlayChange]);

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

  const closeMenu = () => {
    if (!forceOpen) setOpen(false);
  };

  return (
    <div className="kingdom-menu">
      <button
        type="button"
        className="menu-toggle touch-btn"
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
        <>
          <button
            type="button"
            className="sheet-scrim menu-scrim"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div className="menu-dropdown panel sheet-panel" role="dialog">
            <div className="sheet-header">
              <div>
                <p className="menu-kingdom-name">
                  {kingdomName || 'Unnamed kingdom'}
                </p>
                <p className="muted">Day {daysPlayed}</p>
              </div>
              {!forceOpen && (
                <button
                  type="button"
                  className="inspector-close touch-btn"
                  onClick={closeMenu}
                >
                  Close
                </button>
              )}
            </div>
            <div className="sheet-body">
              {!showNewForm ? (
                <>
                  <div className="menu-mobile-extras">
                    {onOpenQuestions && (
                      <button
                        type="button"
                        className="menu-action"
                        onClick={() => {
                          onOpenQuestions();
                          closeMenu();
                        }}
                      >
                        Questions
                      </button>
                    )}
                    {onOpenRansom && (captiveCount > 0 || showRansomOpen) && (
                      <button
                        type="button"
                        className="menu-action"
                        onClick={() => {
                          onOpenRansom();
                          closeMenu();
                        }}
                      >
                        {showRansomOpen
                          ? 'Hide ransom'
                          : `Ransom (${captiveCount})`}
                      </button>
                    )}
                    {knowledgeQuestUrl && (
                      <a className="menu-action menu-link" href={knowledgeQuestUrl}>
                        Knowledge Quest
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="menu-action"
                    onClick={() => {
                      setShowManual(true);
                      closeMenu();
                    }}
                  >
                    Playing manual
                  </button>
                  {sandboxSettings &&
                    onSandboxSettingsChange &&
                    onSandboxSettingsReset && (
                      <button
                        type="button"
                        className="menu-action"
                        onClick={() => {
                          setShowSandbox(true);
                          closeMenu();
                        }}
                      >
                        Sandbox settings…
                      </button>
                    )}
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
                  {onToggleShowCareerTodos && (
                    <button
                      type="button"
                      className="menu-action"
                      aria-pressed={showCareerTodos}
                      onClick={() => onToggleShowCareerTodos(!showCareerTodos)}
                    >
                      {showCareerTodos
                        ? 'Career wishes: shown'
                        : 'Career wishes: hidden'}
                    </button>
                  )}
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
                    Starting fresh resets gold, days, buildings, and generates a
                    new random map. Raids begin again.
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
                        className="inspector-close touch-btn"
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
          </div>
        </>
      )}
      {showManual && (
        <PlayingManualPanel onClose={() => setShowManual(false)} />
      )}
      {showSandbox &&
        sandboxSettings &&
        onSandboxSettingsChange &&
        onSandboxSettingsReset && (
          <SandboxSettingsPanel
            settings={sandboxSettings}
            onChange={onSandboxSettingsChange}
            onReset={onSandboxSettingsReset}
            onClose={() => setShowSandbox(false)}
            onSpawn={onSandboxSpawn}
          />
        )}
    </div>
  );
}

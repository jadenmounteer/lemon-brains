import { useCallback, useState } from 'react';
import { config } from './config';
import { PhaserGame } from './game/PhaserGame';
import type {
  GameOverPayload,
  GoldStolenPayload,
  RaidWarningPayload,
} from './game/subjects/events';
import type { DaySnapshot, SubjectSnapshot } from './game/subjects/types';
import { GameOverModal } from './kingdom/GameOverModal';
import { KingdomMenu } from './kingdom/KingdomMenu';
import { useKingdom } from './kingdom/useKingdom';
import { QuestionPanel } from './learning/QuestionPanel';
import { useGold } from './learning/useGold';
import { useSettings } from './learning/useSettings';
import { MarketplacePanel } from './marketplace/MarketplacePanel';
import { InspectorPanel } from './subjects/InspectorPanel';
import { formatClock } from './utils/formatClock';

export default function App() {
  const { settings, ready } = useSettings();
  const { gold, earnCorrectAnswer, resetGold, stealGold } = useGold();
  const { kingdom, ready: kingdomReady, needsSetup, startNewKingdom, incrementDay } =
    useKingdom();
  const [showQuestions, setShowQuestions] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [selected, setSelected] = useState<SubjectSnapshot | null>(null);
  const [day, setDay] = useState<DaySnapshot>({
    dayPhase: 'Night',
    hour: 0,
  });
  const [deselectToken, setDeselectToken] = useState(0);
  const [remountKey, setRemountKey] = useState(0);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [namingAfterLoss, setNamingAfterLoss] = useState(false);

  const showSide =
    showQuestions || showMarket || selected !== null;

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const handleNewKingdom = useCallback(
    async (name: string) => {
      await startNewKingdom(name);
      await resetGold();
      setGameOver(null);
      setNamingAfterLoss(false);
      setSelected(null);
      setRemountKey((n) => n + 1);
    },
    [resetGold, startNewKingdom]
  );

  const showSidePanels = kingdomReady && !needsSetup && !namingAfterLoss;

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <h1 aria-live="polite">
            {day.dayPhase} · {formatClock(day.hour)}
          </h1>
          <p className="tagline">
            {kingdom.name
              ? `${kingdom.name} · Day ${kingdom.daysPlayed}`
              : 'Name your kingdom to begin'}
          </p>
        </div>
        <div className="hud-actions">
          <div className="gold" aria-live="polite">
            Gold: <strong>{gold}</strong>
          </div>
          {showSidePanels && (
            <>
              <button type="button" onClick={() => setShowQuestions((v) => !v)}>
                {showQuestions ? 'Hide questions' : 'Questions'}
              </button>
              <button type="button" onClick={() => setShowMarket((v) => !v)}>
                {showMarket ? 'Hide market' : 'Marketplace'}
              </button>
            </>
          )}
          <a className="back" href={config.hostUrl}>
            Knowledge Quest
          </a>
          {kingdomReady && (
            <KingdomMenu
              kingdomName={kingdom.name}
              daysPlayed={kingdom.daysPlayed}
              forceOpen={needsSetup || namingAfterLoss}
              forceTitle={
                namingAfterLoss
                  ? 'Found a new kingdom'
                  : needsSetup
                    ? 'Name your kingdom'
                    : undefined
              }
              onStartNewKingdom={handleNewKingdom}
            />
          )}
        </div>
      </header>

      <main className="stage">
        {kingdomReady && !needsSetup && (
          <PhaserGame
            remountKey={remountKey}
            onSubjectSelected={setSelected}
            onDayTick={setDay}
            onDayRolled={() => {
              void incrementDay();
            }}
            onGoldStolen={(payload: GoldStolenPayload) => {
              void stealGold(payload.amount).then((left) => {
                flash(
                  `${payload.label} reached the keep and stole ${payload.amount} gold (${left} left)`
                );
              });
            }}
            onGameOver={(payload) => {
              setGameOver(payload);
            }}
            onRaidWarning={(payload: RaidWarningPayload) => {
              flash(
                payload.kind === 'enemy_army'
                  ? `Warning: ${payload.label} approaches!`
                  : `${payload.label} are raiding!`
              );
            }}
            deselectToken={deselectToken}
          />
        )}

        {toast && <div className="toast">{toast}</div>}

        {gameOver && (
          <GameOverModal
            reason={gameOver.reason}
            onNewKingdom={() => {
              setGameOver(null);
              setNamingAfterLoss(true);
            }}
          />
        )}

        {showSidePanels && showSide && (
          <aside className="side-panels">
            {selected && (
              <InspectorPanel
                subject={selected}
                onClose={() => {
                  setSelected(null);
                  setDeselectToken((n) => n + 1);
                }}
              />
            )}
            {showQuestions && (
              <QuestionPanel
                settings={settings}
                ready={ready}
                onGoldEarned={earnCorrectAnswer}
              />
            )}
            {showMarket && <MarketplacePanel />}
          </aside>
        )}
      </main>
    </div>
  );
}

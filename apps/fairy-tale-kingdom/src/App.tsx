import { useState } from 'react';
import { config } from './config';
import { PhaserGame } from './game/PhaserGame';
import type { DaySnapshot, SubjectSnapshot } from './game/subjects/types';
import { QuestionPanel } from './learning/QuestionPanel';
import { useSettings } from './learning/useSettings';
import { MarketplacePanel } from './marketplace/MarketplacePanel';
import { InspectorPanel } from './subjects/InspectorPanel';

export default function App() {
  const { settings, ready } = useSettings();
  const [gold] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [selected, setSelected] = useState<SubjectSnapshot | null>(null);
  const [day, setDay] = useState<DaySnapshot>({
    dayPhase: 'Night',
    hour: 0,
  });
  const [deselectToken, setDeselectToken] = useState(0);

  const showSide =
    showQuestions || showMarket || selected !== null;

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <h1>Fairy Tale Kingdom</h1>
          <p className="tagline">A watchable kingdom — learn, earn, grow</p>
        </div>
        <div className="hud-actions">
          <div className="day-phase" aria-live="polite">
            {day.dayPhase}
          </div>
          <div className="gold" aria-live="polite">
            Gold: <strong>{gold}</strong>
          </div>
          <button type="button" onClick={() => setShowQuestions((v) => !v)}>
            {showQuestions ? 'Hide questions' : 'Questions'}
          </button>
          <button type="button" onClick={() => setShowMarket((v) => !v)}>
            {showMarket ? 'Hide market' : 'Marketplace'}
          </button>
          <a className="back" href={config.hostUrl}>
            Knowledge Quest
          </a>
        </div>
      </header>

      <main className="stage">
        <PhaserGame
          onSubjectSelected={setSelected}
          onDayTick={setDay}
          deselectToken={deselectToken}
        />
        {showSide && (
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
              <QuestionPanel settings={settings} ready={ready} />
            )}
            {showMarket && <MarketplacePanel />}
          </aside>
        )}
      </main>
    </div>
  );
}

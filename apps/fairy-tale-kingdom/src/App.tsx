import { useState } from 'react';
import { config } from './config';
import { PhaserGame } from './game/PhaserGame';
import { QuestionPanel } from './learning/QuestionPanel';
import { useSettings } from './learning/useSettings';
import { MarketplacePanel } from './marketplace/MarketplacePanel';

export default function App() {
  const { settings, ready } = useSettings();
  const [gold] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showMarket, setShowMarket] = useState(false);

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <h1>Fairy Tale Kingdom</h1>
          <p className="tagline">A watchable kingdom — learn, earn, grow</p>
        </div>
        <div className="hud-actions">
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
        <PhaserGame />
        {(showQuestions || showMarket) && (
          <aside className="side-panels">
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

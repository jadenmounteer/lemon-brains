interface GameOverModalProps {
  reason: string;
  onNewKingdom: () => void;
}

export function GameOverModal({ reason, onNewKingdom }: GameOverModalProps) {
  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true">
      <section className="panel modal-card">
        <h2>Keep captured</h2>
        <p>{reason}</p>
        <p className="muted">
          Bandits and giants only steal gold — a rival army ending at your keep
          ends the game.
        </p>
        <button type="button" className="menu-action" onClick={onNewKingdom}>
          Start a new kingdom
        </button>
      </section>
    </div>
  );
}

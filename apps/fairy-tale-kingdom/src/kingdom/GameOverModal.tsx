interface GameOverModalProps {
  reason: string;
  onNewKingdom: () => void;
}

export function GameOverModal({ reason, onNewKingdom }: GameOverModalProps) {
  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true">
      <section className="panel modal-card">
        <h2>Kingdom fallen</h2>
        <p>{reason}</p>
        <p className="muted">
          Bandits and giants only steal gold — a rival army must destroy every
          keep (0 HP) to conquer the kingdom.
        </p>
        <button type="button" className="menu-action" onClick={onNewKingdom}>
          Start a new kingdom
        </button>
      </section>
    </div>
  );
}

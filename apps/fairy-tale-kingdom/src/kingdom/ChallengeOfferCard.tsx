import type { RealmChallenge } from './challenges';

interface ChallengeOfferCardProps {
  challenge: RealmChallenge;
  onAccept: () => void;
  onDismiss: () => void;
}

/** Compact challenge offer — walkthrough + gold reward, not a wall of text. */
export function ChallengeOfferCard({
  challenge,
  onAccept,
  onDismiss,
}: ChallengeOfferCardProps) {
  return (
    <div
      className="modal-backdrop opening-guide-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <section className="panel modal-card opening-guide-card">
        <h2>{challenge.title}</h2>
        <p className="muted opening-guide-lead">{challenge.detail}</p>
        <p className="learning-reward-chip" style={{ display: 'inline-flex' }}>
          Reward +{challenge.rewardGold} gold
        </p>
        <div className="menu-form-actions opening-guide-actions">
          <button type="button" className="menu-secondary" onClick={onDismiss}>
            Later
          </button>
          <button type="button" className="menu-action" onClick={onAccept}>
            Accept challenge
          </button>
        </div>
      </section>
    </div>
  );
}

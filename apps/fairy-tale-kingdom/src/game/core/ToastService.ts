import { KingdomEvents } from '../subjects/events';

export interface MarketToastPayload {
  message: string;
  kind?: 'info' | 'success' | 'warn' | 'error';
}

/** Thin wrapper for kingdom toast events. */
export class ToastService {
  constructor(private readonly game: Phaser.Game) {}

  show(message: string, kind: MarketToastPayload['kind'] = 'info'): void {
    this.game.events.emit(KingdomEvents.MARKET_TOAST, { message, kind });
  }
}

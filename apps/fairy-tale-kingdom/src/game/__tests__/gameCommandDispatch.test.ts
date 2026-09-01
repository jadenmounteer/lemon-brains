import { describe, expect, it, vi } from 'vitest';
import { KingdomEvents } from '../subjects/events';
import { dispatchGameCommand } from '../gameCommandDispatch';
import type { GameCommand } from '../GameCommand';

function mockGame() {
  const emit = vi.fn();
  return { events: { emit } };
}

describe('dispatchGameCommand', () => {
  it('maps HIRE_SUBJECT to KingdomEvents.HIRE_SUBJECT', () => {
    const game = mockGame();
    const cmd: GameCommand = { type: 'HIRE_SUBJECT', seq: 1, role: 'guard' };
    dispatchGameCommand(game as never, cmd);
    expect(game.events.emit).toHaveBeenCalledWith(KingdomEvents.HIRE_SUBJECT, {
      role: 'guard',
    });
  });

  it('maps TRAIN_AT_BUILDING', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'TRAIN_AT_BUILDING',
      seq: 2,
      buildingId: 'house-1',
      role: 'peasant',
    });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.TRAIN_AT_BUILDING,
      { buildingId: 'house-1', role: 'peasant' }
    );
  });

  it('maps PROMOTE_CAREER to CAREER_HIRE', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'PROMOTE_CAREER',
      seq: 3,
      subjectId: 's1',
      targetRole: 'executioner',
    });
    expect(game.events.emit).toHaveBeenCalledWith(KingdomEvents.CAREER_HIRE, {
      subjectId: 's1',
      targetRole: 'executioner',
    });
  });

  it('maps CLEAR_SELECTION', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, { type: 'CLEAR_SELECTION', seq: 4 });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.CLEAR_SELECTION
    );
  });

  it('maps CAMERA_ZOOM', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'CAMERA_ZOOM',
      seq: 5,
      direction: 1,
    });
    expect(game.events.emit).toHaveBeenCalledWith(KingdomEvents.CAMERA_ZOOM, {
      direction: 1,
    });
  });

  it('maps BEGIN_PLACE', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'BEGIN_PLACE',
      seq: 6,
      kind: 'house',
      maxWallCells: 10,
    });
    expect(game.events.emit).toHaveBeenCalledWith(KingdomEvents.BEGIN_PLACE, {
      kind: 'house',
      maxWallCells: 10,
    });
  });

  it('maps BEGIN_RELOCATE', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'BEGIN_RELOCATE',
      seq: 7,
      buildingId: 'house-0',
    });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.BEGIN_RELOCATE,
      { buildingId: 'house-0' }
    );
  });

  it('maps DEMOLISH_BUILDING', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'DEMOLISH_BUILDING',
      seq: 8,
      buildingId: 'bakery-0',
    });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.DEMOLISH_BUILDING,
      { buildingId: 'bakery-0' }
    );
  });
});

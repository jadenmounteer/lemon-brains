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

  it('maps COMMAND_DETACHMENT with optional targetId', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'COMMAND_DETACHMENT',
      seq: 9,
      generalId: 'gen-1',
      troopCount: 4,
      targetId: 'camp-2',
    });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.COMMAND_DETACHMENT,
      {
        generalId: 'gen-1',
        troopCount: 4,
        targetId: 'camp-2',
      }
    );
  });

  it('maps COMMAND_KNIGHT_HUNT', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'COMMAND_KNIGHT_HUNT',
      seq: 11,
      knightId: 'k1',
      monsterId: 'm1',
    });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.COMMAND_KNIGHT_HUNT,
      { knightId: 'k1', monsterId: 'm1' }
    );
  });

  it('maps COMMAND_DETACHMENT with monster targetId', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'COMMAND_DETACHMENT',
      seq: 12,
      generalId: 'gen-1',
      troopCount: 3,
      targetId: 'monster:m9',
    });
    expect(game.events.emit).toHaveBeenCalledWith(
      KingdomEvents.COMMAND_DETACHMENT,
      {
        generalId: 'gen-1',
        troopCount: 3,
        targetId: 'monster:m9',
      }
    );
  });

  it('maps DESTROY_CAMP', () => {
    const game = mockGame();
    dispatchGameCommand(game as never, {
      type: 'DESTROY_CAMP',
      seq: 10,
      campId: 'camp-3',
    });
    expect(game.events.emit).toHaveBeenCalledWith(KingdomEvents.DESTROY_CAMP, {
      campId: 'camp-3',
    });
  });
});

import type Phaser from 'phaser';
import { KingdomEvents } from './subjects/events';
import type { GameCommand } from './GameCommand';

/** Emit the Phaser event for a React-originated GameCommand. */
export function dispatchGameCommand(
  game: Phaser.Game,
  command: GameCommand
): void {
  switch (command.type) {
    case 'HIRE_SUBJECT':
      game.events.emit(KingdomEvents.HIRE_SUBJECT, { role: command.role });
      break;
    case 'TRAIN_AT_BUILDING':
      game.events.emit(KingdomEvents.TRAIN_AT_BUILDING, {
        buildingId: command.buildingId,
        role: command.role,
      });
      break;
    case 'BEGIN_PLACE':
      game.events.emit(KingdomEvents.BEGIN_PLACE, {
        kind: command.kind,
        maxWallCells: command.maxWallCells,
      });
      break;
    case 'CANCEL_PLACE':
      game.events.emit(KingdomEvents.CANCEL_PLACE);
      break;
    case 'BEGIN_RELOCATE':
      game.events.emit(KingdomEvents.BEGIN_RELOCATE, {
        buildingId: command.buildingId,
      });
      break;
    case 'DEMOLISH_BUILDING':
      game.events.emit(KingdomEvents.DEMOLISH_BUILDING, {
        buildingId: command.buildingId,
      });
      break;
    case 'GRANT_MARRIAGE':
      game.events.emit(KingdomEvents.GRANT_MARRIAGE, {
        subjectId: command.subjectId,
      });
      break;
    case 'GRANT_CHILD':
      game.events.emit(KingdomEvents.GRANT_CHILD, {
        subjectId: command.subjectId,
      });
      break;
    case 'PAY_RANSOM':
      game.events.emit(KingdomEvents.PAY_RANSOM, { id: command.id });
      break;
    case 'TRANSFORM_PEASANT':
      game.events.emit(KingdomEvents.TRANSFORM_PEASANT, {
        fgmId: command.fgmId,
      });
      break;
    case 'COMMAND_DETACHMENT':
      game.events.emit(KingdomEvents.COMMAND_DETACHMENT, {
        generalId: command.generalId,
        troopCount: command.troopCount,
      });
      break;
    case 'PROMOTE_CAREER':
      game.events.emit(KingdomEvents.CAREER_HIRE, {
        subjectId: command.subjectId,
        targetRole: command.targetRole,
      });
      break;
    case 'EXECUTE_CAPTIVE':
      game.events.emit(KingdomEvents.EXECUTE_CAPTIVE, { id: command.id });
      break;
    case 'DESTROY_CAMP':
      game.events.emit(KingdomEvents.DESTROY_CAMP, { campId: command.campId });
      break;
    case 'ARREST_CAMP':
      game.events.emit(KingdomEvents.ARREST_CAMP, { campId: command.campId });
      break;
    case 'FOCUS_CAMP':
      game.events.emit(KingdomEvents.FOCUS_CAMP, {
        campId: command.campId,
        unitId: command.unitId,
      });
      break;
    case 'BUY_NAVAL':
      game.events.emit(KingdomEvents.BUY_NAVAL, { kind: command.kind });
      break;
    case 'SANDBOX_SPAWN':
      game.events.emit(KingdomEvents.SANDBOX_SPAWN, command.action);
      break;
    case 'CAMERA_ZOOM':
      game.events.emit(KingdomEvents.CAMERA_ZOOM, {
        direction: command.direction,
      });
      break;
    case 'SET_DAYS_PLAYED':
      game.events.emit(KingdomEvents.SET_DAYS_PLAYED, {
        daysPlayed: command.daysPlayed,
      });
      break;
    case 'CLEAR_SELECTION':
      game.events.emit(KingdomEvents.CLEAR_SELECTION);
      break;
    default: {
      const _exhaustive: never = command;
      void _exhaustive;
    }
  }
}

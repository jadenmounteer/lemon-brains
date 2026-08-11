import type { CivilianJob } from '../jobs/capacities';
import type { ActivityId } from './types';
import type { UnitRole } from '../art/assetManifest';

const FARMER = [
  'Good soil today.',
  'These crops will feed us.',
  'Hoe, plant, pray.',
  'Another bushel!',
];
const BAKER = [
  'Smell that crust?',
  'Loaves for the keep.',
  'Flour everywhere…',
  'Don’t burn the batch!',
];
const MERCHANT = [
  'Fresh wares!',
  'A fair price.',
  'Coin for the kingdom.',
  'Who needs bread?',
];
const FISHERMAN = [
  'Tide looks kind.',
  'Nets ready.',
  'Something tugged…',
  'Salt in the air.',
];
const PHYSICIAN = [
  'Hold still.',
  'This will sting.',
  'Breathe easy.',
  'Wounds heal with care.',
];
const JESTER = [
  'Ha!',
  'Watch this trick!',
  'A jest for the weary.',
  'Juggle juggle!',
];
const GUARD = [
  'All quiet.',
  'Eyes on the road.',
  'Move along.',
  'Post secured.',
];
const SOLDIER = [
  'Drill again.',
  'Shields up.',
  'For the realm.',
  'Stay sharp.',
];
const ARCHER = [
  'Nock.',
  'Steady aim.',
  'String’s tight.',
  'Loose!',
];
const KNIGHT = [
  'Honor holds.',
  'Blade ready.',
  'For king and queen.',
];
const BISHOP = [
  'Bless this day.',
  'Peace be with you.',
  'The bells call.',
];
const WITCH_HUNTER = [
  'No hexes here.',
  'I smell brimstone…',
  'Cathedral watches.',
];
const EXECUTIONER = [
  'Justice waits.',
  'The rope is ready.',
  '…',
];
const DUNGEON_KEEPER = [
  'Keys jingle.',
  'Cells are full enough.',
  'Quiet down there.',
];
const GENERAL = [
  'Hold the line.',
  'Report to me.',
  'Discipline wins.',
];
const SLEEP = [
  'Zzz…',
  'Mmm…',
  '…dreams…',
];
const WORK_GENERIC = [
  'Hard at it.',
  'Almost done.',
  'Keep going.',
];
const TRAIN = [
  'Again!',
  'Faster!',
  'Form up.',
];
const HEAL = [
  'Easy now.',
  'Bandages ready.',
  'You’ll mend.',
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

/** Occasional on-site chatter while performing a schedule job or sleeping. */
export function presenceLineFor(opts: {
  activity: ActivityId;
  role: UnitRole;
  job?: CivilianJob;
}): string | null {
  if (opts.activity === 'sleep') return pick(SLEEP);
  if (opts.activity === 'heal') return pick(HEAL);
  if (opts.activity === 'train') return pick(TRAIN);
  if (opts.activity === 'juggle') return pick(JESTER);

  if (opts.job === 'farmer') return pick(FARMER);
  if (opts.job === 'baker') return pick(BAKER);
  if (opts.job === 'merchant') return pick(MERCHANT);
  if (opts.job === 'fisherman') return pick(FISHERMAN);

  switch (opts.role) {
    case 'physician':
      return pick(PHYSICIAN);
    case 'jester':
      return pick(JESTER);
    case 'guard':
    case 'elite_guard':
      return pick(GUARD);
    case 'soldier':
      return pick(SOLDIER);
    case 'archer':
    case 'elite_archer':
      return pick(ARCHER);
    case 'knight':
      return pick(KNIGHT);
    case 'bishop':
      return pick(BISHOP);
    case 'witch_hunter':
      return pick(WITCH_HUNTER);
    case 'executioner':
      return pick(EXECUTIONER);
    case 'dungeon_keeper':
      return pick(DUNGEON_KEEPER);
    case 'general':
      return pick(GENERAL);
    case 'peasant':
      return pick(WORK_GENERIC);
    default:
      if (
        opts.activity === 'work' ||
        opts.activity === 'harvest' ||
        opts.activity === 'gather'
      ) {
        return pick(WORK_GENERIC);
      }
      return null;
  }
}

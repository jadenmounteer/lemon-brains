/** Relative room map for the enlarged keep (origin = keep sprite center). */

export const KEEP_FOOTPRINT = { w: 160, h: 120 } as const;

export type KeepRoomId =
  | 'gate'
  | 'courtyard'
  | 'great_hall'
  | 'banquet'
  | 'kitchen'
  | 'servants'
  | 'chambers'
  | 'solar'
  | 'chapel_nook'
  | 'armory_nook';

export const KEEP_ROOM_IDS: KeepRoomId[] = [
  'gate',
  'courtyard',
  'great_hall',
  'banquet',
  'kitchen',
  'servants',
  'chambers',
  'solar',
  'chapel_nook',
  'armory_nook',
];

/** Room centers as offsets from keep origin (sprite center). */
const ROOM_OFFSETS: Record<KeepRoomId, { x: number; y: number; r: number }> = {
  gate: { x: 0, y: 48, r: 14 },
  courtyard: { x: 0, y: 28, r: 22 },
  great_hall: { x: -8, y: -8, r: 18 },
  banquet: { x: 36, y: 4, r: 16 },
  kitchen: { x: 52, y: -28, r: 14 },
  servants: { x: -52, y: 20, r: 12 },
  chambers: { x: -40, y: -36, r: 14 },
  solar: { x: 8, y: -44, r: 12 },
  chapel_nook: { x: -56, y: -20, r: 10 },
  armory_nook: { x: 48, y: 32, r: 12 },
};

const ROOM_LABELS: Record<KeepRoomId, string> = {
  gate: 'Gate',
  courtyard: 'Courtyard',
  great_hall: 'Great hall',
  banquet: 'Banquet hall',
  kitchen: 'Kitchen',
  servants: 'Servants’ quarters',
  chambers: 'Royal chambers',
  solar: 'Solar',
  chapel_nook: 'Chapel nook',
  armory_nook: 'Armory nook',
};

export function roomLabel(room: KeepRoomId): string {
  return ROOM_LABELS[room];
}

/** Stable hash so co-workers fan out inside a room. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function roomPoint(
  keepOrigin: { x: number; y: number },
  roomId: KeepRoomId,
  subjectId = 'anon'
): { x: number; y: number } {
  const room = ROOM_OFFSETS[roomId];
  const h = hashId(subjectId);
  const ang = ((h % 360) / 360) * Math.PI * 2;
  const dist = (h % 7) * 0.12 * room.r;
  return {
    x: keepOrigin.x + room.x + Math.cos(ang) * dist,
    y: keepOrigin.y + room.y + Math.sin(ang) * dist,
  };
}

export function roomForCastleJob(
  job:
    | 'cook'
    | 'servant'
    | 'steward'
    | 'scribe'
    | 'cupbearer'
    | string
    | undefined
): KeepRoomId {
  switch (job) {
    case 'cook':
      return 'kitchen';
    case 'servant':
      return 'servants';
    case 'steward':
      return 'great_hall';
    case 'scribe':
      return 'solar';
    case 'cupbearer':
      return 'banquet';
    default:
      return 'courtyard';
  }
}

export function defaultRoomForActivity(
  activity: string,
  role?: string
): KeepRoomId {
  switch (activity) {
    case 'cook':
    case 'knead':
      return 'kitchen';
    case 'serve':
    case 'feast':
      return 'banquet';
    case 'clean':
      return 'servants';
    case 'court':
      return 'great_hall';
    case 'study':
      return 'solar';
    case 'chamber':
    case 'sleep':
      return role === 'king' ||
        role === 'queen' ||
        role === 'prince' ||
        role === 'princess' ||
        role === 'duke' ||
        role === 'duchess'
        ? 'chambers'
        : 'servants';
    case 'train':
    case 'juggle':
    case 'play':
      return 'courtyard';
    case 'ball':
      return 'courtyard';
    default:
      return 'great_hall';
  }
}

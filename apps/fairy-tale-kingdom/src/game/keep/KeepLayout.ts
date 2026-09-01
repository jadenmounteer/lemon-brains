/** Relative room map for the enlarged keep (origin = keep sprite center). */

export const KEEP_FOOTPRINT = { w: 800, h: 600 } as const;

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

/** Room centers as offsets from keep origin (sprite center) — scaled for 800×600 keep. */
const ROOM_OFFSETS: Record<KeepRoomId, { x: number; y: number; r: number }> = {
  gate: { x: 0, y: 240, r: 70 },
  courtyard: { x: 0, y: 140, r: 110 },
  great_hall: { x: -40, y: -40, r: 90 },
  banquet: { x: 180, y: 20, r: 80 },
  kitchen: { x: 260, y: -140, r: 70 },
  servants: { x: -260, y: 100, r: 60 },
  chambers: { x: -200, y: -180, r: 70 },
  solar: { x: 40, y: -220, r: 60 },
  chapel_nook: { x: -280, y: -100, r: 50 },
  armory_nook: { x: 240, y: 160, r: 60 },
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

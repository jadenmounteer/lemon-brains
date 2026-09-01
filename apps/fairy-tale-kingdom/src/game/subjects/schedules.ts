import type { CivilianJob } from '../jobs/capacities';
import { isCastleJob } from '../jobs/capacities';
import type { ScheduleSlot, SubjectRole } from './types';

function withMeals(
  slots: ScheduleSlot[],
  breakfastZone: ScheduleSlot['zone'],
  supperZone: ScheduleSlot['zone']
): ScheduleSlot[] {
  // Insert short meal windows by splitting around 7–8 and 18–19 when possible
  const out: ScheduleSlot[] = [];
  for (const s of slots) {
    if (s.startHour < 7 && s.endHour > 8 && s.activity === 'sleep') {
      out.push({ ...s, endHour: 7 });
      out.push({
        startHour: 7,
        endHour: 8,
        activity: 'eat',
        zone: breakfastZone,
        label: 'Eating breakfast',
      });
      if (s.endHour > 8) {
        out.push({ ...s, startHour: 8 });
      }
      continue;
    }
    if (s.startHour <= 18 && s.endHour >= 19 && s.activity !== 'eat') {
      if (s.startHour < 18) {
        out.push({ ...s, endHour: 18 });
      }
      out.push({
        startHour: 18,
        endHour: 19,
        activity: 'eat',
        zone: supperZone,
        label: 'Eating supper',
      });
      if (s.endHour > 19) {
        out.push({ ...s, startHour: 19 });
      }
      continue;
    }
    out.push(s);
  }
  return out;
}

const peasantBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 13, activity: 'work', zone: 'field', label: 'Working the fields' },
  { startHour: 13, endHour: 14, activity: 'idle_keep', zone: 'keep', label: 'Resting by the keep' },
  { startHour: 14, endHour: 18, activity: 'gather', zone: 'path', label: 'Carrying goods along the path' },
  { startHour: 18, endHour: 20, activity: 'idle_keep', zone: 'keep', label: 'Chatting near the keep' },
  { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const bakerSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 4, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 4, endHour: 12, activity: 'knead', zone: 'path', label: 'Kneading at the bakery' },
    { startHour: 12, endHour: 14, activity: 'idle_keep', zone: 'keep', label: 'Rest break' },
    { startHour: 14, endHour: 18, activity: 'knead', zone: 'path', label: 'Afternoon baking' },
    { startHour: 18, endHour: 22, activity: 'gather', zone: 'path', label: 'Delivering loaves' },
    { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
  ],
  'home',
  'home'
);

const merchantSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 6, endHour: 13, activity: 'work', zone: 'path', label: 'Trading at the market' },
    { startHour: 13, endHour: 14, activity: 'eat', zone: 'home', label: 'Midday meal' },
    { startHour: 14, endHour: 19, activity: 'work', zone: 'path', label: 'Weighing goods at the stalls' },
    { startHour: 19, endHour: 22, activity: 'gather', zone: 'path', label: 'Closing up the market' },
    { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
  ],
  'home',
  'home'
);

const guardBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 5, endHour: 11, activity: 'patrol', zone: 'wall', label: 'Patrolling the wall' },
  { startHour: 11, endHour: 13, activity: 'idle_keep', zone: 'keep', label: 'Reporting at the keep' },
  { startHour: 13, endHour: 19, activity: 'patrol', zone: 'path', label: 'Patrolling the roads' },
  { startHour: 19, endHour: 22, activity: 'patrol', zone: 'wall', label: 'Night watch on the wall' },
  { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const archerBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 10, activity: 'train', zone: 'field', label: 'Training with the bow' },
  { startHour: 10, endHour: 16, activity: 'patrol', zone: 'wall', label: 'Watching from the wall' },
  { startHour: 16, endHour: 19, activity: 'idle_keep', zone: 'keep', label: 'Resting by the keep' },
  { startHour: 19, endHour: 22, activity: 'patrol', zone: 'path', label: 'Scouting the path' },
  { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const kingSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 7, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Resting in chambers' },
  { startHour: 7, endHour: 12, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Holding court in the great hall' },
  { startHour: 12, endHour: 14, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Midday feast' },
  { startHour: 14, endHour: 16, activity: 'parade', zone: 'path', label: 'Royal procession (when scheduled)' },
  { startHour: 16, endHour: 18, activity: 'gather', zone: 'path', label: 'Walking the kingdom paths' },
  { startHour: 18, endHour: 21, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Evening banquet' },
  { startHour: 21, endHour: 24, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Retiring to chambers' },
];

const queenSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 7, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Resting in chambers' },
  { startHour: 7, endHour: 11, activity: 'study', zone: 'keep', room: 'solar', label: 'In the solar' },
  { startHour: 11, endHour: 13, activity: 'court', zone: 'keep', room: 'chapel_nook', label: 'Private chapel prayers' },
  { startHour: 13, endHour: 15, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Hosting the midday table' },
  { startHour: 15, endHour: 18, activity: 'gather', zone: 'path', label: 'Garden walk among the people' },
  { startHour: 18, endHour: 21, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Evening banquet host' },
  { startHour: 21, endHour: 24, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Retiring to chambers' },
];

const princeSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 7, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Resting in chambers' },
  { startHour: 7, endHour: 11, activity: 'train', zone: 'keep', room: 'courtyard', label: 'Training in the courtyard' },
  { startHour: 11, endHour: 14, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Attending court' },
  { startHour: 14, endHour: 17, activity: 'patrol', zone: 'path', label: 'Riding the roads' },
  { startHour: 17, endHour: 18, activity: 'train', zone: 'keep', room: 'armory_nook', label: 'At the armory' },
  { startHour: 18, endHour: 21, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Evening feast' },
  { startHour: 21, endHour: 24, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Retiring to chambers' },
];

const princessSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 7, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Resting in chambers' },
  { startHour: 7, endHour: 12, activity: 'study', zone: 'keep', room: 'solar', label: 'Music and embroidery in the solar' },
  { startHour: 12, endHour: 14, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Midday feast' },
  { startHour: 14, endHour: 17, activity: 'gather', zone: 'keep', room: 'courtyard', label: 'Strolling the courtyard' },
  { startHour: 17, endHour: 18, activity: 'study', zone: 'keep', room: 'chapel_nook', label: 'Quiet prayers' },
  { startHour: 18, endHour: 21, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Evening banquet' },
  { startHour: 21, endHour: 24, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Retiring to chambers' },
];

const cookSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 5, endHour: 11, activity: 'knead', zone: 'keep', room: 'kitchen', label: 'Prepping in the kitchen' },
  { startHour: 11, endHour: 14, activity: 'serve', zone: 'keep', room: 'banquet', label: 'Serving the midday feast' },
  { startHour: 14, endHour: 17, activity: 'cook', zone: 'keep', room: 'kitchen', label: 'Cooking supper' },
  { startHour: 17, endHour: 20, activity: 'serve', zone: 'keep', room: 'banquet', label: 'Banquet service' },
  { startHour: 20, endHour: 22, activity: 'clean', zone: 'keep', room: 'kitchen', label: 'Scouring the kitchen' },
  { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home' },
];

const servantSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 5, endHour: 9, activity: 'clean', zone: 'keep', room: 'servants', label: 'Tidying servants’ quarters' },
  { startHour: 9, endHour: 13, activity: 'clean', zone: 'keep', room: 'chambers', label: 'Cleaning royal chambers' },
  { startHour: 13, endHour: 16, activity: 'clean', zone: 'keep', room: 'great_hall', label: 'Sweeping the great hall' },
  { startHour: 16, endHour: 19, activity: 'gather', zone: 'path', label: 'Running castle errands' },
  { startHour: 19, endHour: 21, activity: 'serve', zone: 'keep', room: 'banquet', label: 'Helping at supper' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home' },
];

const stewardSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 12, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Preparing the great hall' },
  { startHour: 12, endHour: 14, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Overseeing the feast' },
  { startHour: 14, endHour: 18, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Castle inventory' },
  { startHour: 18, endHour: 21, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Evening feast steward' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home' },
];

const scribeSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 12, activity: 'study', zone: 'keep', room: 'solar', label: 'Copying ledgers in the solar' },
  { startHour: 12, endHour: 14, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Recording court petitions' },
  { startHour: 14, endHour: 18, activity: 'study', zone: 'keep', room: 'solar', label: 'Writing dispatches' },
  { startHour: 18, endHour: 20, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Quiet supper' },
  { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home' },
];

const cupbearerSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 11, activity: 'serve', zone: 'keep', room: 'banquet', label: 'Setting the banquet hall' },
  { startHour: 11, endHour: 14, activity: 'serve', zone: 'keep', room: 'great_hall', label: 'Serving at court' },
  { startHour: 14, endHour: 17, activity: 'clean', zone: 'keep', room: 'banquet', label: 'Polishing goblets' },
  { startHour: 17, endHour: 21, activity: 'serve', zone: 'keep', room: 'banquet', label: 'Cupbearing at supper' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home' },
];

const fairySchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 6, activity: 'sleep', zone: 'keep', room: 'chambers', label: 'Resting' },
    { startHour: 6, endHour: 12, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Watching over the court' },
    { startHour: 12, endHour: 18, activity: 'gather', zone: 'path', label: 'Visiting the people' },
    { startHour: 18, endHour: 22, activity: 'juggle', zone: 'keep', room: 'courtyard', label: 'Sparkling in the courtyard' },
    { startHour: 22, endHour: 24, activity: 'sleep', zone: 'keep', room: 'chambers', label: 'Turning in' },
  ],
  'keep',
  'keep'
);

const knightBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 11, activity: 'train', zone: 'field', label: 'Training with blade and shield' },
  { startHour: 11, endHour: 14, activity: 'patrol', zone: 'path', label: 'Riding the roads' },
  { startHour: 14, endHour: 18, activity: 'patrol', zone: 'wall', label: 'Guarding the walls' },
  { startHour: 18, endHour: 21, activity: 'idle_keep', zone: 'keep', label: 'Reporting at the keep' },
  { startHour: 21, endHour: 24, activity: 'hunt', zone: 'cave', label: 'Hunting sleeping dragons' },
];

const generalBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 10, activity: 'train', zone: 'field', label: 'Drilling the troops' },
  { startHour: 10, endHour: 16, activity: 'patrol', zone: 'path', label: 'Surveying the frontier' },
  { startHour: 16, endHour: 20, activity: 'idle_keep', zone: 'keep', label: 'Planning at the keep' },
  { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
];

const bishopBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Resting in the sacristy' },
  { startHour: 6, endHour: 12, activity: 'idle_keep', zone: 'cathedral', label: 'Saying morning prayers' },
  { startHour: 12, endHour: 17, activity: 'gather', zone: 'path', label: 'Blessing the roads' },
  { startHour: 17, endHour: 21, activity: 'idle_keep', zone: 'cathedral', label: 'Tending the cathedral' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Retiring for the night' },
];

const physicianBase: ScheduleSlot[] = [
  { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Resting' },
  { startHour: 5, endHour: 12, activity: 'heal', zone: 'infirmary', label: 'Tending the infirmary' },
  { startHour: 12, endHour: 18, activity: 'heal', zone: 'path', label: 'Tending the wounded' },
  { startHour: 18, endHour: 21, activity: 'idle_keep', zone: 'keep', label: 'Reporting at the keep' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const childSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 7, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 7, endHour: 12, activity: 'play', zone: 'path', label: 'Playing in the streets' },
    { startHour: 12, endHour: 14, activity: 'play', zone: 'keep', room: 'gate', label: 'Playing by the keep gate' },
    { startHour: 14, endHour: 18, activity: 'play', zone: 'path', label: 'Playing with friends' },
    { startHour: 18, endHour: 21, activity: 'idle_keep', zone: 'home', label: 'Helping at home' },
    { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Bedtime' },
  ],
  'home',
  'home'
);

const jesterSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 6, endHour: 12, activity: 'juggle', zone: 'keep', room: 'courtyard', label: 'Juggling in the courtyard' },
    { startHour: 12, endHour: 16, activity: 'juggle', zone: 'path', label: 'Entertaining the plaza' },
    { startHour: 16, endHour: 20, activity: 'juggle', zone: 'keep', room: 'great_hall', label: 'Court entertainment' },
    { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
  ],
  'tavern',
  'tavern'
);

const dungeonSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 6, endHour: 12, activity: 'patrol', zone: 'dungeon', label: 'Watching the cells' },
    { startHour: 12, endHour: 14, activity: 'idle_keep', zone: 'keep', label: 'Reporting' },
    { startHour: 14, endHour: 20, activity: 'patrol', zone: 'dungeon', label: 'Guarding captives' },
    { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
  ],
  'keep',
  'home'
);

const executionerSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 6, endHour: 12, activity: 'idle_keep', zone: 'dungeon', label: 'At the dungeon' },
    { startHour: 12, endHour: 16, activity: 'patrol', zone: 'gallows', label: 'Tending the gallows' },
    { startHour: 16, endHour: 20, activity: 'idle_keep', zone: 'dungeon', label: 'Waiting on sentence' },
    { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
  ],
  'home',
  'home'
);

const witchHunterSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Sleeping' },
    { startHour: 5, endHour: 12, activity: 'hunt', zone: 'path', label: 'Hunting witches' },
    { startHour: 12, endHour: 14, activity: 'idle_keep', zone: 'cathedral', label: 'Blessing weapons' },
    { startHour: 14, endHour: 20, activity: 'hunt', zone: 'forest', label: 'Tracking covens' },
    { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Resting' },
  ],
  'cathedral',
  'home'
);

const witchSchedule: ScheduleSlot[] = withMeals(
  [
    { startHour: 0, endHour: 6, activity: 'sleep', zone: 'forest', label: 'Resting at the coven' },
    { startHour: 6, endHour: 12, activity: 'curse', zone: 'path', label: 'Brewing and plotting' },
    { startHour: 12, endHour: 18, activity: 'curse', zone: 'path', label: 'Seeking a target' },
    { startHour: 18, endHour: 22, activity: 'curse', zone: 'forest', label: 'Night rituals' },
    { startHour: 22, endHour: 24, activity: 'sleep', zone: 'forest', label: 'Resting' },
  ],
  'forest',
  'forest'
);

const dukeSchedule = withMeals(
  [
    { startHour: 0, endHour: 7, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Resting in keep chambers' },
    { startHour: 7, endHour: 12, activity: 'court', zone: 'keep', room: 'great_hall', label: 'Local court at the keep' },
    { startHour: 12, endHour: 14, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Midday table' },
    { startHour: 14, endHour: 18, activity: 'gather', zone: 'path', label: 'Touring the influence' },
    { startHour: 18, endHour: 21, activity: 'feast', zone: 'keep', room: 'banquet', label: 'Evening table' },
    { startHour: 21, endHour: 24, activity: 'chamber', zone: 'keep', room: 'chambers', label: 'Retiring' },
  ],
  'keep',
  'keep'
);

/** Living-camp garrison: sleep by the fire, otherwise roam within the camp sphere. */
function campSchedule(label: string): ScheduleSlot[] {
  return [
    {
      startHour: 0,
      endHour: 6,
      activity: 'sleep',
      zone: 'home',
      label: `Sleeping at the ${label} camp`,
    },
    {
      startHour: 6,
      endHour: 20,
      activity: 'patrol',
      zone: 'home',
      label: `Keeping watch near the ${label} camp`,
    },
    {
      startHour: 20,
      endHour: 24,
      activity: 'sleep',
      zone: 'home',
      label: `Resting at the ${label} camp`,
    },
  ];
}

const banditSchedule = campSchedule('bandit');
const thiefSchedule = campSchedule('thief');
const gypsySchedule = campSchedule('gypsy');

/** Necromancers linger by the cemetery raising the dead until dawn drives them off. */
const necromancerSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 24, activity: 'gather', zone: 'cemetery', label: 'Raising the dead' },
];

/** Zombies never rest — they shamble in search of the living around the clock. */
const zombieSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 24, activity: 'patrol', zone: 'path', label: 'Shambling as a zombie' },
];

/** Vampire wives prowl by night and retreat to the castle's shadow by day. */
const vampireWifeSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'hunt', zone: 'forest', label: 'Prowling with the vampire' },
  { startHour: 6, endHour: 20, activity: 'sleep', zone: 'forest', label: 'Resting in the castle’s shadow' },
  { startHour: 20, endHour: 24, activity: 'hunt', zone: 'forest', label: 'Prowling with the vampire' },
];

function castleScheduleFor(job: CivilianJob): ScheduleSlot[] | null {
  switch (job) {
    case 'cook':
      return withMeals(cookSchedule, 'keep', 'keep');
    case 'servant':
      return withMeals(servantSchedule, 'home', 'keep');
    case 'steward':
      return withMeals(stewardSchedule, 'keep', 'keep');
    case 'scribe':
      return withMeals(scribeSchedule, 'home', 'keep');
    case 'cupbearer':
      return withMeals(cupbearerSchedule, 'keep', 'keep');
    default:
      return null;
  }
}

export function scheduleFor(
  role: SubjectRole,
  job?: CivilianJob
): ScheduleSlot[] {
  if (role === 'peasant' && job && isCastleJob(job)) {
    const castle = castleScheduleFor(job);
    if (castle) return castle;
  }
  if (role === 'peasant' && job === 'baker') {
    return bakerSchedule;
  }
  if (role === 'peasant' && job === 'merchant') {
    return merchantSchedule;
  }
  switch (role) {
    case 'peasant':
      return withMeals(peasantBase, 'home', 'home');
    case 'child':
      return childSchedule;
    case 'guard':
    case 'elite_guard':
    case 'soldier':
      return withMeals(guardBase, 'keep', 'home');
    case 'archer':
    case 'elite_archer':
      return withMeals(archerBase, 'keep', 'home');
    case 'knight':
      return withMeals(knightBase, 'keep', 'home');
    case 'general':
      return withMeals(generalBase, 'keep', 'home');
    case 'physician':
      return withMeals(physicianBase, 'infirmary', 'home');
    case 'bishop':
      return withMeals(bishopBase, 'cathedral', 'home');
    case 'king':
      return withMeals(kingSchedule, 'keep', 'keep');
    case 'queen':
      return withMeals(queenSchedule, 'keep', 'keep');
    case 'prince':
      return withMeals(princeSchedule, 'keep', 'keep');
    case 'princess':
      return withMeals(princessSchedule, 'keep', 'keep');
    case 'duke':
    case 'duchess':
      return dukeSchedule;
    case 'fairy_godmother':
      return fairySchedule;
    case 'jester':
      return jesterSchedule;
    case 'dungeon_keeper':
      return dungeonSchedule;
    case 'executioner':
      return executionerSchedule;
    case 'witch_hunter':
      return witchHunterSchedule;
    case 'witch':
      return witchSchedule;
    case 'necromancer':
      return necromancerSchedule;
    case 'zombie':
      return zombieSchedule;
    case 'vampire_wife':
      return vampireWifeSchedule;
    case 'bandit':
      return banditSchedule;
    case 'thief':
      return thiefSchedule;
    case 'gypsy':
      return gypsySchedule;
  }
}

export function slotAtHour(
  role: SubjectRole,
  hour: number,
  job?: CivilianJob
): ScheduleSlot {
  const slots = scheduleFor(role, job);
  const h = ((hour % 24) + 24) % 24;
  return (
    slots.find((s) => h >= s.startHour && h < s.endHour) ??
    slots[slots.length - 1]!
  );
}

export function scheduleSummary(
  role: SubjectRole,
  job?: CivilianJob
): string[] {
  return scheduleFor(role, job).map((s) => {
    const a = formatHour(s.startHour);
    const b = formatHour(s.endHour === 24 ? 0 : s.endHour);
    return `${a}–${b}: ${s.label}`;
  });
}

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

export function roleLabel(role: SubjectRole): string {
  switch (role) {
    case 'peasant':
      return 'Peasant';
    case 'child':
      return 'Child';
    case 'guard':
      return 'Guard';
    case 'soldier':
      return 'Soldier';
    case 'archer':
      return 'Archer';
    case 'elite_guard':
      return 'Elite Guard';
    case 'elite_archer':
      return 'Elite Archer';
    case 'knight':
      return 'Knight';
    case 'general':
      return 'General';
    case 'physician':
      return 'Physician';
    case 'bishop':
      return 'Bishop';
    case 'king':
      return 'King';
    case 'queen':
      return 'Queen';
    case 'prince':
      return 'Prince';
    case 'princess':
      return 'Princess';
    case 'duke':
      return 'Duke';
    case 'duchess':
      return 'Duchess';
    case 'fairy_godmother':
      return 'Fairy Godmother';
    case 'jester':
      return 'Jester';
    case 'dungeon_keeper':
      return 'Dungeon Keeper';
    case 'executioner':
      return 'Executioner';
    case 'witch_hunter':
      return 'Witch Hunter';
    case 'witch':
      return 'Witch';
    case 'necromancer':
      return 'Necromancer';
    case 'zombie':
      return 'Zombie';
    case 'vampire_wife':
      return 'Vampire Wife';
    case 'bandit':
      return 'Bandit';
    case 'thief':
      return 'Thief';
    case 'gypsy':
      return 'Gypsy';
  }
}

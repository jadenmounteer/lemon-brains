import type { ScheduleSlot, SubjectRole } from './types';

const peasantSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 12, activity: 'work', zone: 'field', label: 'Working the fields' },
  { startHour: 12, endHour: 14, activity: 'idle_keep', zone: 'keep', label: 'Resting by the keep' },
  { startHour: 14, endHour: 18, activity: 'gather', zone: 'path', label: 'Carrying goods along the path' },
  { startHour: 18, endHour: 21, activity: 'idle_keep', zone: 'keep', label: 'Chatting near the keep' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const guardSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 5, endHour: 11, activity: 'patrol', zone: 'wall', label: 'Patrolling the wall' },
  { startHour: 11, endHour: 13, activity: 'idle_keep', zone: 'keep', label: 'Reporting at the keep' },
  { startHour: 13, endHour: 19, activity: 'patrol', zone: 'path', label: 'Patrolling the roads' },
  { startHour: 19, endHour: 22, activity: 'patrol', zone: 'wall', label: 'Night watch on the wall' },
  { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const archerSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 10, activity: 'train', zone: 'field', label: 'Training with the bow' },
  { startHour: 10, endHour: 16, activity: 'patrol', zone: 'wall', label: 'Watching from the wall' },
  { startHour: 16, endHour: 19, activity: 'idle_keep', zone: 'keep', label: 'Resting by the keep' },
  { startHour: 19, endHour: 22, activity: 'patrol', zone: 'path', label: 'Scouting the path' },
  { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

const royalSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 7, activity: 'sleep', zone: 'home', label: 'Resting in chambers' },
  { startHour: 7, endHour: 12, activity: 'idle_keep', zone: 'keep', label: 'Holding court at the keep' },
  { startHour: 12, endHour: 16, activity: 'gather', zone: 'path', label: 'Walking the kingdom paths' },
  { startHour: 16, endHour: 20, activity: 'idle_keep', zone: 'keep', label: 'Appearing before the people' },
  { startHour: 20, endHour: 24, activity: 'sleep', zone: 'home', label: 'Retiring for the night' },
];

const fairySchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Resting' },
  { startHour: 6, endHour: 12, activity: 'idle_keep', zone: 'keep', label: 'Watching over the keep' },
  { startHour: 12, endHour: 18, activity: 'gather', zone: 'path', label: 'Visiting the people' },
  { startHour: 18, endHour: 22, activity: 'idle_keep', zone: 'keep', label: 'Sparkling near the keep' },
  { startHour: 22, endHour: 24, activity: 'sleep', zone: 'home', label: 'Turning in' },
];

const knightSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Sleeping at home' },
  { startHour: 6, endHour: 11, activity: 'train', zone: 'field', label: 'Training with blade and shield' },
  { startHour: 11, endHour: 14, activity: 'patrol', zone: 'path', label: 'Riding the roads' },
  { startHour: 14, endHour: 18, activity: 'patrol', zone: 'wall', label: 'Guarding the walls' },
  { startHour: 18, endHour: 21, activity: 'idle_keep', zone: 'keep', label: 'Reporting at the keep' },
  { startHour: 21, endHour: 24, activity: 'hunt', zone: 'cave', label: 'Hunting sleeping dragons' },
];

const bishopSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 6, activity: 'sleep', zone: 'home', label: 'Resting in the sacristy' },
  { startHour: 6, endHour: 12, activity: 'idle_keep', zone: 'cathedral', label: 'Saying morning prayers' },
  { startHour: 12, endHour: 17, activity: 'gather', zone: 'path', label: 'Blessing the roads' },
  { startHour: 17, endHour: 21, activity: 'idle_keep', zone: 'cathedral', label: 'Tending the cathedral' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Retiring for the night' },
];

const physicianSchedule: ScheduleSlot[] = [
  { startHour: 0, endHour: 5, activity: 'sleep', zone: 'home', label: 'Resting' },
  { startHour: 5, endHour: 12, activity: 'heal', zone: 'infirmary', label: 'Tending the infirmary' },
  { startHour: 12, endHour: 18, activity: 'heal', zone: 'path', label: 'Visiting the sick' },
  { startHour: 18, endHour: 21, activity: 'idle_keep', zone: 'keep', label: 'Reporting at the keep' },
  { startHour: 21, endHour: 24, activity: 'sleep', zone: 'home', label: 'Heading home to sleep' },
];

export function scheduleFor(role: SubjectRole): ScheduleSlot[] {
  switch (role) {
    case 'peasant':
      return peasantSchedule;
    case 'guard':
    case 'elite_guard':
      return guardSchedule;
    case 'archer':
    case 'elite_archer':
      return archerSchedule;
    case 'knight':
      return knightSchedule;
    case 'physician':
      return physicianSchedule;
    case 'bishop':
      return bishopSchedule;
    case 'king':
    case 'queen':
    case 'prince':
    case 'princess':
      return royalSchedule;
    case 'fairy_godmother':
      return fairySchedule;
  }
}

export function slotAtHour(role: SubjectRole, hour: number): ScheduleSlot {
  const slots = scheduleFor(role);
  const h = ((hour % 24) + 24) % 24;
  return (
    slots.find((s) => h >= s.startHour && h < s.endHour) ??
    slots[slots.length - 1]!
  );
}

export function scheduleSummary(role: SubjectRole): string[] {
  return scheduleFor(role).map((s) => {
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
    case 'guard':
      return 'Guard';
    case 'archer':
      return 'Archer';
    case 'elite_guard':
      return 'Elite Guard';
    case 'elite_archer':
      return 'Elite Archer';
    case 'knight':
      return 'Knight';
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
    case 'fairy_godmother':
      return 'Fairy Godmother';
  }
}

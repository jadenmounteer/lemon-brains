const FIRST = [
  'Bram',
  'Elowen',
  'Finn',
  'Greta',
  'Hazel',
  'Ivor',
  'Juniper',
  'Kael',
  'Lark',
  'Mira',
  'Nessa',
  'Orin',
  'Pip',
  'Rowan',
  'Sable',
  'Thistle',
];

const LAST = [
  'Ashford',
  'Briar',
  'Creek',
  'Dale',
  'Elder',
  'Fern',
  'Grove',
  'Hill',
  'Marsh',
  'Oak',
  'Reed',
  'Stone',
  'Thorn',
  'Vale',
  'Wren',
  'Yarrow',
];

/** Tiny deterministic PRNG from a seed string/number */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickName(seed: number): string {
  const rand = mulberry32(seed);
  const first = FIRST[Math.floor(rand() * FIRST.length)]!;
  const last = LAST[Math.floor(rand() * LAST.length)]!;
  return `${first} ${last}`;
}

const MONSTER_FIRST = [
  'Grim',
  'Blight',
  'Ash',
  'Thorn',
  'Gore',
  'Moss',
  'Iron',
  'Shadow',
  'Bramble',
  'Cinder',
];

const TROLL_LAST = ['Tusk', 'Mire', 'Crag', 'Bog', 'Knuckle'];
const OGRE_LAST = ['Smash', 'Maul', 'Hill', 'Boulder', 'Fist'];
const DRAGON_LAST = [
  'Scale',
  'Ember',
  'Wyrm',
  'Fang',
  'Nightwing',
  'Goldhoard',
];

export function pickMonsterName(
  kind: 'troll' | 'ogre' | 'dragon',
  seed: number
): string {
  const rand = mulberry32(seed);
  const first = MONSTER_FIRST[Math.floor(rand() * MONSTER_FIRST.length)]!;
  const lasts =
    kind === 'troll' ? TROLL_LAST : kind === 'ogre' ? OGRE_LAST : DRAGON_LAST;
  const last = lasts[Math.floor(rand() * lasts.length)]!;
  return `${first} ${last}`;
}

const CAMP_LEADER_TITLES: Record<string, string> = {
  bandit: 'Bandit Captain',
  giant: 'Giant Chief',
  goblin: 'Goblin Warchief',
  thief: 'Thief Boss',
  gypsy: 'Gypsy Baron',
  coven: 'Coven Matriarch',
  siege: 'General',
};

/** Rank-and-title used for a camp's named leader, keyed by camp kind. */
export function campLeaderTitle(kind: string): string {
  return CAMP_LEADER_TITLES[kind] ?? 'Leader';
}

const CAMP_MINION_FIRST = [
  'Grix',
  'Snarl',
  'Bok',
  'Rag',
  'Fenn',
  'Skarr',
  'Nub',
  'Grott',
  'Thokk',
  'Mudge',
  'Crank',
  'Vex',
  'Rook',
  'Sly',
  'Doss',
  'Grubb',
];

const CAMP_MINION_LAST = [
  'the Rat',
  'Onefang',
  'Quickhand',
  'Bonebreaker',
  'the Grim',
  'Muckfoot',
  'Snakeye',
  'Longknife',
  'the Bold',
  'Ashcloak',
];

/** Rank-and-file name for a living unit stationed at an enemy camp. */
export function pickCampUnitName(seed: number): string {
  const rand = mulberry32(seed);
  const first =
    CAMP_MINION_FIRST[Math.floor(rand() * CAMP_MINION_FIRST.length)]!;
  const last = CAMP_MINION_LAST[Math.floor(rand() * CAMP_MINION_LAST.length)]!;
  return `${first} ${last}`;
}

const CAMP_LEADER_FIRST = [
  'Grukk',
  'Vashna',
  'Old Rand',
  'Bram Ironhand',
  'Skarl',
  'Morga',
  'Drask',
  'Yennefer',
  'Korrath',
  'Wenna',
];

/** Named leader for an enemy camp, e.g. "Goblin Warchief Grukk". */
export function pickCampLeaderName(kind: string, seed: number): string {
  const rand = mulberry32(seed);
  const first =
    CAMP_LEADER_FIRST[Math.floor(rand() * CAMP_LEADER_FIRST.length)]!;
  return `${campLeaderTitle(kind)} ${first}`;
}

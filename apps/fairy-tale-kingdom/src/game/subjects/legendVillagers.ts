export interface LegendVillager {
  id: string;
  name: string;
  gender: 'male' | 'female';
  backstory: string;
  job?: 'farmer' | 'baker' | 'merchant' | 'fisherman';
  appearanceVariant: 0 | 1 | 2 | 3 | 4 | 5;
  ageYears: number;
}

export const LEGEND_VILLAGERS: LegendVillager[] = [
  {
    id: 'widow_agnes',
    name: 'Agnes Thorn',
    gender: 'female',
    backstory:
      'Agnes lost her first husband to a raid years ago. She keeps the lane tidy and watches over young couples.',
    appearanceVariant: 2,
    ageYears: 62,
  },
  {
    id: 'old_henrik',
    name: 'Henrik Vale',
    gender: 'male',
    backstory:
      'Henrik remembers three kings. Children call him the village elder though he claims no title.',
    appearanceVariant: 4,
    ageYears: 68,
  },
  {
    id: 'baker_marta',
    name: 'Marta Briar',
    gender: 'female',
    backstory: 'Marta’s rye loaves are famous at market. She hums while the ovens glow.',
    job: 'baker',
    appearanceVariant: 1,
    ageYears: 34,
  },
  {
    id: 'farmer_tomas',
    name: 'Tomas Reed',
    gender: 'male',
    backstory: 'Tomas tends the south field before dawn. His hoe has patched three handles.',
    job: 'farmer',
    appearanceVariant: 3,
    ageYears: 41,
  },
  {
    id: 'merchant_lyra',
    name: 'Lyra Oak',
    gender: 'female',
    backstory: 'Lyra trades ribbons and gossip. She knows who is courting whom.',
    job: 'merchant',
    appearanceVariant: 5,
    ageYears: 29,
  },
];

export function legendById(id: string): LegendVillager | undefined {
  return LEGEND_VILLAGERS.find((l) => l.id === id);
}

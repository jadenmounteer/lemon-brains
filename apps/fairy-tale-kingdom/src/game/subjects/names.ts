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

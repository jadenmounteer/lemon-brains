/** Named palette — keep in sync with docs/STYLE_GUIDE.md */
export const palette = {
  ink: 0x1c241c,
  grass: 0x3d7a4a,
  grassLight: 0x4a8f5c,
  grassDark: 0x2d5a3d,
  dirt: 0x8b6b45,
  dirtDark: 0x6b5234,
  stone: 0x8a8f84,
  stoneDark: 0x5c6158,
  wood: 0x6b5b45,
  woodDark: 0x3e3428,
  roof: 0xa04545,
  skin: 0xe0b090,
  clothPeasant: 0xc4a35a,
  clothGuard: 0x4a6fa5,
  clothArcher: 0x5a8f4a,
  clothBandit: 0x6b3e2e,
  clothGiant: 0x7a6a4a,
  clothEnemyArmy: 0x8b2e2e,
  metal: 0xc0c4c8,
  cream: 0xf4efe4,
} as const;

export type PaletteColor = (typeof palette)[keyof typeof palette];

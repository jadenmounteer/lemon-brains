/** Day/night clock exposed to systems without Phaser coupling. */
export interface IWorldClock {
  readonly hour: number;
  isNight(): boolean;
}

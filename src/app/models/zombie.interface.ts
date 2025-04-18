export interface ZombieState {
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
  facingLeft: boolean;
  id: number;
  speed: number; // Movement speed multiplier
  type: 'normal' | 'fat' | 'king';
  health: number;
}

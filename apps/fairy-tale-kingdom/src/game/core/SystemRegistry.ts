export interface Updatable {
  update(deltaMs: number): void;
}

export type UpdatePhase = 'pre' | 'simulate' | 'post';

/**
 * Registers game systems and runs phased updates in registration order.
 */
export class SystemRegistry {
  private readonly phases: Record<UpdatePhase, Updatable[]> = {
    pre: [],
    simulate: [],
    post: [],
  };

  register(system: Updatable, phase: UpdatePhase = 'simulate'): void {
    this.phases[phase].push(system);
  }

  update(deltaMs: number, phase: UpdatePhase): void {
    for (const system of this.phases[phase]) {
      system.update(deltaMs);
    }
  }

  /** All phases in order — useful for tests. */
  tickAll(deltaMs: number): void {
    this.update(deltaMs, 'pre');
    this.update(deltaMs, 'simulate');
    this.update(deltaMs, 'post');
  }

  counts(): Record<UpdatePhase, number> {
    return {
      pre: this.phases.pre.length,
      simulate: this.phases.simulate.length,
      post: this.phases.post.length,
    };
  }
}

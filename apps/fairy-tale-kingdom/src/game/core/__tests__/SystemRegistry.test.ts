import { describe, expect, it } from 'vitest';
import { SystemRegistry } from '../SystemRegistry';

describe('SystemRegistry', () => {
  it('runs phases in order pre → simulate → post', () => {
    const log: string[] = [];
    const reg = new SystemRegistry();
    reg.register({ update: () => log.push('pre') }, 'pre');
    reg.register({ update: () => log.push('sim') }, 'simulate');
    reg.register({ update: () => log.push('post') }, 'post');
    reg.tickAll(16);
    expect(log).toEqual(['pre', 'sim', 'post']);
  });

  it('updates only the requested phase', () => {
    let n = 0;
    const reg = new SystemRegistry();
    reg.register({ update: () => (n += 1) }, 'simulate');
    reg.update(16, 'pre');
    expect(n).toBe(0);
    reg.update(16, 'simulate');
    expect(n).toBe(1);
  });
});

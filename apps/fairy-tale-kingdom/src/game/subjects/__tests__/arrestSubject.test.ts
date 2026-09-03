import { describe, expect, it } from 'vitest';
import { arrestButtonBlockReason, stocksButtonBlockReason } from '../arrestSubject';

describe('arrestButtonBlockReason', () => {
  it('blocks monsters', () => {
    expect(
      arrestButtonBlockReason({
        subjectKind: 'monster',
        hasDungeon: true,
        hasGuard: true,
      })
    ).toMatch(/hunted/i);
  });

  it('requires a dungeon and a guard', () => {
    expect(
      arrestButtonBlockReason({
        hasDungeon: false,
        hasGuard: true,
      })
    ).toMatch(/dungeon/i);
    expect(
      arrestButtonBlockReason({
        hasDungeon: true,
        hasGuard: false,
      })
    ).toMatch(/guard/i);
  });

  it('allows arrest when justice pipeline exists', () => {
    expect(
      arrestButtonBlockReason({
        subjectKind: 'subject',
        hasDungeon: true,
        hasGuard: true,
      })
    ).toBeNull();
  });
});

describe('stocksButtonBlockReason', () => {
  it('requires stocks and a guard', () => {
    expect(
      stocksButtonBlockReason({ hasStocks: false, hasGuard: true })
    ).toMatch(/stocks/i);
    expect(
      stocksButtonBlockReason({ hasStocks: true, hasGuard: false })
    ).toMatch(/guard/i);
    expect(
      stocksButtonBlockReason({ hasStocks: true, hasGuard: true })
    ).toBeNull();
  });
});

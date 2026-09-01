import { describe, expect, it } from 'vitest';
import {
  detectLayoutVersion,
  migrateLayoutToV4,
} from '../layoutMigrations';

const v1Fixture = {
  subjects: [{ id: 's1', name: 'Ada', role: 'peasant', houseId: 'keep', hp: 20, maxHp: 20 }],
  buildings: [{ id: 'house-0', kind: 'house', x: 100, y: 200, hp: 30, maxHp: 30 }],
};

const v2Fixture = {
  ...v1Fixture,
  keepHp: 500,
  keepMaxHp: 500,
  princeSpawnMs: 12000,
};

const v3Fixture = {
  ...v2Fixture,
  monsters: [],
  encampments: [],
  mapSeed: 42,
  clockHour: 8,
};

describe('layout migrations', () => {
  it('detects v1 from bare subjects/buildings', () => {
    expect(detectLayoutVersion(v1Fixture)).toBe(1);
  });

  it('detects v2 when keep timers present', () => {
    expect(detectLayoutVersion(v2Fixture)).toBe(2);
  });

  it('detects v3 when world meta present', () => {
    expect(detectLayoutVersion(v3Fixture)).toBe(3);
  });

  it('migrates v1→v4 with default gameMode normal', () => {
    const out = migrateLayoutToV4(v1Fixture);
    expect(out?.schemaVersion).toBe(4);
    expect(out?.gameMode).toBe('normal');
    expect(out?.subjects).toHaveLength(1);
    expect(out?.buildings).toHaveLength(1);
  });

  it('preserves learning gameMode on v4 saves', () => {
    const out = migrateLayoutToV4({ ...v3Fixture, gameMode: 'learning' });
    expect(out?.gameMode).toBe('learning');
    expect(out?.schemaVersion).toBe(4);
  });

  it('returns null for invalid blobs', () => {
    expect(migrateLayoutToV4({})).toBeNull();
    expect(migrateLayoutToV4({ subjects: [] })).toBeNull();
  });
});

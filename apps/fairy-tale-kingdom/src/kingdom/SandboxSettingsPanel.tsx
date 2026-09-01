import type { ReactNode } from 'react';
import type { EnemyRole } from '../game/art/assetManifest';
import type { CampKind } from '../game/war/WarBalance';
import type { MonsterKind } from '../game/monsters/MonsterSystem';
import { HIRE_CATALOG } from '../marketplace/catalog';
import type { SandboxSettings, SandboxSpawnAction } from './sandboxSettings';

interface SandboxSettingsPanelProps {
  settings: SandboxSettings;
  onChange: (next: SandboxSettings) => void;
  onReset: () => void;
  onClose: () => void;
  onSpawn?: (action: SandboxSpawnAction) => void;
}

const CAMP_LABELS: { kind: CampKind; label: string }[] = [
  { kind: 'bandit', label: 'Bandit' },
  { kind: 'thief', label: 'Thief' },
  { kind: 'goblin', label: 'Goblin' },
  { kind: 'giant', label: 'Giant' },
  { kind: 'gypsy', label: 'Gypsy' },
  { kind: 'coven', label: 'Coven' },
  { kind: 'siege', label: 'Siege' },
];

const MONSTER_LABELS: { kind: MonsterKind; label: string }[] = [
  { kind: 'troll', label: 'Troll' },
  { kind: 'ogre', label: 'Ogre' },
  { kind: 'dragon', label: 'Dragon' },
];

const RAID_LABELS: { kind: EnemyRole; label: string }[] = [
  { kind: 'bandit', label: 'Bandits' },
  { kind: 'goblin', label: 'Goblins' },
  { kind: 'giant', label: 'Giants' },
  { kind: 'gypsy', label: 'Gypsies' },
  { kind: 'enemy_army', label: 'Army' },
];

const UNDEAD_LABELS: {
  kind: 'vampire' | 'necromancer' | 'ghost';
  label: string;
}[] = [
  { kind: 'vampire', label: 'Vampire' },
  { kind: 'necromancer', label: 'Necromancer' },
  { kind: 'ghost', label: 'Ghost' },
];

function MultSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 2,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="sandbox-field">
      <span>
        {label}{' '}
        <strong>{Math.round(value * 100)}%</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function SpawnRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="sandbox-spawn-row">
      <span className="sandbox-spawn-label">{label}</span>
      <div className="sandbox-spawn-btns">{children}</div>
    </div>
  );
}

export function SandboxSettingsPanel({
  settings,
  onChange,
  onReset,
  onClose,
  onSpawn,
}: SandboxSettingsPanelProps) {
  const set = (next: SandboxSettings) => onChange(next);
  const spawn = (action: SandboxSpawnAction) => onSpawn?.(action);

  return (
    <div className="sandbox-overlay" role="dialog" aria-label="Sandbox settings">
      <section className="panel sandbox-panel">
        <div className="inspector-header">
          <h2>Sandbox settings</h2>
          <button type="button" className="inspector-close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted">
          Local debug knobs — saved in this browser only, not in kingdom saves.
          100% is the tuned default; 0% turns a system off. Uncheck a type to
          stop it spawning / being hireable.
        </p>

        {onSpawn && (
          <>
            <h3 className="inspector-subhead">Spawn now</h3>
            <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.78rem' }}>
              Instant toys — drop enemies into the live kingdom.
            </p>
            <SpawnRow label="Camps">
              {CAMP_LABELS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  className="sandbox-spawn-btn"
                  onClick={() => spawn({ type: 'camp', campKind: kind })}
                >
                  {label}
                </button>
              ))}
            </SpawnRow>
            <SpawnRow label="Monsters">
              {MONSTER_LABELS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  className="sandbox-spawn-btn"
                  onClick={() => spawn({ type: 'monster', monsterKind: kind })}
                >
                  {label}
                </button>
              ))}
            </SpawnRow>
            <SpawnRow label="Raids">
              {RAID_LABELS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  className="sandbox-spawn-btn"
                  onClick={() => spawn({ type: 'raid', raidKind: kind })}
                >
                  {label}
                </button>
              ))}
            </SpawnRow>
            <SpawnRow label="Undead">
              {UNDEAD_LABELS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  className="sandbox-spawn-btn"
                  onClick={() => spawn({ type: 'undead', undeadKind: kind })}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="sandbox-spawn-btn"
                onClick={() => spawn({ type: 'witch' })}
              >
                Witch
              </button>
            </SpawnRow>
            <SpawnRow label="Hire">
              {HIRE_CATALOG.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  className="sandbox-spawn-btn"
                  disabled={settings.units.kinds[item.role] === false}
                  onClick={() => spawn({ type: 'unit', role: item.role })}
                  title={
                    settings.units.kinds[item.role] === false
                      ? 'Enable this unit type below first'
                      : undefined
                  }
                >
                  {item.name}
                </button>
              ))}
            </SpawnRow>
          </>
        )}

        <h3 className="inspector-subhead">War &amp; raids</h3>
        <MultSlider
          label="Overall intensity"
          value={settings.war.intensity}
          onChange={(intensity) =>
            set({ ...settings, war: { ...settings.war, intensity } })
          }
        />
        <MultSlider
          label="Camp spawn rate"
          value={settings.war.campSpawnRate}
          onChange={(campSpawnRate) =>
            set({ ...settings, war: { ...settings.war, campSpawnRate } })
          }
        />
        <MultSlider
          label="Raid pressure"
          value={settings.war.raidPressure}
          onChange={(raidPressure) =>
            set({ ...settings, war: { ...settings.war, raidPressure } })
          }
        />
        <MultSlider
          label="Siege rate"
          value={settings.war.siegeRate}
          onChange={(siegeRate) =>
            set({ ...settings, war: { ...settings.war, siegeRate } })
          }
        />
        <MultSlider
          label="Garrison growth"
          value={settings.war.garrisonGrowth}
          onChange={(garrisonGrowth) =>
            set({ ...settings, war: { ...settings.war, garrisonGrowth } })
          }
        />
        <label className="sandbox-field">
          <span>
            Starter camps <strong>{settings.war.starterCampCount}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={settings.war.starterCampCount}
            onChange={(e) =>
              set({
                ...settings,
                war: {
                  ...settings.war,
                  starterCampCount: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <p className="sandbox-toggle-caption">Allow camp types</p>
        <div className="sandbox-toggles">
          {CAMP_LABELS.map(({ kind, label }) => (
            <label key={kind} className="sandbox-check">
              <input
                type="checkbox"
                checked={settings.war.kinds[kind]}
                onChange={(e) =>
                  set({
                    ...settings,
                    war: {
                      ...settings.war,
                      kinds: {
                        ...settings.war.kinds,
                        [kind]: e.target.checked,
                      },
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>

        <h3 className="inspector-subhead">Monsters</h3>
        <MultSlider
          label="Spawn rate"
          value={settings.monsters.spawnRate}
          onChange={(spawnRate) =>
            set({
              ...settings,
              monsters: { ...settings.monsters, spawnRate },
            })
          }
        />
        <MultSlider
          label="Hunger / hunt"
          value={settings.monsters.hungerHunt}
          onChange={(hungerHunt) =>
            set({
              ...settings,
              monsters: { ...settings.monsters, hungerHunt },
            })
          }
        />
        <p className="sandbox-toggle-caption">Allow monster types</p>
        <div className="sandbox-toggles">
          {MONSTER_LABELS.map(({ kind, label }) => (
            <label key={kind} className="sandbox-check">
              <input
                type="checkbox"
                checked={settings.monsters.kinds[kind]}
                onChange={(e) =>
                  set({
                    ...settings,
                    monsters: {
                      ...settings.monsters,
                      kinds: {
                        ...settings.monsters.kinds,
                        [kind]: e.target.checked,
                      },
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>

        <h3 className="inspector-subhead">Kingdom unit types</h3>
        <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.78rem' }}>
          Uncheck to hide from the marketplace and block hiring.
        </p>
        <div className="sandbox-toggles">
          {HIRE_CATALOG.map((item) => (
            <label key={item.role} className="sandbox-check">
              <input
                type="checkbox"
                checked={settings.units.kinds[item.role] !== false}
                onChange={(e) =>
                  set({
                    ...settings,
                    units: {
                      kinds: {
                        ...settings.units.kinds,
                        [item.role]: e.target.checked,
                      },
                    },
                  })
                }
              />
              {item.name}
            </label>
          ))}
        </div>

        <h3 className="inspector-subhead">Sickness</h3>
        <MultSlider
          label="Hunger rise"
          value={settings.sickness.hungerRise}
          onChange={(hungerRise) =>
            set({
              ...settings,
              sickness: { ...settings.sickness, hungerRise },
            })
          }
        />
        <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.78rem' }}>
          Default 25%. Hunger-sickness is also rare (~15% when very hungry); the
          sick can still eat and recover.
        </p>
        <label className="sandbox-field">
          <span>
            Sick at hunger <strong>{settings.sickness.sickAtHunger}</strong>
          </span>
          <input
            type="range"
            min={40}
            max={100}
            step={1}
            value={settings.sickness.sickAtHunger}
            onChange={(e) =>
              set({
                ...settings,
                sickness: {
                  ...settings.sickness,
                  sickAtHunger: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <MultSlider
          label="Witch curse rate"
          value={settings.sickness.witchCurse}
          onChange={(witchCurse) =>
            set({
              ...settings,
              sickness: { ...settings.sickness, witchCurse },
            })
          }
        />

        <h3 className="inspector-subhead">Undead</h3>
        <p className="sandbox-toggle-caption">Allow undead types</p>
        <div className="sandbox-toggles">
          {UNDEAD_LABELS.map(({ kind, label }) => (
            <label key={kind} className="sandbox-check">
              <input
                type="checkbox"
                checked={settings.undead.kinds[kind]}
                onChange={(e) =>
                  set({
                    ...settings,
                    undead: {
                      ...settings.undead,
                      kinds: {
                        ...settings.undead.kinds,
                        [kind]: e.target.checked,
                      },
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <MultSlider
          label="Vampire / castles"
          value={settings.undead.vampire}
          onChange={(vampire) =>
            set({ ...settings, undead: { ...settings.undead, vampire } })
          }
        />
        <MultSlider
          label="Necromancers"
          value={settings.undead.necromancer}
          onChange={(necromancer) =>
            set({
              ...settings,
              undead: { ...settings.undead, necromancer },
            })
          }
        />
        <MultSlider
          label="Ghosts"
          value={settings.undead.ghost}
          onChange={(ghost) =>
            set({ ...settings, undead: { ...settings.undead, ghost } })
          }
        />

        <h3 className="inspector-subhead">Kingdom life</h3>
        <label className="sandbox-check">
          <input
            type="checkbox"
            checked={settings.life.fgmAutoGrant}
            onChange={(e) =>
              set({
                ...settings,
                life: { ...settings.life, fgmAutoGrant: e.target.checked },
              })
            }
          />
          Fairy Godmother helps (auto-grant wishes when ready)
        </label>

        <h3 className="inspector-subhead">Buildings</h3>
        <MultSlider
          label="Wall HP"
          value={settings.buildings.wallHpMult}
          onChange={(wallHpMult) =>
            set({
              ...settings,
              buildings: { ...settings.buildings, wallHpMult },
            })
          }
          min={0.25}
          max={4}
          step={0.05}
        />

        <div className="sandbox-footer">
          <button type="button" className="inspector-close" onClick={onReset}>
            Reset to defaults
          </button>
          <button type="button" className="menu-action" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

import type { CampKind } from '../game/war/WarBalance';
import type { MonsterKind } from '../game/monsters/MonsterSystem';
import type { SandboxSettings } from './sandboxSettings';

interface SandboxSettingsPanelProps {
  settings: SandboxSettings;
  onChange: (next: SandboxSettings) => void;
  onReset: () => void;
  onClose: () => void;
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

export function SandboxSettingsPanel({
  settings,
  onChange,
  onReset,
  onClose,
}: SandboxSettingsPanelProps) {
  const set = (next: SandboxSettings) => onChange(next);

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
          100% is the tuned default; 0% turns a system off.
        </p>

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

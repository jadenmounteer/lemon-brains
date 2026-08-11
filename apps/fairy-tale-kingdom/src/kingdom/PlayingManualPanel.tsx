import { useEffect, useRef, useState } from 'react';
import { festivalManualEntries } from '../game/events/festivalRequirements';
import { WarBalance } from '../game/war/WarBalance';

const SECTIONS = [
  { id: 'subjects', label: 'Subjects' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'economy', label: 'Economy' },
  { id: 'careers', label: 'Careers' },
  { id: 'royalty', label: 'Royalty' },
  { id: 'combat', label: 'Combat & camps' },
  { id: 'encampments', label: 'Encampments' },
  { id: 'roads', label: 'Roads & bridges' },
  { id: 'spheres', label: 'Military spheres' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'security', label: 'Security & outbreaks' },
  { id: 'day', label: 'Day by day' },
] as const;

interface PlayingManualPanelProps {
  onClose: () => void;
}

export function PlayingManualPanel({ onClose }: PlayingManualPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const nodes = SECTIONS.map((s) => root.querySelector(`#manual-${s.id}`)).filter(
      Boolean
    ) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActive(visible.target.id.replace('manual-', ''));
        }
      },
      { root, threshold: [0.2, 0.5] }
    );
    for (const n of nodes) obs.observe(n);
    return () => obs.disconnect();
  }, []);

  const jump = (id: string) => {
    const el = scrollRef.current?.querySelector(`#manual-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const festivals = festivalManualEntries();

  return (
    <div className="manual-overlay" role="dialog" aria-label="Playing manual">
      <div className="manual-shell">
        <aside className="manual-glossary">
          <h2>Glossary</h2>
          <nav>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  active === s.id ? 'manual-gloss-link active' : 'manual-gloss-link'
                }
                onClick={() => jump(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <button type="button" className="inspector-close" onClick={onClose}>
            Close
          </button>
        </aside>
        <div className="manual-scroll-wrap">
          <div className="manual-scroll-cap" aria-hidden="true" />
          <div className="manual-scroll" ref={scrollRef}>
            <h1 className="manual-title">Kingdom Playing Manual</h1>
            <p className="manual-lede">
              A watchable fairy-tale realm: hire subjects, answer questions for gold,
              and defend your keep as the days grow harder.
            </p>

            <section id="manual-subjects">
              <h2>Subjects</h2>
              <p>
                Click any person to inspect health, hunger, happiness, job, workplace,
                thoughts, and schedule. Follow-cam zooms to them. Peasants work fields,
                bakeries, markets, and docks; soldiers and guards defend the realm.
              </p>
            </section>

            <section id="manual-buildings">
              <h2>Buildings</h2>
              <p>
                Buy and place houses (3 beds), manors (6 beds), granaries, fields,
                walls, taverns, barracks, dungeons, cathedrals, and more. Selecting a
                workplace lists who works there.
              </p>
            </section>

            <section id="manual-economy">
              <h2>Economy</h2>
              <p>
                Food comes from fields and (later) fishing. Meals lower hunger;
                festivals and events raise happiness. Low happiness risks defections.
              </p>
            </section>

            <section id="manual-careers">
              <h2>Careers</h2>
              <p>
                Subjects aspire to new roles. Use the To-Do panel to promote them when
                buildings have free capacity (guards need a dungeon; soldiers and
                archers need barracks).
              </p>
            </section>

            <section id="manual-royalty">
              <h2>Royalty</h2>
              <p>
                One king and queen rule the realm. Extra keeps seat dukes. Royal balls,
                weddings, and parades need the court. The Fairy Godmother may bless a
                peasant girl during a ball.
              </p>
            </section>

            <section id="manual-combat">
              <h2>Combat &amp; camps</h2>
              <p>
                Raids and sieges strike from frontier encampments. Hire a general at a
                barracks to command detachments against camps and monsters. Dragons
                fly over rivers; ground foes need bridges.
              </p>
            </section>

            <section id="manual-encampments">
              <h2>Encampments</h2>
              <p>
                Click a camp to see its leader, named roster, and who is home vs away.
                Leaders strategize and order raids when strong enough. Raids are
                staggered and random — camps do not all attack at once. Siege camps
                work the same way, with supply pools.
              </p>
            </section>

            <section id="manual-roads">
              <h2>Roads &amp; bridges</h2>
              <p>
                Place roads for patrols. Place bridges over rivers (press R to rotate)
                so units and ground monsters can cross. Dragons ignore water.
              </p>
            </section>

            <section id="manual-spheres">
              <h2>Military spheres</h2>
              <p>
                Barracks and dungeons project influence like keeps. Guards and soldiers
                patrol roads, walls, and buildings inside their sphere. They leave only
                for general orders, arrests, or emergency cordons — then return.
              </p>
            </section>

            <section id="manual-festivals">
              <h2>Festivals — how to unlock</h2>
              <p>
                Festivals only start when buildings and people match a type. If nothing
                qualifies, the realm waits.
              </p>
              <ul className="manual-list">
                {festivals.map((f) => (
                  <li key={f.kind}>
                    <strong>{f.title}</strong> — {f.blurb}
                    <br />
                    <span className="muted">
                      Buildings: {f.buildings}. Units: {f.units}.
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                Royal balls are separate and need a keep with king and queen. Watch
                celebrants dance, talk, cheer, and feast — speech bubbles appear above
                their heads.
              </p>
            </section>

            <section id="manual-security">
              <h2>Security &amp; outbreaks</h2>
              <p>
                During zombie outbreaks, raids, or sieges, guards cordon danger zones,
                urge civilians to flee to safety, and speak orders aloud. Soldiers
                clear zombies; guards arrest necromancers when a dungeon stands. After
                the crisis, cordons lift and troops resume sphere patrol.
              </p>
            </section>

            <section id="manual-day">
              <h2>How the game changes each day</h2>
              <p>
                Day {0}: soft early pressure — raids and sieges are rarer while your
                population is tiny, but never impossible. Camps still seed on the
                frontier.
              </p>
              <ul className="manual-list">
                <li>
                  Fringe camps: up to {WarBalance.maxCamps(0)} early, scaling toward{' '}
                  {WarBalance.maxCamps(40)} as days pass.
                </li>
                <li>
                  Siege camps: up to {WarBalance.maxSiegeCamps(0)} early, up to{' '}
                  {WarBalance.maxSiegeCamps(40)} late-game.
                </li>
                <li>
                  Stronger garrisons raid larger parties more often; leaders wait until
                  thresholds are met.
                </li>
                <li>
                  Wild monsters (trolls, ogres, dragons) appear more often on older
                  kingdoms.
                </li>
                <li>
                  Early pressure factor starts low (~
                  {Math.round(WarBalance.earlyPressureFactor(0, 0) * 100)}%) and rises
                  as days and population grow.
                </li>
              </ul>
            </section>
          </div>
          <div className="manual-scroll-cap bottom" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

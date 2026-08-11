import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getManualArt,
  getManualArtMap,
  subscribeManualArt,
} from './manual/manualArt';
import { buildManualSections, type ManualEntry } from './manual/manualContent';

function ManualArt({ artKey, title }: { artKey?: string; title: string }) {
  const src = artKey ? getManualArt(artKey) : undefined;
  if (!src) {
    return <div className="manual-art manual-art-missing" aria-hidden="true" />;
  }
  return (
    <div className="manual-art">
      <img src={src} alt="" title={title} className="manual-art-img" />
    </div>
  );
}

function EntryCard({ entry }: { entry: ManualEntry }) {
  return (
    <article className="manual-entry">
      <ManualArt artKey={entry.artKey} title={entry.title} />
      <div className="manual-entry-body">
        <h3>{entry.title}</h3>
        {entry.subtitle ? <p className="manual-entry-sub">{entry.subtitle}</p> : null}
        {entry.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}

interface PlayingManualPanelProps {
  onClose: () => void;
}

export function PlayingManualPanel({ onClose }: PlayingManualPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sections = useMemo(() => buildManualSections(), []);
  const [active, setActive] = useState<string>(sections[0]!.id);

  // Re-render when BootScene finishes exporting Phaser textures.
  useSyncExternalStore(subscribeManualArt, getManualArtMap, getManualArtMap);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const nodes = sections
      .map((s) => root.querySelector(`#manual-${s.id}`))
      .filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActive(visible.target.id.replace('manual-', ''));
        }
      },
      { root, threshold: [0.15, 0.4] }
    );
    for (const n of nodes) obs.observe(n);
    return () => obs.disconnect();
  }, [sections]);

  const jump = (id: string) => {
    const el = scrollRef.current?.querySelector(`#manual-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="manual-overlay" role="dialog" aria-label="Playing manual">
      <div className="manual-shell">
        <aside className="manual-glossary">
          <h2>Glossary</h2>
          <nav>
            {sections.map((s) => (
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
              A living fairy-tale atlas — every role, beast, building, and revel with
              its portrait, purpose, and the mischief it causes when you look away.
            </p>

            {sections.map((section) => (
              <section key={section.id} id={`manual-${section.id}`}>
                <h2>{section.label}</h2>
                {section.intro.map((p, i) => (
                  <p key={`intro-${i}`}>{p}</p>
                ))}
                {section.entries?.map((entry) => (
                  <EntryCard
                    key={`${section.id}-${entry.title}-${entry.artKey ?? ''}`}
                    entry={entry}
                  />
                ))}
                {section.outro?.map((p, i) => (
                  <p key={`outro-${i}`}>{p}</p>
                ))}
              </section>
            ))}
          </div>
          <div className="manual-scroll-cap bottom" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

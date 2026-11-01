import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ongoingEpisode } from './db';
import { DISCLAIMER, SAFETY_NOTE } from './options';
import { ONBOARDED_KEY, hasPin, storage } from './lock';
import { Home } from './screens/Home';
import { EpisodeForm } from './screens/EpisodeForm';
import { CheckIn } from './screens/CheckIn';
import { History } from './screens/History';
import { Insights } from './screens/Insights';
import { Report } from './screens/Report';
import { Settings } from './screens/Settings';
import { Lock } from './screens/Lock';

type Tab = 'home' | 'history' | 'insights' | 'report' | 'settings';
type Overlay = { kind: 'episode'; id: string } | { kind: 'checkin'; date: string } | null;

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'insights', label: 'Patterns' },
  { id: 'report', label: 'Report' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [locked, setLocked] = useState(hasPin());
  const [onboarded, setOnboarded] = useState(storage.get(ONBOARDED_KEY) === '1');
  const [tab, setTab] = useState<Tab>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const ongoing = useLiveQuery(ongoingEpisode, []);

  const close = useCallback(() => setOverlay(null), []);
  const openEpisode = useCallback((id: string) => setOverlay({ kind: 'episode', id }), []);
  const openCheckin = useCallback((date: string) => setOverlay({ kind: 'checkin', date }), []);

  // FR-1.7: dim, low-contrast "attack mode" while an episode is in progress.
  useEffect(() => {
    document.documentElement.classList.toggle('attack', !!ongoing);
  }, [ongoing]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, overlay]);

  if (locked) return <Lock onUnlock={() => setLocked(false)} />;

  if (!onboarded) {
    return (
      <div className="onboarding">
        <h1>Migraine Tracker</h1>
        <p>{DISCLAIMER}</p>
        <p>
          Log episodes and the things around them, see patterns in your own entries, and bring a clear record to your
          healthcare provider.
        </p>
        <p className="note">{SAFETY_NOTE}</p>
        <p className="muted small">Your entries stay on this device. Nothing is uploaded.</p>
        <button
          className="btn primary big"
          onClick={() => {
            storage.set(ONBOARDED_KEY, '1');
            setOnboarded(true);
          }}
        >
          I understand
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      {overlay ? (
        <main>
          {overlay.kind === 'episode' ? (
            <EpisodeForm key={overlay.id} id={overlay.id} onClose={close} />
          ) : (
            <CheckIn key={overlay.date} date={overlay.date} onClose={close} />
          )}
        </main>
      ) : (
        <>
          <header className="topbar no-print">
            <h1>{TABS.find((t) => t.id === tab)!.label}</h1>
          </header>
          <main>
            {tab === 'home' && <Home openEpisode={openEpisode} openCheckin={openCheckin} />}
            {tab === 'history' && <History openEpisode={openEpisode} openCheckin={openCheckin} />}
            {tab === 'insights' && <Insights />}
            {tab === 'report' && <Report />}
            {tab === 'settings' && <Settings onLockNow={() => setLocked(true)} />}
          </main>
          <nav className="tabbar no-print" aria-label="Main">
            {TABS.map((t) => (
              <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

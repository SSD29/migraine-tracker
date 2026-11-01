import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addReading, db, endEpisode, ongoingEpisode, startEpisode } from '../db';
import { fmtDateTime, fmtDuration, fmtTime, localDateKey } from '../dates';
import { durationHours, peakIntensity } from '../insights';
import { IntensityScale } from '../components/Chips';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

interface Props {
  openEpisode: (id: string) => void;
  openCheckin: (date: string) => void;
}

export function Home({ openEpisode, openCheckin }: Props) {
  const now = useNow();
  const today = localDateKey(now);
  const ongoing = useLiveQuery(ongoingEpisode, []);
  const checkin = useLiveQuery(() => db.checkins.get(today), [today]);
  const recent = useLiveQuery(() => db.episodes.orderBy('startAt').reverse().limit(3).toArray(), []) ?? [];

  if (ongoing === undefined) return null;

  const latest = ongoing?.readings.at(-1)?.value;

  return (
    <div className="screen">
      {ongoing ? (
        <section className="card ongoing" aria-live="polite">
          <h2>Migraine in progress</h2>
          <p className="muted">
            Since {fmtTime(ongoing.startAt)} ·{' '}
            {fmtDuration((now.getTime() - Date.parse(ongoing.startAt)) / 3_600_000)}
          </p>
          <div className="field">
            <span className="label">How strong is it now?</span>
            <IntensityScale value={latest} onPick={(n) => addReading(ongoing.id, n)} />
          </div>
          <div className="row">
            <button className="btn" onClick={() => openEpisode(ongoing.id)}>
              Add details
            </button>
            <button className="btn primary" onClick={() => endEpisode(ongoing.id)}>
              Migraine ended
            </button>
          </div>
        </section>
      ) : (
        <section className="start">
          <button className="btn big primary" onClick={() => startEpisode()}>
            Migraine started
          </button>
          <p className="muted center">Logs the start time now. You can add details later.</p>
          <button className="btn link" onClick={() => openEpisode('new')}>
            Log a past migraine
          </button>
        </section>
      )}

      <section className="card">
        <div className="row spread">
          <div>
            <h2>Today's check-in</h2>
            <p className="muted">
              {checkin ? 'Done. Tap to update.' : 'Sleep, stress, and anything notable. About 15 seconds.'}
            </p>
          </div>
          <button className="btn" onClick={() => openCheckin(today)}>
            {checkin ? 'Edit' : 'Check in'}
          </button>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2>Recent episodes</h2>
          <ul className="list">
            {recent.map((e) => (
              <li key={e.id}>
                <button className="list-item" onClick={() => openEpisode(e.id)}>
                  <span>{fmtDateTime(e.startAt)}</span>
                  <span className="muted">
                    {e.endAt ? fmtDuration(durationHours(e)) : 'ongoing'}
                    {peakIntensity(e) !== undefined && ` · peak ${peakIntensity(e)}/10`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addReading,
  confirmOngoing,
  db,
  endEpisode,
  needsStillGoingCheck,
  ongoingEpisode,
  startEpisode,
} from '../db';
import { fmtDateTime, fmtDuration, fmtSince, fromInputValue, localDateKey, nowIso, toInputValue } from '../dates';
import { durationHours, peakIntensity } from '../insights';
import { IntensityScale } from '../components/Chips';
import { attachEpisodeWeather } from '../weather';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Asked once a day while an episode stays open, so a forgotten one doesn't keep counting days. */
function StillGoing({ id, startAt }: { id: string; startAt: string }) {
  const [endAt, setEndAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  const saveEnd = async () => {
    if (!endAt) return;
    if (Date.parse(endAt) <= Date.parse(startAt) || Date.parse(endAt) > Date.now()) {
      setError('Pick a time after it started and not in the future.');
      return;
    }
    await endEpisode(id, endAt);
  };

  return (
    <div className="still-going" role="group" aria-label="Is this migraine still going?">
      <p>
        <strong>Is it still going?</strong> If it already ended, set when.
      </p>
      {endAt === null ? (
        <div className="row wrap">
          <button className="btn" onClick={() => confirmOngoing(id)}>
            Yes, still going
          </button>
          <button className="btn" onClick={() => setEndAt(nowIso())}>
            It ended at…
          </button>
        </div>
      ) : (
        <>
          <label className="field">
            <span className="label">Ended</span>
            <input
              type="datetime-local"
              min={toInputValue(startAt)}
              max={toInputValue(nowIso())}
              value={toInputValue(endAt)}
              onChange={(e) => e.target.value && setEndAt(fromInputValue(e.target.value))}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button className="btn" onClick={() => setEndAt(null)}>
              Back
            </button>
            <button className="btn primary" onClick={saveEnd}>
              Save end time
            </button>
          </div>
        </>
      )}
    </div>
  );
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
            Since {fmtSince(ongoing.startAt, now)} ·{' '}
            {fmtDuration((now.getTime() - Date.parse(ongoing.startAt)) / 3_600_000)}
          </p>
          {needsStillGoingCheck(ongoing, now) && <StillGoing id={ongoing.id} startAt={ongoing.startAt} />}
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
          <button className="btn big primary" onClick={() => startEpisode().then((e) => attachEpisodeWeather(e.id))}>
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

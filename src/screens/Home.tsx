import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addReading,
  confirmOngoing,
  db,
  discardEpisode,
  endEpisode,
  needsStillGoingCheck,
  ongoingEpisode,
  startEpisode,
} from '../db';
import {
  addDays,
  fmtDate,
  fmtDuration,
  fmtSince,
  fromInputValue,
  localDateKey,
  nowIso,
  parseDateKey,
  toInputValue,
} from '../dates';
import { attackDayMap, intensityBand, monthRange, summarize } from '../insights';
import { IntensityScale } from '../components/Chips';
import { EpisodeItem } from '../components/EpisodeItem';
import { Icon } from '../components/Icon';
import { attachEpisodeWeather } from '../weather';

const UNDO_MS = 8_000;

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
  const [undoId, setUndoId] = useState<string | null>(null);

  // The undo offer disappears after a few seconds; "Remove" on the card stays available.
  useEffect(() => {
    if (!undoId) return;
    const t = setTimeout(() => setUndoId(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undoId]);

  const start = async () => {
    const e = await startEpisode();
    setUndoId(e.id);
    attachEpisodeWeather(e.id);
  };

  const undo = async () => {
    if (undoId) await discardEpisode(undoId);
    setUndoId(null);
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this migraine entry? Anything you added to it will be deleted.')) return;
    await discardEpisode(id);
  };

  if (ongoing === undefined) return null;

  const latest = ongoing?.readings.at(-1)?.value;

  return (
    <div className="screen">
      {ongoing ? (
        <section className="card ongoing" aria-live="polite">
          <div className="ongoing-head">
            <span className="live-dot" aria-hidden />
            <span className="eyebrow">Migraine in progress</span>
          </div>
          <div className="timer">{fmtDuration((now.getTime() - Date.parse(ongoing.startAt)) / 3_600_000)}</div>
          <p className="muted">Started {fmtSince(ongoing.startAt, now)}</p>
          {needsStillGoingCheck(ongoing, now) && <StillGoing id={ongoing.id} startAt={ongoing.startAt} />}
          <div className="field">
            <span className="label">How strong is it now?</span>
            <IntensityScale value={latest} onPick={(n) => addReading(ongoing.id, n)} />
          </div>
          <div className="stack">
            <button className="btn primary" onClick={() => endEpisode(ongoing.id)}>
              <Icon name="stop" size={18} /> Migraine ended
            </button>
            <button className="btn" onClick={() => openEpisode(ongoing.id)}>
              <Icon name="pen" size={18} /> Add details
            </button>
            <button className="btn quiet small" onClick={() => remove(ongoing.id)}>
              Started by mistake? Remove it
            </button>
          </div>
        </section>
      ) : (
        <section className="start">
          <button className="hero" onClick={start}>
            <span className="hero-icon">
              <Icon name="plus" size={30} />
            </span>
            <span className="hero-text">
              <span className="hero-title">Migraine started</span>
              <span className="hero-sub">Logs the time now. Add details whenever you're ready.</span>
            </span>
          </button>
          <button className="btn quiet" onClick={() => openEpisode('new')}>
            <Icon name="clock" size={18} /> Log a past migraine
          </button>
        </section>
      )}

      {undoId && ongoing?.id === undoId && (
        <div className="toast" role="status">
          <span>Migraine started at {fmtSince(ongoing.startAt, now)}</span>
          <button className="btn small" onClick={undo}>
            Undo
          </button>
        </div>
      )}

      <WeekStrip now={now} />

      <button className="card tile" onClick={() => openCheckin(today)}>
        <span className={`tile-icon ${checkin ? 'done' : ''}`}>
          <Icon name={checkin ? 'check' : 'checkin'} />
        </span>
        <span className="tile-text">
          <span className="tile-title">{checkin ? 'Checked in today' : "Today's check-in"}</span>
          <span className="tile-sub">
            {checkin ? 'Tap to review or update.' : 'Sleep, stress, and anything notable. About 15 seconds.'}
          </span>
        </span>
        <Icon name="chevronRight" size={18} className="tile-chevron" />
      </button>

      {recent.length > 0 && (
        <section className="card">
          <h2 className="section-title">Recent episodes</h2>
          <ul className="ep-list">
            {recent.map((e) => (
              <EpisodeItem key={e.id} episode={e} onOpen={() => openEpisode(e.id)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The last seven days at a glance, plus this month's counts. */
function WeekStrip({ now }: { now: Date }) {
  const episodes = useLiveQuery(() => db.episodes.toArray(), []) ?? [];
  const today = localDateKey(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const map = attackDayMap(episodes, now);
  const { from, to } = monthRange(now.getFullYear(), now.getMonth());
  const month = summarize(episodes, from, to, now);

  return (
    <section className="card">
      <div className="row spread">
        <h2 className="section-title">Last 7 days</h2>
        <span className="muted small">
          {month.attackDays} migraine {month.attackDays === 1 ? 'day' : 'days'} this month
        </span>
      </div>
      <ol className="week" aria-label="Last 7 days">
        {days.map((d) => {
          const has = map.has(d);
          const peak = map.get(d);
          return (
            <li key={d} className={`week-day ${d === today ? 'is-today' : ''}`}>
              <span className="week-label">{parseDateKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <span
                className={`week-dot ${has ? `band-${intensityBand(peak)}` : ''}`}
                aria-label={`${fmtDate(d)}: ${has ? `migraine${peak !== undefined ? `, peak ${peak}` : ''}` : 'no migraine'}`}
              >
                {parseDateKey(d).getDate()}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

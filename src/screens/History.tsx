import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fmtDate, localDateKey } from '../dates';
import { attackDayMap, episodeDays, intensityBand, peakIntensity } from '../insights';
import { useFactors } from '../components/FactorPicker';
import { EpisodeItem } from '../components/EpisodeItem';
import { Icon } from '../components/Icon';
import type { Episode } from '../types';

interface Props {
  openEpisode: (id: string) => void;
  openCheckin: (date: string) => void;
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function History({ openEpisode, openCheckin }: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const episodes = useLiveQuery(() => db.episodes.orderBy('startAt').reverse().toArray(), []) ?? [];

  return (
    <div className="screen">
      <div className="segmented" role="tablist" aria-label="History view">
        <button role="tab" aria-selected={view === 'calendar'} onClick={() => setView('calendar')}>
          Calendar
        </button>
        <button role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>
          List
        </button>
      </div>
      {view === 'calendar' ? (
        <Calendar episodes={episodes} openEpisode={openEpisode} openCheckin={openCheckin} />
      ) : (
        <EpisodeList episodes={episodes} openEpisode={openEpisode} />
      )}
    </div>
  );
}

function Calendar({ episodes, openEpisode, openCheckin }: { episodes: Episode[] } & Props) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [picked, setPicked] = useState<string | null>(null);
  const dayMap = useMemo(() => attackDayMap(episodes), [episodes]);
  const checkinDates = useLiveQuery(() => db.checkins.toCollection().primaryKeys(), []) ?? [];

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => localDateKey(new Date(cursor.y, cursor.m, i + 1))),
  ];
  const todayKey = localDateKey(today);
  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setPicked(null);
  };

  const pickedEpisodes = picked ? episodes.filter((e) => episodeDays(e).includes(picked)) : [];

  return (
    <section className="card">
      <div className="row spread">
        <button className="btn icon" aria-label="Previous month" onClick={() => move(-1)}>
          <Icon name="chevronLeft" size={20} />
        </button>
        <h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button className="btn icon" aria-label="Next month" onClick={() => move(1)}>
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
      <div className="calendar" role="grid">
        {WEEK.map((d) => (
          <div key={d} className="cal-head" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`blank-${i}`} />;
          const attack = dayMap.has(key);
          const peak = dayMap.get(key);
          const label = `${fmtDate(key)}${attack ? `, migraine${peak !== undefined ? `, peak ${peak} of 10` : ''}` : ''}`;
          return (
            <button
              key={key}
              role="gridcell"
              aria-label={label}
              aria-selected={picked === key}
              className={`cal-day ${attack ? `band-${intensityBand(peak)}` : ''} ${key === todayKey ? 'today' : ''}`}
              disabled={key > todayKey}
              onClick={() => setPicked(key)}
            >
              {Number(key.slice(8))}
              {checkinDates.includes(key) && <span className="dot" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="legend" aria-label="Legend">
        <span><i className="swatch band-mild" /> 1–3</span>
        <span><i className="swatch band-moderate" /> 4–6</span>
        <span><i className="swatch band-severe" /> 7–10</span>
        <span><i className="swatch band-unrated" /> not rated</span>
        <span><i className="dot inline" /> check-in</span>
      </div>

      {picked && (
        <div className="picked">
          <h3>{fmtDate(picked)}</h3>
          {pickedEpisodes.length === 0 && <p className="muted">No migraine logged.</p>}
          <ul className="ep-list">
            {pickedEpisodes.map((e) => (
              <EpisodeItem key={e.id} episode={e} onOpen={() => openEpisode(e.id)} />
            ))}
          </ul>
          <button className="btn" onClick={() => openCheckin(picked)}>
            {checkinDates.includes(picked) ? 'Edit check-in' : 'Add check-in'}
          </button>
        </div>
      )}
    </section>
  );
}

function EpisodeList({ episodes, openEpisode }: { episodes: Episode[]; openEpisode: (id: string) => void }) {
  const factors = useFactors();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minPeak, setMinPeak] = useState(0);
  const [aura, setAura] = useState<'' | 'yes' | 'no'>('');
  const [factorId, setFactorId] = useState('');

  const filtered = episodes.filter((e) => {
    const day = localDateKey(new Date(e.startAt));
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (minPeak && (peakIntensity(e) ?? -1) < minPeak) return false;
    if (aura === 'yes' && e.aura !== 'yes') return false;
    if (aura === 'no' && e.aura === 'yes') return false;
    if (factorId && !e.factorIds.includes(factorId)) return false;
    return true;
  });

  return (
    <>
      <details className="card filters">
        <summary>Filters</summary>
        <div className="grid2">
          <label className="field">
            <span className="label">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Peak at least</span>
            <select value={minPeak} onChange={(e) => setMinPeak(Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'Any' : `${n}/10`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Aura</span>
            <select value={aura} onChange={(e) => setAura(e.target.value as typeof aura)}>
              <option value="">Any</option>
              <option value="yes">With aura</option>
              <option value="no">Without aura</option>
            </select>
          </label>
          <label className="field wide">
            <span className="label">Factor</span>
            <select value={factorId} onChange={(e) => setFactorId(e.target.value)}>
              <option value="">Any</option>
              {factors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <section className="card">
        <h2 className="section-title">
          {filtered.length} {filtered.length === 1 ? 'episode' : 'episodes'}
        </h2>
        {filtered.length === 0 ? (
          <p className="muted">Nothing logged{episodes.length ? ' matches these filters' : ' yet'}.</p>
        ) : (
          <ul className="ep-list">
            {filtered.map((e) => (
              <EpisodeItem key={e.id} episode={e} onOpen={() => openEpisode(e.id)} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

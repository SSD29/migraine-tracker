import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addDays, fmtDateTime, fmtDuration, localDateKey, parseDateKey } from '../dates';
import { AURA, IMPACTS, RELIEF_RATINGS, SYMPTOMS, DISCLAIMER, labelOf } from '../options';
import { durationHours, insightsReadiness, peakIntensity, summarize } from '../insights';
import { checkinsCsv, downloadFile, episodesCsv } from '../csv';
import { useFactors } from '../components/FactorPicker';
import { FactorTable } from './Insights';

const longDate = (key: string) => parseDateKey(key).toLocaleDateString(undefined, { dateStyle: 'medium' });

/** FR-5: a printable summary for appointments, plus raw CSV export. */
export function Report() {
  const today = localDateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);
  const factors = useFactors();
  const all = useLiveQuery(() => db.episodes.orderBy('startAt').toArray(), []) ?? [];
  const allCheckins = useLiveQuery(() => db.checkins.toArray(), []) ?? [];

  const inRange = (key: string) => key >= from && key <= to;
  const episodes = all.filter((e) => inRange(localDateKey(new Date(e.startAt))));
  const checkins = allCheckins.filter((c) => inRange(c.date));
  const s = summarize(all, from, to);
  const factorName = (id: string) => factors.find((f) => f.id === id)?.name ?? 'Deleted factor';
  const ready = insightsReadiness(episodes, checkins).ready;

  return (
    <div className="screen report">
      <section className="card no-print">
        <h2>Report for your appointment</h2>
        <div className="grid2">
          <label className="field">
            <span className="label">From</span>
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">To</span>
            <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button
            className="btn"
            onClick={() => downloadFile(`migraine-episodes-${from}-to-${to}.csv`, episodesCsv(episodes, factors), 'text/csv')}
          >
            Episodes CSV
          </button>
          <button
            className="btn"
            onClick={() => downloadFile(`migraine-checkins-${from}-to-${to}.csv`, checkinsCsv(checkins, factors), 'text/csv')}
          >
            Check-ins CSV
          </button>
        </div>
        <p className="muted small">Files are created on this device. You choose where to send them.</p>
      </section>

      <article className="printable">
        <h1>Migraine record</h1>
        <p className="muted">
          {longDate(from)} to {longDate(to)} · generated {fmtDateTime(new Date().toISOString())}
        </p>

        <h2>Summary</h2>
        <table className="table">
          <tbody>
            <tr><th scope="row">Episodes started</th><td className="num">{s.episodes}</td></tr>
            <tr><th scope="row">Days with a migraine</th><td className="num">{s.attackDays} of {s.daysCovered}</td></tr>
            <tr><th scope="row">Average duration (completed episodes)</th><td className="num">{fmtDuration(s.avgDurationHours)}</td></tr>
            <tr><th scope="row">Average peak intensity</th><td className="num">{s.avgPeak === undefined ? '—' : `${s.avgPeak.toFixed(1)}/10`}</td></tr>
            <tr><th scope="row">Episodes with aura</th><td className="num">{episodes.filter((e) => e.aura === 'yes').length}</td></tr>
            <tr><th scope="row">Daily check-ins</th><td className="num">{checkins.length}</td></tr>
          </tbody>
        </table>

        <h2>Episodes</h2>
        {episodes.length === 0 ? (
          <p className="muted">No episodes in this range.</p>
        ) : (
          <div className="table-wrap">
            <table className="table episodes">
              <thead>
                <tr>
                  <th scope="col">Start</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Peak</th>
                  <th scope="col">Aura</th>
                  <th scope="col">Symptoms</th>
                  <th scope="col">Impact</th>
                  <th scope="col">Relief (as entered)</th>
                  <th scope="col">Factors before</th>
                </tr>
              </thead>
              <tbody>
                {[...episodes].reverse().map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDateTime(e.startAt)}</td>
                    <td>{e.endAt ? fmtDuration(durationHours(e)) : 'ongoing'}</td>
                    <td>{peakIntensity(e) ?? '—'}</td>
                    <td>{labelOf(AURA, e.aura) || '—'}</td>
                    <td>{e.symptoms.map((v) => labelOf(SYMPTOMS, v)).join(', ') || '—'}</td>
                    <td>{labelOf(IMPACTS, e.impact) || '—'}</td>
                    <td>
                      {e.relief.length
                        ? e.relief.map((r) => `${r.item}${r.rating ? ` (${labelOf(RELIEF_RATINGS, r.rating).toLowerCase()})` : ''}`).join('; ')
                        : '—'}
                    </td>
                    <td>{e.factorIds.map(factorName).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Factors logged before episodes</h2>
        {ready ? (
          <FactorTable episodes={episodes} checkins={checkins} factors={factors} />
        ) : (
          <p className="muted">Not enough entries in this range to summarize factors.</p>
        )}

        <p className="footer-note">{DISCLAIMER} Patterns shown reflect the user's own entries and are not causes.</p>
      </article>
    </div>
  );
}

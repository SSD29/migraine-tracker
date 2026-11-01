import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fmtDuration } from '../dates';
import { INSIGHT_NOTE } from '../options';
import {
  MIN_DAYS,
  MIN_EPISODES,
  PRESSURE_SWING_HPA,
  TIMES_OF_DAY,
  WEEKDAYS,
  factorFrequency,
  insightsReadiness,
  monthRange,
  startPatterns,
  summarize,
  weatherStats,
} from '../insights';
import { weatherEnabled } from '../weather';
import { useFactors } from '../components/FactorPicker';
import type { DailyCheckin, Episode, Factor } from '../types';

export function Insights() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const episodes = useLiveQuery(() => db.episodes.toArray(), []) ?? [];
  const checkins = useLiveQuery(() => db.checkins.toArray(), []) ?? [];
  const factors = useFactors();

  const { from, to } = monthRange(cursor.y, cursor.m);
  const s = summarize(episodes, from, to, now);
  const readiness = insightsReadiness(episodes, checkins, now);
  const patterns = startPatterns(episodes);
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="screen">
      <p className="note">{INSIGHT_NOTE}</p>

      <section className="card">
        <div className="row spread">
          <button className="btn icon" aria-label="Previous month" onClick={() => move(-1)}>
            ‹
          </button>
          <h2>{new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button className="btn icon" aria-label="Next month" onClick={() => move(1)} disabled={isCurrentMonth}>
            ›
          </button>
        </div>
        <div className="stats">
          <Stat value={s.attackDays} label="days with a migraine" />
          <Stat value={s.headacheFreeDays} label={isCurrentMonth ? 'migraine-free days so far' : 'migraine-free days'} />
          <Stat value={fmtDuration(s.avgDurationHours)} label="average duration" />
          <Stat value={s.avgPeak === undefined ? '—' : `${s.avgPeak.toFixed(1)}/10`} label="average peak intensity" />
        </div>
      </section>

      <section className="card">
        <h2>Factors logged before episodes</h2>
        {readiness.ready ? (
          <FactorTable episodes={episodes} checkins={checkins} factors={factors} />
        ) : (
          <p className="muted">
            This appears after at least {MIN_EPISODES} episodes and {MIN_DAYS} days of entries, so there is enough to
            look at. So far: {readiness.episodes} {readiness.episodes === 1 ? 'episode' : 'episodes'} over{' '}
            {readiness.days} {readiness.days === 1 ? 'day' : 'days'}.
          </p>
        )}
      </section>

      {(weatherEnabled() || episodes.some((e) => e.weather)) && (
        <section className="card">
          <h2>Air pressure before episodes</h2>
          {readiness.ready ? (
            <WeatherPatterns episodes={episodes} checkins={checkins} />
          ) : (
            <p className="muted">This appears once there is enough data, as above.</p>
          )}
        </section>
      )}

      <section className="card">
        <h2>When episodes started</h2>
        {episodes.length === 0 ? (
          <p className="muted">No episodes logged yet.</p>
        ) : (
          <div className="grid2">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="num">Episodes</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <tr key={d}>
                    <td>{WEEKDAYS[d]}</td>
                    <td className="num">{patterns.byWeekday[d]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Time of day</th>
                  <th scope="col" className="num">Episodes</th>
                </tr>
              </thead>
              <tbody>
                {TIMES_OF_DAY.map((t, i) => (
                  <tr key={t.label}>
                    <td>{t.label}</td>
                    <td className="num">{patterns.byTime[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function WeatherPatterns({ episodes, checkins }: { episodes: Episode[]; checkins: DailyCheckin[] }) {
  const w = weatherStats(episodes, checkins);
  if (w.episodesWithWeather === 0) return <p className="muted">No weather has been recorded with your episodes yet.</p>;
  const free = (n: number) =>
    w.checkinDaysWithWeather > 0 && (
      <span className="muted">
        {' '}
        · on {n} of {w.checkinDaysWithWeather} check-in days without a migraine
      </span>
    );
  return (
    <>
      <ul className="factor-stats">
        <li>
          Pressure <strong>fell</strong> by {PRESSURE_SWING_HPA} hPa or more in the 24 hours before {w.episodesFell} of{' '}
          {w.episodesWithWeather} episodes with weather{free(w.checkinDaysFell)}
        </li>
        <li>
          Pressure <strong>rose</strong> by {PRESSURE_SWING_HPA} hPa or more in the 24 hours before {w.episodesRose} of{' '}
          {w.episodesWithWeather} episodes with weather{free(w.checkinDaysRose)}
        </li>
      </ul>
      <p className="muted small">{INSIGHT_NOTE}</p>
    </>
  );
}

interface FactorTableProps {
  episodes: Episode[];
  checkins: DailyCheckin[];
  factors: Factor[];
}

export function FactorTable({ episodes, checkins, factors }: FactorTableProps) {
  const stats = factorFrequency(episodes, checkins, factors);
  if (stats.length === 0) return <p className="muted">No factors were logged with your episodes.</p>;
  return (
    <>
      <ul className="factor-stats">
        {stats.map((s) => (
          <li key={s.factor.id}>
            <strong>{s.factor.name}</strong> was logged before {s.episodesWith} of {s.totalEpisodes} episodes
            {s.totalCheckinDays > 0 && (
              <span className="muted">
                {' '}
                · on {s.checkinDaysWith} of {s.totalCheckinDays} check-in days without a migraine
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">{INSIGHT_NOTE}</p>
    </>
  );
}

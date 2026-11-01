import type { DailyCheckin, Episode, Factor } from './types';
import { addDays, localDateKey, parseDateKey } from './dates';

// FR-4.2: factor frequency appears only once there is enough data to be worth reading.
export const MIN_EPISODES = 10;
export const MIN_DAYS = 30;

// Guards against a forgotten open episode filling the calendar.
const MAX_EPISODE_DAYS = 14;

export const peakIntensity = (e: Episode) =>
  e.readings.length ? Math.max(...e.readings.map((r) => r.value)) : undefined;

export const durationHours = (e: Episode) =>
  e.endAt ? (Date.parse(e.endAt) - Date.parse(e.startAt)) / 3_600_000 : undefined;

/** Local calendar days an episode touches, start through end (or now, if ongoing). */
export function episodeDays(e: Episode, now = new Date()): string[] {
  const first = localDateKey(new Date(e.startAt));
  const last = localDateKey(e.endAt ? new Date(e.endAt) : now);
  const days = [first];
  while (days.length < MAX_EPISODE_DAYS && days[days.length - 1] < last) {
    days.push(addDays(days[days.length - 1], 1));
  }
  return days;
}

/** Each attack day → the highest peak intensity logged that day (undefined if none rated). */
export function attackDayMap(episodes: Episode[], now = new Date()) {
  const map = new Map<string, number | undefined>();
  for (const e of episodes) {
    const peak = peakIntensity(e);
    for (const day of episodeDays(e, now)) {
      const prev = map.get(day);
      map.set(day, prev === undefined ? peak : peak === undefined ? prev : Math.max(prev, peak));
    }
  }
  return map;
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

export interface PeriodSummary {
  episodes: number;
  attackDays: number;
  headacheFreeDays: number;
  daysCovered: number;
  avgDurationHours?: number;
  avgPeak?: number;
}

/** Counts for the local dates [from, to], inclusive; days after `now` are not counted. */
export function summarize(episodes: Episode[], from: string, to: string, now = new Date()): PeriodSummary {
  const today = localDateKey(now);
  const end = to < today ? to : today;
  let daysCovered = 0;
  for (let d = from; d <= end; d = addDays(d, 1)) daysCovered++;

  const days = attackDayMap(episodes, now);
  const attackDays = [...days.keys()].filter((k) => k >= from && k <= end).length;
  const started = episodes.filter((e) => {
    const k = localDateKey(new Date(e.startAt));
    return k >= from && k <= to;
  });

  return {
    episodes: started.length,
    attackDays,
    headacheFreeDays: Math.max(0, daysCovered - attackDays),
    daysCovered,
    avgDurationHours: average(started.map(durationHours).filter((h): h is number => h !== undefined)),
    avgPeak: average(started.map(peakIntensity).filter((p): p is number => p !== undefined)),
  };
}

export function monthRange(year: number, month: number) {
  const from = localDateKey(new Date(year, month, 1));
  const to = localDateKey(new Date(year, month + 1, 0));
  return { from, to };
}

/** Whether enough has been logged to show factor frequency (FR-4.2). */
export function insightsReadiness(episodes: Episode[], checkins: DailyCheckin[], now = new Date()) {
  const keys = [
    ...episodes.map((e) => localDateKey(new Date(e.startAt))),
    ...checkins.map((c) => c.date),
  ].sort();
  const days = keys.length
    ? Math.round((parseDateKey(localDateKey(now)).getTime() - parseDateKey(keys[0]).getTime()) / 86_400_000) + 1
    : 0;
  return {
    episodes: episodes.length,
    days,
    ready: episodes.length >= MIN_EPISODES && days >= MIN_DAYS,
  };
}

export interface FactorStat {
  factor: Factor;
  episodesWith: number;
  totalEpisodes: number;
  checkinDaysWith: number; // check-in days without a migraine on which the factor was logged
  totalCheckinDays: number;
}

/**
 * How often each factor was logged before an episode, next to how often it was logged on
 * check-in days without a migraine. Descriptive counts only — never a cause.
 * A factor counts for an episode if it was attached to the episode, or logged in the
 * check-in for the day the episode started or the day before.
 */
export function factorFrequency(
  episodes: Episode[],
  checkins: DailyCheckin[],
  factors: Factor[],
  now = new Date(),
): FactorStat[] {
  const checkinByDate = new Map(checkins.map((c) => [c.date, c]));
  const episodeFactors = episodes.map((e) => {
    const start = localDateKey(new Date(e.startAt));
    return new Set([
      ...e.factorIds,
      ...(checkinByDate.get(start)?.factorIds ?? []),
      ...(checkinByDate.get(addDays(start, -1))?.factorIds ?? []),
    ]);
  });
  const attackDays = attackDayMap(episodes, now);
  const freeCheckins = checkins.filter((c) => !attackDays.has(c.date));

  return factors
    .map((factor) => ({
      factor,
      episodesWith: episodeFactors.filter((s) => s.has(factor.id)).length,
      totalEpisodes: episodes.length,
      checkinDaysWith: freeCheckins.filter((c) => c.factorIds.includes(factor.id)).length,
      totalCheckinDays: freeCheckins.length,
    }))
    .filter((s) => s.episodesWith > 0)
    .sort((a, b) => b.episodesWith - a.episodesWith || a.factor.name.localeCompare(b.factor.name));
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const TIMES_OF_DAY = [
  { label: 'Night (midnight–6 am)', from: 0 },
  { label: 'Morning (6 am–noon)', from: 6 },
  { label: 'Afternoon (noon–6 pm)', from: 12 },
  { label: 'Evening (6 pm–midnight)', from: 18 },
];

/** FR-4.3: when episodes started, by weekday and time of day. */
export function startPatterns(episodes: Episode[]) {
  const byWeekday = WEEKDAYS.map(() => 0);
  const byTime = TIMES_OF_DAY.map(() => 0);
  for (const e of episodes) {
    const d = new Date(e.startAt);
    byWeekday[d.getDay()]++;
    byTime[Math.floor(d.getHours() / 6)]++;
  }
  return { byWeekday, byTime };
}

/** Intensity band used for calendar shading. */
export function intensityBand(peak: number | undefined): 'unrated' | 'mild' | 'moderate' | 'severe' {
  if (peak === undefined) return 'unrated';
  if (peak <= 3) return 'mild';
  if (peak <= 6) return 'moderate';
  return 'severe';
}

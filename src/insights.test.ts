import { describe, expect, it } from 'vitest';
import { blankCheckin, blankEpisode } from './db';
import {
  attackDayMap,
  episodeDays,
  factorFrequency,
  insightsReadiness,
  intensityBand,
  startPatterns,
  summarize,
} from './insights';
import type { Episode, Factor } from './types';

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

function episode(start: string, end: string | null, peaks: number[] = [], factorIds: string[] = []): Episode {
  return {
    ...blankEpisode(start),
    endAt: end,
    readings: peaks.map((value) => ({ at: start, value })),
    factorIds,
  };
}

const factor = (id: string, name: string): Factor => ({
  id,
  name,
  category: 'Other',
  isCustom: false,
  hidden: false,
  order: 0,
});

describe('episodeDays', () => {
  it('covers each local day from start to end', () => {
    const e = episode(at(2026, 10, 3, 22), at(2026, 10, 5, 2));
    expect(episodeDays(e)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05']);
  });

  it('runs to now for an ongoing episode, capped at 14 days', () => {
    const e = episode(at(2026, 10, 1), null);
    expect(episodeDays(e, new Date(2026, 9, 2, 12))).toEqual(['2026-10-01', '2026-10-02']);
    expect(episodeDays(e, new Date(2026, 11, 1))).toHaveLength(14);
  });
});

describe('attackDayMap', () => {
  it('keeps the highest peak per day and ignores unrated episodes for the peak', () => {
    const map = attackDayMap([
      episode(at(2026, 10, 3, 8), at(2026, 10, 3, 10), [4]),
      episode(at(2026, 10, 3, 18), at(2026, 10, 3, 20), [7]),
      episode(at(2026, 10, 4, 8), at(2026, 10, 4, 9)),
    ]);
    expect(map.get('2026-10-03')).toBe(7);
    expect(map.has('2026-10-04')).toBe(true);
    expect(map.get('2026-10-04')).toBeUndefined();
  });
});

describe('summarize', () => {
  const now = new Date(2026, 9, 31, 12);

  it('counts attack days, free days, average duration and peak', () => {
    const s = summarize(
      [
        episode(at(2026, 10, 3, 8), at(2026, 10, 3, 12), [6]),
        episode(at(2026, 10, 10, 8), at(2026, 10, 10, 10), [8]),
      ],
      '2026-10-01',
      '2026-10-31',
      now,
    );
    expect(s).toMatchObject({ episodes: 2, attackDays: 2, headacheFreeDays: 29, daysCovered: 31 });
    expect(s.avgDurationHours).toBe(3);
    expect(s.avgPeak).toBe(7);
  });

  it('does not count days after today', () => {
    const s = summarize([], '2026-10-01', '2026-10-31', new Date(2026, 9, 10, 12));
    expect(s.daysCovered).toBe(10);
    expect(s.headacheFreeDays).toBe(10);
  });
});

describe('insightsReadiness', () => {
  it('needs 10 episodes and 30 days of data', () => {
    const now = new Date(2026, 9, 31, 12);
    const nine = Array.from({ length: 9 }, (_, i) => episode(at(2026, 9, 1 + i), at(2026, 9, 1 + i, 11)));
    expect(insightsReadiness(nine, [], now).ready).toBe(false);
    const ten = [...nine, episode(at(2026, 10, 20), at(2026, 10, 20, 11))];
    expect(insightsReadiness(ten, [], now)).toMatchObject({ ready: true, episodes: 10 });
    expect(insightsReadiness(ten, [], new Date(2026, 8, 20)).ready).toBe(false);
  });
});

describe('factorFrequency', () => {
  it('counts factors on the episode or in the check-in that day or the day before', () => {
    const wine = factor('wine', 'Red wine');
    const sleep = factor('sleep', 'Poor sleep');
    const unused = factor('noise', 'Loud noise');
    const episodes = [
      episode(at(2026, 10, 3), at(2026, 10, 3, 12), [], ['wine']),
      episode(at(2026, 10, 8), at(2026, 10, 8, 12)),
    ];
    const checkins = [
      { ...blankCheckin('2026-10-07'), factorIds: ['sleep'] }, // day before episode 2
      { ...blankCheckin('2026-10-15'), factorIds: ['wine'] }, // migraine-free day
      { ...blankCheckin('2026-10-16'), factorIds: [] },
    ];
    const stats = factorFrequency(episodes, checkins, [wine, sleep, unused], new Date(2026, 9, 31));

    expect(stats.map((s) => s.factor.id)).toEqual(['sleep', 'wine']);
    const w = stats.find((s) => s.factor.id === 'wine')!;
    expect(w).toMatchObject({ episodesWith: 1, totalEpisodes: 2, checkinDaysWith: 1, totalCheckinDays: 3 });
  });
});

describe('startPatterns', () => {
  it('buckets by weekday and time of day', () => {
    // 2026-10-05 is a Monday
    const p = startPatterns([episode(at(2026, 10, 5, 7), null), episode(at(2026, 10, 5, 23), null)]);
    expect(p.byWeekday[1]).toBe(2);
    expect(p.byTime).toEqual([0, 1, 0, 1]);
  });
});

describe('intensityBand', () => {
  it('maps peaks to bands', () => {
    expect([undefined, 0, 3, 4, 6, 7, 10].map(intensityBand)).toEqual([
      'unrated',
      'mild',
      'mild',
      'moderate',
      'moderate',
      'severe',
      'severe',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { blankCheckin, blankEpisode } from './db';
import { weatherStats } from './insights';
import { checkinWeatherTime, fmtPressureChange, roundCoord, snapshotFrom, weatherUrl, type Hourly } from './weather';
import type { WeatherSnapshot } from './types';

const here = { lat: 47.6, lon: -122.3 };

describe('weatherUrl', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('asks the forecast endpoint for the day before through the day of a recent time', () => {
    const url = new URL(weatherUrl(here, new Date('2026-10-31T05:30:00Z'), now));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('start_date')).toBe('2026-10-30');
    expect(url.searchParams.get('end_date')).toBe('2026-10-31');
    expect(url.searchParams.get('timezone')).toBe('GMT');
    expect(url.searchParams.get('latitude')).toBe('47.6');
  });

  it('uses the archive for older times', () => {
    const url = new URL(weatherUrl(here, new Date('2026-06-01T05:00:00Z'), now));
    expect(url.hostname).toBe('archive-api.open-meteo.com');
  });
});

describe('snapshotFrom', () => {
  const time = Array.from({ length: 48 }, (_, i) => `2026-10-${30 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);
  const hourly: Hourly = {
    time,
    temperature_2m: time.map((_, i) => 10 + i / 10),
    relative_humidity_2m: time.map(() => 80),
    pressure_msl: time.map((_, i) => 1020 - i / 4), // falls 6 hPa per day
  };

  it('reads the hour containing the time and the change over 24 hours', () => {
    const s = snapshotFrom(hourly, new Date('2026-10-31T05:40:00Z'), here)!;
    expect(s.at).toBe('2026-10-31T05:00:00.000Z');
    expect(s.pressureHpa).toBe(1020 - 29 / 4);
    expect(s.pressureChange24h).toBe(-6);
    expect(s.temperatureC).toBeCloseTo(12.9);
    expect(s.humidity).toBe(80);
  });

  it('returns nothing when the hour is missing, and no change when the earlier hour is null', () => {
    expect(snapshotFrom(hourly, new Date('2026-11-05T05:00:00Z'), here)).toBeUndefined();
    const gap = { ...hourly, pressure_msl: hourly.pressure_msl.map((p, i) => (i === 5 ? null : p)) };
    expect(snapshotFrom(gap, new Date('2026-10-31T05:00:00Z'), here)!.pressureChange24h).toBeUndefined();
  });
});

describe('helpers', () => {
  it('rounds coordinates to about 10 km', () => {
    expect([roundCoord(47.6062), roundCoord(-122.3321)]).toEqual([47.6, -122.3]);
  });

  it('uses midday for past check-ins', () => {
    const iso = checkinWeatherTime('2026-10-20', new Date(2026, 10, 1));
    expect(new Date(iso).getHours()).toBe(12);
    expect(new Date(iso).getDate()).toBe(20);
  });

  it('formats signed pressure changes', () => {
    expect([fmtPressureChange(-6.24), fmtPressureChange(3), fmtPressureChange(0)]).toEqual([
      '−6.2 hPa in 24 h',
      '+3.0 hPa in 24 h',
      '±0.0 hPa in 24 h',
    ]);
  });
});

describe('weatherStats', () => {
  const w = (pressureChange24h: number): WeatherSnapshot => ({ at: '', pressureChange24h, lat: 0, lon: 0, source: 'open-meteo' });
  const at = (d: number) => new Date(2026, 9, d, 9).toISOString();

  it('counts pressure swings before episodes and on migraine-free check-in days', () => {
    const episodes = [
      { ...blankEpisode(at(3)), endAt: at(3), weather: w(-7) },
      { ...blankEpisode(at(8)), endAt: at(8), weather: w(6) },
      { ...blankEpisode(at(12)), endAt: at(12), weather: w(-1) },
      { ...blankEpisode(at(15)), endAt: at(15) }, // no weather
    ];
    const checkins = [
      { ...blankCheckin('2026-10-03'), weather: w(-9) }, // attack day: excluded
      { ...blankCheckin('2026-10-20'), weather: w(-5) },
      { ...blankCheckin('2026-10-21'), weather: w(2) },
    ];
    expect(weatherStats(episodes, checkins, new Date(2026, 9, 31))).toEqual({
      episodesWithWeather: 3,
      episodesFell: 1,
      episodesRose: 1,
      checkinDaysWithWeather: 2,
      checkinDaysFell: 1,
      checkinDaysRose: 0,
    });
  });
});

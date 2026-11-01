import { describe, expect, it } from 'vitest';
import { blankEpisode, needsStillGoingCheck } from './db';
import { fmtDuration, fmtSince, fmtTime } from './dates';

describe('fmtDuration', () => {
  it('shows days once an episode passes 24 hours', () => {
    expect([fmtDuration(0.5), fmtDuration(3.25), fmtDuration(24), fmtDuration(32), fmtDuration(49.9)]).toEqual([
      '30m',
      '3h 15m',
      '1d',
      '1d 8h',
      '2d 1h', // minutes are dropped once it runs past a day
    ]);
  });
});

describe('fmtSince', () => {
  const now = new Date(2026, 10, 3, 9, 0);

  it('shows only the time for today and says "yesterday" for the day before', () => {
    const today = new Date(2026, 10, 3, 7, 30).toISOString();
    const yesterday = new Date(2026, 10, 2, 22, 15).toISOString();
    expect(fmtSince(today, now)).toBe(fmtTime(today));
    expect(fmtSince(yesterday, now)).toBe(`yesterday ${fmtTime(yesterday)}`);
  });

  it('includes the date for anything older', () => {
    const older = new Date(2026, 9, 30, 15, 28).toISOString();
    expect(fmtSince(older, now)).not.toBe(fmtTime(older));
    expect(fmtSince(older, now)).toContain('30');
  });
});

describe('needsStillGoingCheck', () => {
  const start = new Date(2026, 10, 1, 9).toISOString();
  const hoursLater = (h: number) => new Date(Date.parse(start) + h * 3_600_000);

  it('asks after 24 hours open, then again 24 hours after each confirmation', () => {
    const e = blankEpisode(start);
    expect(needsStillGoingCheck(e, hoursLater(23))).toBe(false);
    expect(needsStillGoingCheck(e, hoursLater(24))).toBe(true);
    const confirmed = { ...e, confirmedAt: hoursLater(25).toISOString() };
    expect(needsStillGoingCheck(confirmed, hoursLater(40))).toBe(false);
    expect(needsStillGoingCheck(confirmed, hoursLater(49))).toBe(true);
  });

  it('never asks about an ended episode', () => {
    expect(needsStillGoingCheck({ ...blankEpisode(start), endAt: hoursLater(30).toISOString() }, hoursLater(60))).toBe(false);
  });
});

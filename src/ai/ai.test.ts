import { describe, expect, it } from 'vitest';
import { blankCheckin, blankEpisode } from '../db';
import { draftFromExtraction, extractionSchema, type Extraction } from './extract';
import { reflectionWindow, weekLog } from './reflect';
import type { Factor } from '../types';

const factors: Factor[] = [
  { id: 'f1', name: 'Poor sleep', category: 'Sleep', isCustom: false, hidden: false, order: 0 },
  { id: 'f2', name: 'Skipped meal', category: 'Meals', isCustom: false, hidden: false, order: 1 },
];
const now = new Date(2026, 10, 1, 18, 0); // 1 Nov 2026, 18:00 local

const empty: Extraction = {
  startAt: null,
  endAt: null,
  stillGoing: false,
  peakIntensity: null,
  locations: [],
  quality: null,
  aura: null,
  auraTypes: [],
  symptoms: [],
  impact: null,
  tookMedication: null,
  medications: [],
  otherRelief: [],
  factors: [],
  notes: '',
};

describe('draftFromExtraction', () => {
  it('maps the fields the user mentioned and leaves the rest blank', () => {
    const d = draftFromExtraction(
      {
        ...empty,
        startAt: '2026-10-31T15:00',
        endAt: '2026-10-31T22:00',
        peakIntensity: 7,
        locations: ['left', 'behind-eye'],
        symptoms: ['light', 'nausea'],
        medications: [{ name: 'Naprosyn', takenAt: '2026-10-31T16:00', rating: 'some' }],
        factors: ['Poor sleep', 'Skipped meal'],
      },
      factors,
      now,
    );
    expect(new Date(d.startAt).getHours()).toBe(15);
    expect(new Date(d.endAt!).getHours()).toBe(22);
    expect(d.readings.map((r) => r.value)).toEqual([7]);
    expect(d.relief).toMatchObject([{ kind: 'medication', item: 'Naprosyn', rating: 'some' }]);
    expect(d.tookMedication).toBe(true);
    expect(d.factorIds).toEqual(['f1', 'f2']);
    expect(d.quality).toBeUndefined();
    expect(d.impact).toBeUndefined();
  });

  it('defaults like a past migraine when no times are given', () => {
    const d = draftFromExtraction(empty, factors, now);
    expect(d.endAt).toBe(now.toISOString());
    expect(Date.parse(d.endAt!) - Date.parse(d.startAt)).toBe(2 * 3_600_000);
  });

  it('keeps it in progress only when no other migraine is', () => {
    expect(draftFromExtraction({ ...empty, stillGoing: true }, factors, now).endAt).toBeNull();
    expect(draftFromExtraction({ ...empty, stillGoing: true }, factors, now, false).endAt).not.toBeNull();
  });

  it('never lets times run into the future or end before the start', () => {
    const d = draftFromExtraction({ ...empty, startAt: '2026-11-02T09:00', endAt: '2026-11-01T08:00' }, factors, now);
    expect(Date.parse(d.startAt)).toBeLessThanOrEqual(now.getTime());
    expect(Date.parse(d.endAt!)).toBeGreaterThan(Date.parse(d.startAt));
  });

  it('clamps intensity, drops aura types without aura, and ignores unknown triggers', () => {
    const d = draftFromExtraction({ ...empty, peakIntensity: 14, auraTypes: ['visual'], factors: ['Moon phase'] }, factors, now);
    expect(d.readings[0].value).toBe(10);
    expect(d.auraTypes).toEqual([]);
    expect(d.factorIds).toEqual([]);
  });

  it('records an explicit "no medication"', () => {
    expect(draftFromExtraction({ ...empty, tookMedication: false }, factors, now).tookMedication).toBe(false);
  });
});

describe('extractionSchema', () => {
  it('only accepts the user’s own trigger names', () => {
    const schema = extractionSchema(['Poor sleep']);
    expect(schema.safeParse({ ...empty, factors: ['Poor sleep'] }).success).toBe(true);
    expect(schema.safeParse({ ...empty, factors: ['Chocolate'] }).success).toBe(false);
  });
});

describe('weekLog', () => {
  it('covers the last 7 days, in the user’s terms', () => {
    const { from, to } = reflectionWindow(now);
    expect([from, to]).toEqual(['2026-10-26', '2026-11-01']);
    const inWeek = {
      ...blankEpisode(new Date(2026, 9, 30, 9).toISOString()),
      endAt: new Date(2026, 9, 30, 13).toISOString(),
      readings: [{ at: new Date(2026, 9, 30, 9).toISOString(), value: 6 }],
      factorIds: ['f1'],
      tookMedication: false,
    };
    const old = blankEpisode(new Date(2026, 9, 20, 9).toISOString());
    const log = weekLog([inWeek, old], [{ ...blankCheckin('2026-10-29'), sleepHours: 5 }], factors, now);
    expect(log.episodes).toBe(1);
    expect(log.checkins).toBe(1);
    expect(log.text).toContain('peak 6/10');
    expect(log.text).toContain('possible triggers logged: Poor sleep');
    expect(log.text).toContain('no medication');
    expect(log.text).toContain('sleep 5 h');
  });
});

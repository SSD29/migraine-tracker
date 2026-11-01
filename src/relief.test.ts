import { describe, expect, it } from 'vitest';
import { blankEpisode } from './db';
import { describeRelief, medicationStatus } from './relief';
import type { ReliefEntry } from './types';

const med = (item: string, rating?: ReliefEntry['rating']): ReliefEntry => ({
  id: item,
  kind: 'medication',
  item,
  takenAt: '2026-11-01T10:00:00.000Z',
  rating,
});
const other = (item: string): ReliefEntry => ({ id: item, item, takenAt: '2026-11-01T10:00:00.000Z' });

describe('medicationStatus', () => {
  it('is yes when a medication is logged, even without the explicit answer', () => {
    expect(medicationStatus({ ...blankEpisode(), relief: [med('Naprosyn')] })).toBe('yes');
  });

  it('follows the explicit answer when nothing is logged', () => {
    expect(medicationStatus({ ...blankEpisode(), tookMedication: true })).toBe('yes');
    expect(medicationStatus({ ...blankEpisode(), tookMedication: false })).toBe('no');
  });

  it('is unknown when not answered, and older untyped relief entries do not count as medication', () => {
    expect(medicationStatus({ ...blankEpisode(), relief: [other('Rest')] })).toBeUndefined();
  });
});

describe('describeRelief', () => {
  it('lists entries in the user’s words with their rating', () => {
    expect(describeRelief([med('Naprosyn 500 mg', 'some'), other('Dark room')])).toBe(
      'Naprosyn 500 mg (some relief); Dark room',
    );
  });

  it('can include the time', () => {
    expect(describeRelief([med('Naprosyn')], () => '10:00')).toBe('Naprosyn at 10:00');
  });
});

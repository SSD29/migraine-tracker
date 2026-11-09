import { describe, expect, it } from 'vitest';
import { blankCheckin, blankEpisode, checkinId, missingPresets, normalizeEntries, presetId } from './db';
import { PRESET_FACTORS } from './options';
import type { Factor } from './types';

const factor = (id: string, name: string, isCustom = false): Factor => ({
  id,
  name,
  category: 'Other',
  isCustom,
  hidden: false,
  order: 0,
});

describe('normalizeEntries', () => {
  it('gives presets and check-ins shared IDs and updates references', () => {
    const episode = { ...blankEpisode(), factorIds: ['old-uuid', 'mine'] };
    const checkin = { ...blankCheckin('2026-11-01'), id: 'whatever', factorIds: ['old-uuid'] };
    const n = normalizeEntries(
      {
        episodes: [episode],
        factors: [factor('old-uuid', 'Poor sleep'), factor('mine', 'Long drive', true)],
        checkins: [checkin],
        medications: [],
      },
      { factors: [], medications: [] },
    );
    expect(n.factors.map((f) => f.id)).toEqual([presetId('Poor sleep'), 'mine']);
    expect(n.episodes[0].factorIds).toEqual([presetId('Poor sleep'), 'mine']);
    expect(n.checkins[0]).toMatchObject({ id: checkinId('2026-11-01'), factorIds: [presetId('Poor sleep')] });
  });

  it('reuses triggers and medications the account already has, by name', () => {
    const n = normalizeEntries(
      {
        episodes: [{ ...blankEpisode(), factorIds: ['b'] }],
        factors: [factor('b', 'long drive', true)],
        checkins: [],
        medications: [{ id: 'm2', name: 'Naprosyn ', order: 0 }],
      },
      { factors: [factor('a', 'Long drive', true)], medications: [{ id: 'm1', name: 'naprosyn', order: 0 }] },
    );
    expect(n.factors).toEqual([]);
    expect(n.episodes[0].factorIds).toEqual(['a']);
    expect(n.medications).toEqual([]);
  });

  it('drops the sync fields from rows', () => {
    const row = { ...blankEpisode(), owner: 'me@example.com', realmId: 'me@example.com' };
    const n = normalizeEntries({ episodes: [row], factors: [], checkins: [], medications: [] }, { factors: [], medications: [] });
    expect(n.episodes[0]).not.toHaveProperty('owner');
    expect(n.episodes[0]).not.toHaveProperty('realmId');
  });
});

describe('missingPresets', () => {
  it('adds each preset once, with the same ID on every device', () => {
    const first = missingPresets([]);
    expect(first).toHaveLength(PRESET_FACTORS.length);
    expect(first.every((f) => f.id === presetId(f.name))).toBe(true);
    expect(missingPresets(first)).toEqual([]);
  });

  it('keeps a renamed preset instead of adding the original back', () => {
    const renamed = { ...factor(presetId('Poor sleep'), 'Bad sleep'), category: 'Sleep' };
    expect(missingPresets([renamed]).some((f) => f.name === 'Poor sleep')).toBe(false);
  });
});

import Dexie, { type Table } from 'dexie';
import type { DailyCheckin, Episode, Factor } from './types';
import { PRESET_FACTORS } from './options';
import { nowIso, userTimeZone } from './dates';

class MigraineDB extends Dexie {
  episodes!: Table<Episode, string>;
  factors!: Table<Factor, string>;
  checkins!: Table<DailyCheckin, string>;

  constructor() {
    super('migraine-tracker');
    this.version(1).stores({
      episodes: 'id, startAt',
      factors: 'id, order',
      checkins: 'date',
    });
    this.on('populate', (tx) => {
      tx.table('factors').bulkAdd(presetFactors());
    });
  }
}

export const db = new MigraineDB();

export const newId = () => crypto.randomUUID();

function presetFactors(): Factor[] {
  return PRESET_FACTORS.map((f, i) => ({
    id: newId(),
    name: f.name,
    category: f.category,
    isCustom: false,
    hidden: false,
    order: i,
  }));
}

export function blankEpisode(startAt = nowIso()): Episode {
  const now = nowIso();
  return {
    id: newId(),
    startAt,
    endAt: null,
    tz: userTimeZone(),
    readings: [],
    locations: [],
    auraTypes: [],
    symptoms: [],
    relief: [],
    factorIds: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function blankCheckin(date: string): DailyCheckin {
  return { date, factorIds: [], notes: '', updatedAt: nowIso() };
}

/** One-tap start (FR-1.1). */
export async function startEpisode() {
  const e = blankEpisode();
  await db.episodes.add(e);
  return e;
}

export async function endEpisode(id: string) {
  await db.episodes.update(id, { endAt: nowIso(), updatedAt: nowIso() });
}

export async function addReading(id: string, value: number) {
  const e = await db.episodes.get(id);
  if (!e) return;
  await db.episodes.update(id, {
    readings: [...e.readings, { at: nowIso(), value }],
    updatedAt: nowIso(),
  });
}

export const ongoingEpisode = () =>
  db.episodes
    .filter((e) => e.endAt === null)
    .first()
    .then((e) => e ?? null);

export interface Backup {
  app: 'migraine-tracker';
  version: 1;
  exportedAt: string;
  episodes: Episode[];
  factors: Factor[];
  checkins: DailyCheckin[];
}

export async function exportBackup(): Promise<Backup> {
  const [episodes, factors, checkins] = await Promise.all([
    db.episodes.toArray(),
    db.factors.toArray(),
    db.checkins.toArray(),
  ]);
  return { app: 'migraine-tracker', version: 1, exportedAt: nowIso(), episodes, factors, checkins };
}

/** Replaces everything on this device with the backup's contents. */
export async function restoreBackup(data: unknown) {
  const b = data as Partial<Backup>;
  if (b?.app !== 'migraine-tracker' || !Array.isArray(b.episodes) || !Array.isArray(b.factors) || !Array.isArray(b.checkins)) {
    throw new Error('This file is not a Migraine Tracker backup.');
  }
  await db.transaction('rw', db.episodes, db.factors, db.checkins, async () => {
    await Promise.all([db.episodes.clear(), db.factors.clear(), db.checkins.clear()]);
    await db.episodes.bulkAdd(b.episodes!);
    await db.factors.bulkAdd(b.factors!);
    await db.checkins.bulkAdd(b.checkins!);
  });
}

/** FR-6.3: remove all data from this device and restore the preset factor list. */
export async function deleteAllData() {
  await db.transaction('rw', db.episodes, db.factors, db.checkins, async () => {
    await Promise.all([db.episodes.clear(), db.factors.clear(), db.checkins.clear()]);
    await db.factors.bulkAdd(presetFactors());
  });
}

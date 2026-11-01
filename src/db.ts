import Dexie, { type Table } from 'dexie';
import type { DailyCheckin, Episode, Factor, Medication, ReliefEntry } from './types';
import { PRESET_FACTORS } from './options';
import { nowIso, userTimeZone } from './dates';

class MigraineDB extends Dexie {
  episodes!: Table<Episode, string>;
  factors!: Table<Factor, string>;
  checkins!: Table<DailyCheckin, string>;
  medications!: Table<Medication, string>;

  constructor() {
    super('migraine-tracker');
    this.version(1).stores({
      episodes: 'id, startAt',
      factors: 'id, order',
      checkins: 'date',
    });
    // v2: adds presets introduced after launch (meal timing) to existing installs.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const factors = tx.table<Factor, string>('factors');
        await factors.bulkAdd(missingPresets(await factors.toArray()));
      });
    // v3: the user's own medication list, for one-tap logging.
    this.version(3).stores({ medications: 'id, order' });
    this.on('populate', (tx) => {
      tx.table('factors').bulkAdd(presetFactors());
    });
  }
}

/**
 * Presets the user doesn't have yet (matched by name), each placed after the
 * last existing factor in its category so it shows up in the right group.
 */
export function missingPresets(existing: Factor[]): Factor[] {
  const names = new Set(existing.map((f) => f.name.toLowerCase()));
  const added: Factor[] = [];
  for (const p of PRESET_FACTORS) {
    if (names.has(p.name.toLowerCase())) continue;
    const peers = [...existing, ...added].filter((f) => f.category === p.category);
    const order = peers.length
      ? Math.max(...peers.map((f) => f.order)) + 0.01
      : Math.max(-1, ...existing.map((f) => f.order)) + 1;
    added.push({ id: newId(), name: p.name, category: p.category, isCustom: false, hidden: false, order });
  }
  return added;
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

export async function endEpisode(id: string, at = nowIso()) {
  await db.episodes.update(id, { endAt: at, updatedAt: nowIso() });
}

export const isMedication = (r: ReliefEntry) => r.kind === 'medication';

/** Adds names to the user's medication list if they aren't there yet (case-insensitive). */
export async function rememberMedications(names: string[]) {
  const existing = await db.medications.toArray();
  const known = new Set(existing.map((m) => m.name.trim().toLowerCase()));
  let order = Math.max(-1, ...existing.map((m) => m.order));
  const added: Medication[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || known.has(name.toLowerCase())) continue;
    known.add(name.toLowerCase());
    added.push({ id: newId(), name, order: ++order });
  }
  if (added.length) await db.medications.bulkAdd(added);
}

/** One-tap "took this medication now" from the in-progress card. Returns the entry id for undo. */
export async function logMedication(episodeId: string, name: string) {
  const e = await db.episodes.get(episodeId);
  if (!e) return null;
  const entry: ReliefEntry = { id: newId(), kind: 'medication', item: name, takenAt: nowIso() };
  await db.episodes.update(episodeId, { relief: [...e.relief, entry], tookMedication: true, updatedAt: nowIso() });
  return entry.id;
}

export async function removeReliefEntry(episodeId: string, entryId: string) {
  const e = await db.episodes.get(episodeId);
  if (!e) return;
  const relief = e.relief.filter((r) => r.id !== entryId);
  // With no medication left, go back to "not answered" (keeping an explicit "no").
  const tookMedication = relief.some(isMedication) ? true : e.tookMedication === false ? false : undefined;
  await db.episodes.update(episodeId, { relief, tookMedication, updatedAt: nowIso() });
}

/** Removes an episode started by mistake. */
export async function discardEpisode(id: string) {
  await db.episodes.delete(id);
}

/** The user confirmed a long episode is still going; ask again a day later. */
export async function confirmOngoing(id: string) {
  await db.episodes.update(id, { confirmedAt: nowIso(), updatedAt: nowIso() });
}

// How long an open episode runs before the app asks whether it is still going.
export const STILL_GOING_CHECK_HOURS = 24;

export const needsStillGoingCheck = (e: Episode, now = new Date()) =>
  e.endAt === null &&
  now.getTime() - Date.parse(e.confirmedAt ?? e.startAt) >= STILL_GOING_CHECK_HOURS * 3_600_000;

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
  medications?: Medication[]; // added in v3; older backups don't have it
}

export async function exportBackup(): Promise<Backup> {
  const [episodes, factors, checkins, medications] = await Promise.all([
    db.episodes.toArray(),
    db.factors.toArray(),
    db.checkins.toArray(),
    db.medications.toArray(),
  ]);
  return { app: 'migraine-tracker', version: 1, exportedAt: nowIso(), episodes, factors, checkins, medications };
}

/** Replaces everything on this device with the backup's contents. */
export async function restoreBackup(data: unknown) {
  const b = data as Partial<Backup>;
  if (b?.app !== 'migraine-tracker' || !Array.isArray(b.episodes) || !Array.isArray(b.factors) || !Array.isArray(b.checkins)) {
    throw new Error('This file is not a Migraine Tracker backup.');
  }
  await db.transaction('rw', [db.episodes, db.factors, db.checkins, db.medications], async () => {
    await Promise.all([db.episodes.clear(), db.factors.clear(), db.checkins.clear(), db.medications.clear()]);
    await db.episodes.bulkAdd(b.episodes!);
    await db.factors.bulkAdd(b.factors!);
    await db.factors.bulkAdd(missingPresets(b.factors!)); // backups made before newer presets existed
    await db.checkins.bulkAdd(b.checkins!);
    await db.medications.bulkAdd(b.medications ?? []);
  });
}

/** FR-6.3: remove all data from this device and restore the preset factor list. */
export async function deleteAllData() {
  await db.transaction('rw', [db.episodes, db.factors, db.checkins, db.medications], async () => {
    await Promise.all([db.episodes.clear(), db.factors.clear(), db.checkins.clear(), db.medications.clear()]);
    await db.factors.bulkAdd(presetFactors());
  });
}

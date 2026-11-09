import Dexie, { type Table } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';
import type { DailyCheckin, Episode, Factor, Medication, ReliefEntry } from './types';
import { PRESET_FACTORS } from './options';
import { nowIso, userTimeZone } from './dates';
import { storage } from './lock';

// Entries sync through Dexie Cloud to every device where the user signs in with the same email.
export const DATABASE_URL = 'https://zox43fsem.dexie.cloud';

class MigraineDB extends Dexie {
  episodes!: Table<Episode, string>;
  factors!: Table<Factor, string>;
  checkins!: Table<DailyCheckin, string>;
  medications!: Table<Medication, string>;

  constructor() {
    // Dexie Cloud adds a suffix to the local name, so this is a new database next to the old
    // device-only one; importLocalData() copies the old entries in once.
    // Synced tables can't be migrated with upgrade(), so new fields must stay optional.
    super('migraine-tracker', { addons: [dexieCloud] });
    this.version(1).stores({
      episodes: 'id, startAt',
      factors: 'id, order',
      checkins: 'id, date',
      medications: 'id, order',
    });
    this.cloud.configure({ databaseUrl: DATABASE_URL, requireAuth: true });
  }
}

// IDs starting with # are private to each user, so every device computes the same ID for the
// same preset or day. That way two devices don't create duplicates of each other's rows.
export const presetId = (name: string) => `#f-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
export const checkinId = (date: string) => `#c-${date}`;

/**
 * Presets the user doesn't have yet (matched by ID or name), each placed after the
 * last existing factor in its category so it shows up in the right group.
 */
export function missingPresets(existing: Factor[]): Factor[] {
  const ids = new Set(existing.map((f) => f.id));
  const names = new Set(existing.map((f) => f.name.toLowerCase()));
  const added: Factor[] = [];
  for (const p of PRESET_FACTORS) {
    if (ids.has(presetId(p.name)) || names.has(p.name.toLowerCase())) continue;
    const peers = [...existing, ...added].filter((f) => f.category === p.category);
    const order = peers.length
      ? Math.max(...peers.map((f) => f.order)) + 0.01
      : Math.max(-1, ...existing.map((f) => f.order)) + 1;
    added.push({ id: presetId(p.name), name: p.name, category: p.category, isCustom: false, hidden: false, order });
  }
  return added;
}

export const db = new MigraineDB();

export const newId = () => crypto.randomUUID();

function presetFactors(): Factor[] {
  return PRESET_FACTORS.map((f, i) => ({
    id: presetId(f.name),
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
  return { id: checkinId(date), date, factorIds: [], notes: '', updatedAt: nowIso() };
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
  return {
    app: 'migraine-tracker',
    version: 1,
    exportedAt: nowIso(),
    episodes: episodes.map(withoutSyncFields),
    factors: factors.map(withoutSyncFields),
    checkins: checkins.map(withoutSyncFields),
    medications: medications.map(withoutSyncFields),
  };
}

// Dexie Cloud adds these to every row; they belong to the account, not the entry.
function withoutSyncFields<T extends object>(row: T): T {
  const { owner: _o, realmId: _r, ...rest } = row as T & { owner?: string; realmId?: string };
  return rest as T;
}

type Entries = Pick<Backup, 'episodes' | 'factors' | 'checkins' | 'medications'>;

/**
 * Brings entries from a backup or the old device-only database in line with the synced one:
 * presets and check-ins get their shared IDs, and triggers or medications that already exist
 * under the same name are reused instead of duplicated. References to triggers follow along.
 */
export function normalizeEntries(data: Entries, existing: { factors: Factor[]; medications: Medication[] }) {
  const presetNames = new Map(PRESET_FACTORS.map((p) => [p.name.toLowerCase(), p.name]));
  const idByName = new Map(existing.factors.map((f) => [f.name.toLowerCase(), f.id]));
  const idMap = new Map<string, string>();
  const factors = new Map<string, Factor>();
  for (const f of data.factors) {
    const key = f.name.toLowerCase();
    const preset = !f.isCustom && presetNames.get(key);
    const id = preset ? presetId(preset) : (idByName.get(key) ?? f.id);
    idMap.set(f.id, id);
    if (!factors.has(id) && !existing.factors.some((x) => x.id === id)) factors.set(id, { ...withoutSyncFields(f), id });
  }
  const mapIds = (ids: string[]) => [...new Set(ids.map((id) => idMap.get(id) ?? id))];
  const knownMeds = new Set(existing.medications.map((m) => m.name.trim().toLowerCase()));
  return {
    episodes: data.episodes.map((e) => ({ ...withoutSyncFields(e), factorIds: mapIds(e.factorIds) })),
    factors: [...factors.values()],
    checkins: data.checkins.map((c) => ({ ...withoutSyncFields(c), id: checkinId(c.date), factorIds: mapIds(c.factorIds) })),
    medications: (data.medications ?? [])
      .filter((m) => !knownMeds.has(m.name.trim().toLowerCase()))
      .map(withoutSyncFields),
  };
}

const allTables = () => [db.episodes, db.factors, db.checkins, db.medications];

async function putEntries(n: ReturnType<typeof normalizeEntries>) {
  await db.episodes.bulkPut(n.episodes);
  await db.factors.bulkPut(n.factors);
  await db.checkins.bulkPut(n.checkins);
  await db.medications.bulkPut(n.medications);
}

/** Replaces everything (on every synced device) with the backup's contents. */
export async function restoreBackup(data: unknown) {
  const b = data as Partial<Backup>;
  if (b?.app !== 'migraine-tracker' || !Array.isArray(b.episodes) || !Array.isArray(b.factors) || !Array.isArray(b.checkins)) {
    throw new Error('This file is not a Migraine Tracker backup.');
  }
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await putEntries(normalizeEntries(b as Entries, { factors: [], medications: [] }));
    await db.factors.bulkPut(missingPresets(await db.factors.toArray())); // backups made before newer presets existed
  });
}

/** FR-6.3: remove all entries (on every synced device) and restore the preset factor list. */
export async function deleteAllData() {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await db.factors.bulkPut(presetFactors());
  });
}

/** Adds presets that are missing, e.g. on a new account or after an app update adds one. */
export async function seedPresets() {
  await db.factors.bulkPut(missingPresets(await db.factors.toArray()));
}

// The device-only database used before sync. Kept as it was, in case anything goes wrong.
const LOCAL_DB = 'migraine-tracker';
const IMPORTED_KEY = 'mt-local-imported';

/** Copies entries from this device's old database into the synced one, once. Returns how many. */
export async function importLocalData() {
  if (storage.get(IMPORTED_KEY)) return 0;
  let count = 0;
  if (await Dexie.exists(LOCAL_DB)) {
    const old = new Dexie(LOCAL_DB);
    await old.open(); // opens with whatever tables it has
    const read = <T>(name: string) =>
      old.tables.some((t) => t.name === name) ? old.table<T>(name).toArray() : Promise.resolve([] as T[]);
    const [episodes, factors, checkins, medications] = await Promise.all([
      read<Episode>('episodes'),
      read<Factor>('factors'),
      read<DailyCheckin>('checkins'),
      read<Medication>('medications'),
    ]);
    old.close();
    await db.transaction('rw', allTables(), async () => {
      const existing = { factors: await db.factors.toArray(), medications: await db.medications.toArray() };
      const n = normalizeEntries({ episodes, factors, checkins, medications }, existing);
      await putEntries(n);
      count = n.episodes.length + n.checkins.length;
    });
  }
  storage.set(IMPORTED_KEY, '1');
  return count;
}

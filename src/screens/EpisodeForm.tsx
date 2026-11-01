import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { blankEpisode, db, isMedication, newId, rememberMedications } from '../db';
import { fmtDuration, fromInputValue, nowIso, toInputValue } from '../dates';
import { AURA, AURA_TYPES, IMPACTS, LOCATIONS, QUALITIES, RELIEF_RATINGS, SYMPTOMS, type Option } from '../options';
import { durationHours, peakIntensity } from '../insights';
import { MultiChips, SingleChips } from '../components/Chips';
import { FactorPicker } from '../components/FactorPicker';
import { attachEpisodeWeather, fmtWeather } from '../weather';
import type { Episode, ReliefEntry } from '../types';

interface Props {
  id: string; // 'new' for a backfilled episode
  onClose: () => void;
}

const INTENSITIES = Array.from({ length: 11 }, (_, n) => n);
const YES_NO: Option<'yes' | 'no'>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function EpisodeForm({ id, onClose }: Props) {
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Episode | null>(null);
  const [error, setError] = useState('');

  // Suggestions come only from the user's own past words, never from the app.
  const past =
    useLiveQuery(async () => {
      const all = (await db.episodes.toArray()).flatMap((e) => e.relief);
      const names = (entries: ReliefEntry[]) => [...new Set(entries.map((r) => r.item.trim()).filter(Boolean))].sort();
      return { medication: names(all.filter(isMedication)), other: names(all.filter((r) => !isMedication(r))) };
    }, []) ?? { medication: [], other: [] };
  const savedMeds = useLiveQuery(() => db.medications.orderBy('order').toArray(), []) ?? [];

  useEffect(() => {
    if (isNew) {
      const start = new Date(Date.now() - 2 * 3_600_000).toISOString();
      setDraft({ ...blankEpisode(start), endAt: nowIso() });
    } else {
      db.episodes.get(id).then((e) => (e ? setDraft(e) : onClose()));
    }
  }, [id, isNew, onClose]);

  if (!draft) return null;

  const set = (patch: Partial<Episode>) => setDraft({ ...draft, ...patch });

  const medEntries = draft.relief.filter(isMedication);
  const otherRelief = draft.relief.filter((r) => !isMedication(r));
  const medNames = [...new Set([...savedMeds.map((m) => m.name), ...past.medication])];
  const pastRelief = past.other;

  const addRelief = (kind: 'medication' | 'other', item = '') =>
    set({
      relief: [...draft.relief, { id: newId(), kind, item, takenAt: draft.endAt === null ? nowIso() : draft.startAt }],
    });
  const updateRelief = (id: string, patch: Partial<ReliefEntry>) =>
    set({ relief: draft.relief.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const removeRelief = (id: string) => set({ relief: draft.relief.filter((r) => r.id !== id) });

  const setTookMedication = (value: 'yes' | 'no' | undefined) => {
    if (value === 'yes') return set({ tookMedication: true });
    if (medEntries.length) {
      if (!confirm('Remove the medication entries for this migraine?')) return;
    }
    set({ tookMedication: value === 'no' ? false : undefined, relief: otherRelief });
  };

  const reliefEditor = (r: ReliefEntry, label: string, placeholder: string, list: string) => (
    <div className="relief" key={r.id}>
      <div className="row">
        <input
          type="text"
          list={list}
          aria-label={label}
          placeholder={placeholder}
          value={r.item}
          onChange={(e) => updateRelief(r.id, { item: e.target.value })}
        />
        <button className="btn icon" aria-label="Remove entry" onClick={() => removeRelief(r.id)}>
          ×
        </button>
      </div>
      <input
        type="datetime-local"
        aria-label="Time"
        value={toInputValue(r.takenAt)}
        onChange={(e) => e.target.value && updateRelief(r.id, { takenAt: fromInputValue(e.target.value) })}
      />
      <SingleChips
        label="How much it helped"
        options={RELIEF_RATINGS}
        value={r.rating}
        onChange={(rating) => updateRelief(r.id, { rating })}
      />
    </div>
  );

  const save = async () => {
    if (draft.endAt && Date.parse(draft.endAt) <= Date.parse(draft.startAt)) {
      setError('End time must be after the start time.');
      return;
    }
    const relief = draft.relief.filter((r) => r.item.trim());
    await db.episodes.put({
      ...draft,
      readings: [...draft.readings].sort((a, b) => a.at.localeCompare(b.at)),
      relief,
      tookMedication: relief.some(isMedication) ? true : draft.tookMedication,
      updatedAt: nowIso(),
    });
    await rememberMedications(relief.filter(isMedication).map((r) => r.item));
    attachEpisodeWeather(draft.id); // looks up weather for a new or moved start time, in the background
    onClose();
  };

  const remove = async () => {
    if (!confirm('Delete this episode? This cannot be undone.')) return;
    await db.episodes.delete(draft.id);
    onClose();
  };

  const peak = peakIntensity(draft);

  return (
    <div className="screen form">
      <header className="form-header">
        <button className="btn link" onClick={onClose}>
          Cancel
        </button>
        <h1>{isNew ? 'Log a past migraine' : 'Episode details'}</h1>
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="card">
        <h2>When</h2>
        <label className="field">
          <span className="label">Started</span>
          <input
            type="datetime-local"
            value={toInputValue(draft.startAt)}
            onChange={(e) => e.target.value && set({ startAt: fromInputValue(e.target.value) })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.endAt === null}
            onChange={(e) => set({ endAt: e.target.checked ? null : nowIso() })}
          />
          Still going
        </label>
        {draft.endAt !== null && (
          <label className="field">
            <span className="label">Ended</span>
            <input
              type="datetime-local"
              value={toInputValue(draft.endAt)}
              onChange={(e) => e.target.value && set({ endAt: fromInputValue(e.target.value) })}
            />
          </label>
        )}
        {durationHours(draft) !== undefined && durationHours(draft)! > 0 && (
          <p className="muted">Duration: {fmtDuration(durationHours(draft))}</p>
        )}
        {draft.weather && <p className="muted">Weather at start: {fmtWeather(draft.weather)}</p>}
      </section>

      <section className="card">
        <h2>Intensity</h2>
        <p className="muted">
          {peak === undefined ? 'No ratings yet.' : `Peak ${peak}/10.`} Add a reading each time it changes.
        </p>
        {draft.readings.map((r, i) => (
          <div className="row" key={i}>
            <input
              type="datetime-local"
              aria-label="Reading time"
              value={toInputValue(r.at)}
              onChange={(e) =>
                e.target.value &&
                set({ readings: draft.readings.map((x, j) => (j === i ? { ...x, at: fromInputValue(e.target.value) } : x)) })
              }
            />
            <select
              aria-label="Intensity, 0 to 10"
              value={r.value}
              onChange={(e) =>
                set({ readings: draft.readings.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)) })
              }
            >
              {INTENSITIES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
            <button
              className="btn icon"
              aria-label="Remove reading"
              onClick={() => set({ readings: draft.readings.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="btn"
          onClick={() =>
            set({
              readings: [
                ...draft.readings,
                { at: draft.endAt === null ? nowIso() : draft.startAt, value: draft.readings.at(-1)?.value ?? 5 },
              ],
            })
          }
        >
          Add reading
        </button>
      </section>

      <section className="card">
        <h2>The pain</h2>
        <div className="field">
          <span className="label">Where</span>
          <MultiChips label="Pain location" options={LOCATIONS} selected={draft.locations} onChange={(locations) => set({ locations })} />
        </div>
        <div className="field">
          <span className="label">What it feels like</span>
          <SingleChips label="Pain quality" options={QUALITIES} value={draft.quality} onChange={(quality) => set({ quality })} />
        </div>
        <div className="field">
          <span className="label">Aura</span>
          <SingleChips label="Aura" options={AURA} value={draft.aura} onChange={(aura) => set({ aura, auraTypes: aura === 'no' ? [] : draft.auraTypes })} />
        </div>
        {(draft.aura === 'yes' || draft.aura === 'unsure') && (
          <div className="field">
            <span className="label">Aura type</span>
            <MultiChips label="Aura type" options={AURA_TYPES} selected={draft.auraTypes} onChange={(auraTypes) => set({ auraTypes })} />
          </div>
        )}
        <div className="field">
          <span className="label">Other symptoms</span>
          <MultiChips label="Symptoms" options={SYMPTOMS} selected={draft.symptoms} onChange={(symptoms) => set({ symptoms })} />
        </div>
        <div className="field">
          <span className="label">Effect on your day</span>
          <SingleChips label="Impact on activity" options={IMPACTS} value={draft.impact} onChange={(impact) => set({ impact })} />
        </div>
      </section>

      <section className="card">
        <h2>Medication</h2>
        <div className="field">
          <span className="label">Did you take any medication for this migraine?</span>
          <SingleChips
            label="Took medication"
            options={YES_NO}
            value={draft.tookMedication === undefined ? undefined : draft.tookMedication ? 'yes' : 'no'}
            onChange={setTookMedication}
          />
        </div>
        {draft.tookMedication && (
          <>
            <datalist id="medication-names">
              {medNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {medEntries.map((r) => reliefEditor(r, 'Medication name', 'Name, and dose if you like', 'medication-names'))}
            {savedMeds.length > 0 && (
              <div className="chips" role="group" aria-label="Add one of your medications">
                {savedMeds.map((m) => (
                  <button key={m.id} type="button" className="chip add" onClick={() => addRelief('medication', m.name)}>
                    + {m.name}
                  </button>
                ))}
              </div>
            )}
            <button className="btn" onClick={() => addRelief('medication')}>
              {medEntries.length ? 'Add another medication' : 'Add a medication'}
            </button>
          </>
        )}
        <p className="muted small">Recorded exactly as you enter it. The app never suggests medications or doses.</p>
      </section>

      <section className="card">
        <h2>Anything else that helped?</h2>
        <datalist id="relief-items">
          {pastRelief.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        {otherRelief.map((r) => reliefEditor(r, 'What you did', 'e.g. rested in a dark room', 'relief-items'))}
        <button className="btn" onClick={() => addRelief('other')}>
          Add entry
        </button>
      </section>

      <section className="card">
        <h2>Possible triggers</h2>
        <p className="muted">Anything from the 24 hours before it started.</p>
        <FactorPicker selected={draft.factorIds} onChange={(factorIds) => set({ factorIds })} />
      </section>

      <section className="card">
        <label className="field">
          <span className="label">Notes</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </section>

      <div className="row spread">
        {!isNew ? (
          <button className="btn danger" onClick={remove}>
            Delete episode
          </button>
        ) : (
          <span />
        )}
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

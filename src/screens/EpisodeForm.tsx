import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { blankEpisode, db, newId } from '../db';
import { fromInputValue, nowIso, toInputValue } from '../dates';
import { AURA, AURA_TYPES, IMPACTS, LOCATIONS, QUALITIES, RELIEF_RATINGS, SYMPTOMS } from '../options';
import { durationHours, peakIntensity } from '../insights';
import { MultiChips, SingleChips } from '../components/Chips';
import { FactorPicker } from '../components/FactorPicker';
import type { Episode } from '../types';

interface Props {
  id: string; // 'new' for a backfilled episode
  onClose: () => void;
}

const INTENSITIES = Array.from({ length: 11 }, (_, n) => n);

export function EpisodeForm({ id, onClose }: Props) {
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Episode | null>(null);
  const [error, setError] = useState('');

  // Suggest relief items the user has typed before (their own words, never app suggestions).
  const pastRelief =
    useLiveQuery(async () => {
      const all = await db.episodes.toArray();
      return [...new Set(all.flatMap((e) => e.relief.map((r) => r.item.trim())).filter(Boolean))].sort();
    }, []) ?? [];

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

  const save = async () => {
    if (draft.endAt && Date.parse(draft.endAt) <= Date.parse(draft.startAt)) {
      setError('End time must be after the start time.');
      return;
    }
    await db.episodes.put({
      ...draft,
      readings: [...draft.readings].sort((a, b) => a.at.localeCompare(b.at)),
      relief: draft.relief.filter((r) => r.item.trim()),
      updatedAt: nowIso(),
    });
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
          <p className="muted">Duration: {Math.round(durationHours(draft)! * 10) / 10} hours</p>
        )}
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
        <h2>What you took or did for relief</h2>
        <p className="muted">Recorded exactly as you enter it.</p>
        <datalist id="relief-items">
          {pastRelief.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        {draft.relief.map((r, i) => {
          const update = (patch: Partial<typeof r>) =>
            set({ relief: draft.relief.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div className="relief" key={r.id}>
              <div className="row">
                <input
                  type="text"
                  list="relief-items"
                  aria-label="What you took or did"
                  placeholder="e.g. rested in a dark room"
                  value={r.item}
                  onChange={(e) => update({ item: e.target.value })}
                />
                <button
                  className="btn icon"
                  aria-label="Remove entry"
                  onClick={() => set({ relief: draft.relief.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
              <input
                type="datetime-local"
                aria-label="Time"
                value={toInputValue(r.takenAt)}
                onChange={(e) => e.target.value && update({ takenAt: fromInputValue(e.target.value) })}
              />
              <SingleChips label="How much it helped" options={RELIEF_RATINGS} value={r.rating} onChange={(rating) => update({ rating })} />
            </div>
          );
        })}
        <button
          className="btn"
          onClick={() =>
            set({ relief: [...draft.relief, { id: newId(), item: '', takenAt: draft.endAt === null ? nowIso() : draft.startAt }] })
          }
        >
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

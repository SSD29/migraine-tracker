import { useEffect, useState } from 'react';
import { blankCheckin, db } from '../db';
import { localDateKey, nowIso } from '../dates';
import { STRESS_LEVELS } from '../options';
import { SingleChips } from '../components/Chips';
import { FactorPicker } from '../components/FactorPicker';
import { attachCheckinWeather } from '../weather';
import type { DailyCheckin } from '../types';

interface Props {
  date: string;
  onClose: () => void;
}

/** FR-2.4: optional daily check-in, logged with or without a migraine. */
export function CheckIn({ date, onClose }: Props) {
  const [draft, setDraft] = useState<DailyCheckin | null>(null);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    db.checkins.get(date).then((c) => {
      setExists(!!c);
      setDraft(c ?? blankCheckin(date));
    });
  }, [date]);

  if (!draft) return null;

  const set = (patch: Partial<DailyCheckin>) => setDraft({ ...draft, ...patch });

  const changeDate = async (next: string) => {
    if (!next) return;
    const existing = await db.checkins.get(next);
    setExists(!!existing);
    setDraft(existing ?? { ...draft, date: next });
  };

  const save = async () => {
    await db.checkins.put({ ...draft, updatedAt: nowIso() });
    attachCheckinWeather(draft.date); // in the background; skipped if weather is off
    onClose();
  };

  const remove = async () => {
    if (!confirm('Delete this check-in?')) return;
    await db.checkins.delete(draft.date);
    onClose();
  };

  return (
    <div className="screen form">
      <header className="form-header">
        <button className="btn link" onClick={onClose}>
          Cancel
        </button>
        <h1>Daily check-in</h1>
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </header>

      <section className="card">
        <label className="field">
          <span className="label">Date</span>
          <input type="date" max={localDateKey(new Date())} value={draft.date} onChange={(e) => changeDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Hours of sleep last night</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            value={draft.sleepHours ?? ''}
            onChange={(e) => set({ sleepHours: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </label>
        <div className="field">
          <span className="label">Stress (1 = low, 5 = high)</span>
          <SingleChips
            label="Stress level"
            options={STRESS_LEVELS}
            value={draft.stress === undefined ? undefined : String(draft.stress)}
            onChange={(v) => set({ stress: v === undefined ? undefined : Number(v) })}
          />
        </div>
      </section>

      <section className="card">
        <h2>Anything notable today?</h2>
        <FactorPicker selected={draft.factorIds} onChange={(factorIds) => set({ factorIds })} />
      </section>

      <section className="card">
        <label className="field">
          <span className="label">Notes</span>
          <textarea rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </section>

      <div className="row spread">
        {exists ? (
          <button className="btn danger" onClick={remove}>
            Delete check-in
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

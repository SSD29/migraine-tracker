import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CATEGORIES } from '../options';
import type { Factor } from '../types';

export function useFactors() {
  return useLiveQuery(() => db.factors.orderBy('order').toArray(), []) ?? [];
}

/** Groups factors by category, in the CATEGORIES order, unknown categories last. */
export function groupFactors(factors: Factor[]) {
  const groups = new Map<string, Factor[]>();
  for (const f of factors) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  const rank = (c: string) => (CATEGORIES.includes(c) ? CATEGORIES.indexOf(c) : CATEGORIES.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/** FR-2.1: tick off possible triggers, grouped by category. Hidden factors stay visible if already selected. */
export function FactorPicker({ selected, onChange }: Props) {
  const factors = useFactors().filter((f) => !f.hidden || selected.includes(f.id));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="factor-picker">
      {groupFactors(factors).map(([category, items]) => (
        <div key={category} className="factor-group">
          <div className="factor-category">{category}</div>
          <div className="chips" role="group" aria-label={category}>
            {items.map((f) => (
              <button
                key={f.id}
                type="button"
                className="chip"
                aria-pressed={selected.includes(f.id)}
                onClick={() => toggle(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

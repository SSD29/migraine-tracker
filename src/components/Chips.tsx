import type { Option } from '../options';

interface MultiProps {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  label: string;
}

/** Tap-to-toggle chips for picking several values. */
export function MultiChips({ options, selected, onChange, label }: MultiProps) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={selected.includes(o.value)}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface SingleProps<T extends string> {
  options: Option<T>[];
  value: T | undefined;
  onChange: (next: T | undefined) => void;
  label: string;
}

/** Chips for picking one value; tapping the selected chip clears it. */
export function SingleChips<T extends string>({ options, value, onChange, label }: SingleProps<T>) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className="chip"
          aria-checked={value === o.value}
          onClick={() => onChange(value === o.value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 0–10 intensity picker. */
export function IntensityScale({ value, onPick }: { value?: number; onPick: (n: number) => void }) {
  return (
    <div className="scale" role="radiogroup" aria-label="Pain intensity, 0 to 10">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className="scale-btn"
          onClick={() => onPick(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

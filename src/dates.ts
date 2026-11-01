const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
};

/** ISO timestamp → value for <input type="datetime-local">. */
export const toInputValue = (iso: string) => {
  const d = new Date(iso);
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** <input type="datetime-local"> value (local time) → ISO timestamp. */
export const fromInputValue = (value: string) => new Date(value).toISOString();

export const nowIso = () => new Date().toISOString();

export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });

export const fmtDate = (key: string) =>
  parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export const fmtDuration = (hours: number | undefined) => {
  if (hours === undefined) return '—';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

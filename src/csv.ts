import type { DailyCheckin, Episode, Factor } from './types';
import { AURA, AURA_TYPES, IMPACTS, LOCATIONS, QUALITIES, RELIEF_RATINGS, SYMPTOMS, labelOf } from './options';
import { durationHours, peakIntensity } from './insights';

type Cell = string | number | undefined | null;

const escape = (v: Cell) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(escape).join(',')).join('\r\n');

const names = (ids: string[], factors: Factor[]) =>
  ids.map((id) => factors.find((f) => f.id === id)?.name ?? 'Deleted factor').join('; ');

const labels = (values: string[], options: { value: string; label: string }[]) =>
  values.map((v) => labelOf(options, v)).join('; ');

export function episodesCsv(episodes: Episode[], factors: Factor[]) {
  const header = [
    'Start', 'End', 'Time zone', 'Duration (hours)', 'Peak intensity (0-10)', 'Intensity readings',
    'Location', 'Quality', 'Aura', 'Aura type', 'Symptoms', 'Impact', 'Relief (as entered)',
    'Factors (24h before)', 'Notes',
  ];
  const rows = episodes.map((e) => {
    const hours = durationHours(e);
    return [
      e.startAt,
      e.endAt,
      e.tz,
      hours === undefined ? '' : hours.toFixed(2),
      peakIntensity(e),
      e.readings.map((r) => `${r.at} ${r.value}`).join('; '),
      labels(e.locations, LOCATIONS),
      labelOf(QUALITIES, e.quality),
      labelOf(AURA, e.aura),
      labels(e.auraTypes, AURA_TYPES),
      labels(e.symptoms, SYMPTOMS),
      labelOf(IMPACTS, e.impact),
      e.relief.map((r) => `${r.item} at ${r.takenAt}${r.rating ? ` (${labelOf(RELIEF_RATINGS, r.rating)})` : ''}`).join('; '),
      names(e.factorIds, factors),
      e.notes,
    ];
  });
  return toCsv([header, ...rows]);
}

export function checkinsCsv(checkins: DailyCheckin[], factors: Factor[]) {
  const header = ['Date', 'Sleep (hours)', 'Stress (1-5)', 'Factors', 'Notes'];
  const rows = checkins.map((c) => [c.date, c.sleepHours, c.stress, names(c.factorIds, factors), c.notes]);
  return toCsv([header, ...rows]);
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

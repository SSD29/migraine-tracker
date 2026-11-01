import type { DailyCheckin, Episode, Factor, WeatherSnapshot } from './types';
import { AURA, AURA_TYPES, IMPACTS, LOCATIONS, QUALITIES, SYMPTOMS, labelOf } from './options';
import { isMedication } from './db';
import { describeRelief, medicationStatus } from './relief';
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

const WEATHER_HEADER = [
  'Weather time (UTC)', 'Temperature (C)', 'Humidity (%)', 'Pressure (hPa)', 'Pressure change 24h (hPa)',
];

const weatherCells = (w: WeatherSnapshot | undefined): Cell[] =>
  w ? [w.at, w.temperatureC, w.humidity, w.pressureHpa, w.pressureChange24h] : ['', '', '', '', ''];

export function episodesCsv(episodes: Episode[], factors: Factor[]) {
  const header = [
    'Start', 'End', 'Time zone', 'Duration (hours)', 'Peak intensity (0-10)', 'Intensity readings',
    'Location', 'Quality', 'Aura', 'Aura type', 'Symptoms', 'Impact',
    'Medication taken', 'Medication (as entered)', 'Other relief (as entered)',
    'Factors (24h before)', 'Notes', ...WEATHER_HEADER,
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
      medicationStatus(e) === 'yes' ? 'Yes' : medicationStatus(e) === 'no' ? 'No' : '',
      describeRelief(e.relief.filter(isMedication), (iso) => iso),
      describeRelief(e.relief.filter((r) => !isMedication(r)), (iso) => iso),
      names(e.factorIds, factors),
      e.notes,
      ...weatherCells(e.weather),
    ];
  });
  return toCsv([header, ...rows]);
}

export function checkinsCsv(checkins: DailyCheckin[], factors: Factor[]) {
  const header = ['Date', 'Sleep (hours)', 'Stress (1-5)', 'Factors', 'Notes', ...WEATHER_HEADER];
  const rows = checkins.map((c) => [
    c.date,
    c.sleepHours,
    c.stress,
    names(c.factorIds, factors),
    c.notes,
    ...weatherCells(c.weather),
  ]);
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

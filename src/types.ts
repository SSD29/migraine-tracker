export type Aura = 'yes' | 'no' | 'unsure';
export type Impact = 'none' | 'reduced' | 'unable';
export type ReliefRating = 'none' | 'some' | 'full';

export interface IntensityReading {
  at: string; // ISO timestamp (UTC)
  value: number; // 0–10
}

export interface ReliefEntry {
  id: string;
  kind?: 'medication' | 'other'; // missing on entries made before medication was split out = 'other'
  item: string; // stored exactly as the user typed it
  takenAt: string;
  rating?: ReliefRating;
}

/** A medication the user takes, for one-tap logging. Names only; the app never suggests or doses. */
export interface Medication {
  id: string;
  name: string;
  order: number;
}

export interface Episode {
  id: string;
  startAt: string;
  endAt: string | null; // null while ongoing
  tz: string; // user's time zone when logged
  readings: IntensityReading[];
  locations: string[];
  quality?: string;
  aura?: Aura;
  auraTypes: string[];
  symptoms: string[];
  impact?: Impact;
  relief: ReliefEntry[];
  tookMedication?: boolean; // undefined = not answered
  factorIds: string[]; // factors in the 24 hours before
  notes: string;
  confirmedAt?: string; // last time the user said a long episode was still going
  weather?: WeatherSnapshot; // at the start time, if weather is turned on
  createdAt: string;
  updatedAt: string;
}

export interface WeatherSnapshot {
  at: string; // the hour the readings are for (ISO, UTC)
  temperatureC?: number;
  humidity?: number; // %
  pressureHpa?: number; // sea-level pressure
  pressureChange24h?: number; // hPa, versus 24 hours earlier
  lat: number; // rounded to ~10 km
  lon: number;
  source: 'open-meteo';
}

export interface Factor {
  id: string;
  name: string;
  category: string;
  isCustom: boolean;
  hidden: boolean;
  order: number;
}

export interface DailyCheckin {
  date: string; // local YYYY-MM-DD
  sleepHours?: number;
  stress?: number; // 1–5
  factorIds: string[];
  notes: string;
  weather?: WeatherSnapshot; // midday that day (or when logged, for today)
  updatedAt: string;
}

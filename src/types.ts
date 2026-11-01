export type Aura = 'yes' | 'no' | 'unsure';
export type Impact = 'none' | 'reduced' | 'unable';
export type ReliefRating = 'none' | 'some' | 'full';

export interface IntensityReading {
  at: string; // ISO timestamp (UTC)
  value: number; // 0–10
}

export interface ReliefEntry {
  id: string;
  item: string; // stored exactly as the user typed it
  takenAt: string;
  rating?: ReliefRating;
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
  factorIds: string[]; // factors in the 24 hours before
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  updatedAt: string;
}

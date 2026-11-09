// Optional weather context from Open-Meteo (free, no key, non-commercial use).
// Only an approximate location and the entry's time are sent; entries themselves never leave the device.
import { checkinId, db } from './db';
import { localDateKey, nowIso, parseDateKey } from './dates';
import { storage } from './lock';
import type { WeatherSnapshot } from './types';

const ENABLED_KEY = 'mt-weather';
export const weatherEnabled = () => storage.get(ENABLED_KEY) === '1';
export const setWeatherEnabled = (on: boolean) => (on ? storage.set(ENABLED_KEY, '1') : storage.remove(ENABLED_KEY));

// One decimal place is about 11 km: enough for weather, not a precise location.
export const roundCoord = (x: number) => Math.round(x * 10) / 10;

export interface Coords {
  lat: number;
  lon: number;
}

export function getLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser cannot share a location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: roundCoord(p.coords.latitude), lon: roundCoord(p.coords.longitude) }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was turned down. You can allow it in your browser settings.'
              : 'Could not get your location. Try again in a moment.',
          ),
        ),
      { enableHighAccuracy: false, maximumAge: 6 * 3_600_000, timeout: 15_000 },
    );
  });
}

// The forecast endpoint covers roughly the last 92 days; older times come from the archive.
const RECENT_DAYS = 80;
const HOURLY = 'temperature_2m,relative_humidity_2m,pressure_msl';

/** Hourly data from 24 hours before `at` through `at`, in UTC. */
export function weatherUrl({ lat, lon }: Coords, at: Date, now = new Date()) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const recent = now.getTime() - at.getTime() < RECENT_DAYS * 86_400_000;
  const base = recent ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: HOURLY,
    start_date: day(new Date(at.getTime() - 86_400_000)),
    end_date: day(at),
    timezone: 'GMT',
  });
  return `${base}?${params}`;
}

export interface Hourly {
  time: string[];
  temperature_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  pressure_msl: (number | null)[];
}

const num = (v: number | null | undefined) => (typeof v === 'number' ? v : undefined);

/** Reads the hour containing `at`, and the pressure 24 hours earlier, from an hourly response. */
export function snapshotFrom(hourly: Hourly, at: Date, { lat, lon }: Coords): WeatherSnapshot | undefined {
  const hour = `${at.toISOString().slice(0, 13)}:00`;
  const i = hourly.time.indexOf(hour);
  if (i < 0) return undefined;
  const pressure = num(hourly.pressure_msl[i]);
  const before = i >= 24 ? num(hourly.pressure_msl[i - 24]) : undefined;
  return {
    at: new Date(`${hour}Z`).toISOString(),
    temperatureC: num(hourly.temperature_2m[i]),
    humidity: num(hourly.relative_humidity_2m[i]),
    pressureHpa: pressure,
    pressureChange24h:
      pressure !== undefined && before !== undefined ? Math.round((pressure - before) * 10) / 10 : undefined,
    lat,
    lon,
    source: 'open-meteo',
  };
}

export async function fetchWeather(at: string, coords?: Coords) {
  const where = coords ?? (await getLocation());
  const when = new Date(at);
  const res = await fetch(weatherUrl(where, when));
  if (!res.ok) throw new Error(`Weather service returned ${res.status}.`);
  const data = (await res.json()) as { hourly?: Hourly };
  return data.hourly ? snapshotFrom(data.hourly, when, where) : undefined;
}

const sameHour = (a: string, b: string) => a.slice(0, 13) === new Date(b).toISOString().slice(0, 13);

/** Check-ins use midday for past days and the time of logging for today. */
export const checkinWeatherTime = (date: string, now = new Date()) => {
  if (date === localDateKey(now)) return nowIso();
  const noon = parseDateKey(date);
  noon.setHours(12);
  return noon.toISOString();
};

// The attach helpers fail quietly: weather is optional context and the app must work offline.

export async function attachEpisodeWeather(id: string, coords?: Coords) {
  if (!weatherEnabled()) return false;
  const e = await db.episodes.get(id);
  if (!e || (e.weather && sameHour(e.weather.at, e.startAt))) return false;
  try {
    const weather = await fetchWeather(e.startAt, coords);
    if (!weather) return false;
    await db.episodes.update(id, { weather });
    return true;
  } catch {
    return false;
  }
}

export async function attachCheckinWeather(date: string, coords?: Coords) {
  if (!weatherEnabled()) return false;
  const c = await db.checkins.get(checkinId(date));
  if (!c || c.weather) return false;
  try {
    const weather = await fetchWeather(checkinWeatherTime(date), coords);
    if (!weather) return false;
    await db.checkins.update(c.id, { weather });
    return true;
  } catch {
    return false;
  }
}

/** Looks up weather for every entry that doesn't have it yet. Returns how many were filled in. */
export async function fillMissingWeather(onProgress?: (done: number, total: number) => void) {
  const coords = await getLocation();
  const episodes = (await db.episodes.toArray()).filter((e) => !e.weather || !sameHour(e.weather.at, e.startAt));
  const checkins = (await db.checkins.toArray()).filter((c) => !c.weather);
  const total = episodes.length + checkins.length;
  let done = 0;
  let filled = 0;
  for (const e of episodes) {
    if (await attachEpisodeWeather(e.id, coords)) filled++;
    onProgress?.(++done, total);
  }
  for (const c of checkins) {
    if (await attachCheckinWeather(c.date, coords)) filled++;
    onProgress?.(++done, total);
  }
  return { filled, total };
}

// Fahrenheit where it's the everyday unit (FR-6.4).
const FAHRENHEIT_REGIONS = ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'];

export function usesFahrenheit() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return !!region && FAHRENHEIT_REGIONS.includes(region);
  } catch {
    return false;
  }
}

export const fmtTemp = (c: number | undefined) =>
  c === undefined ? '' : usesFahrenheit() ? `${Math.round((c * 9) / 5 + 32)} °F` : `${Math.round(c)} °C`;

export const fmtPressureChange = (d: number | undefined) =>
  d === undefined ? '' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(1)} hPa in 24 h`;

export function fmtWeather(w: WeatherSnapshot | undefined) {
  if (!w) return '';
  const pressure =
    w.pressureHpa !== undefined &&
    `${Math.round(w.pressureHpa)} hPa${w.pressureChange24h !== undefined ? ` (${fmtPressureChange(w.pressureChange24h)})` : ''}`;
  return [pressure, fmtTemp(w.temperatureC), w.humidity !== undefined && `${Math.round(w.humidity)}% humidity`]
    .filter(Boolean)
    .join(' · ');
}

import { addDays, fmtDate, fmtDuration, localDateKey } from '../dates';
import { durationHours, peakIntensity } from '../insights';
import { AURA, IMPACTS, LOCATIONS, QUALITIES, SYMPTOMS, labelOf } from '../options';
import { describeRelief, medicationStatus } from '../relief';
import { fmtWeather } from '../weather';
import type { DailyCheckin, Episode, Factor } from '../types';

// Pure part of the weekly reflection: which entries it covers and the plain-text log sent to the model.

export const REFLECTION_DAYS = 7;

export function reflectionWindow(now = new Date()) {
  const to = localDateKey(now);
  return { from: addDays(to, -(REFLECTION_DAYS - 1)), to };
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso: string) => localDateKey(new Date(iso));

/** One line per fact, in the user's own terms. Empty fields are left out rather than guessed. */
export function weekLog(episodes: Episode[], checkins: DailyCheckin[], factors: Factor[], now = new Date()) {
  const { from, to } = reflectionWindow(now);
  const name = (id: string) => factors.find((f) => f.id === id)?.name;
  const names = (ids: string[]) => ids.map(name).filter(Boolean).join(', ');
  const inWeek = episodes
    .filter((e) => dayOf(e.startAt) >= from && dayOf(e.startAt) <= to)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const days = checkins.filter((c) => c.date >= from && c.date <= to).sort((a, b) => a.date.localeCompare(b.date));

  const lines = [`Week: ${fmtDate(from)} to ${fmtDate(to)} (today is ${fmtDate(to)}).`, ''];
  lines.push(`Migraines logged: ${inWeek.length}`);
  for (const e of inWeek) {
    const peak = peakIntensity(e);
    const med = medicationStatus(e);
    const meds = e.relief.filter((r) => r.kind === 'medication');
    const other = e.relief.filter((r) => r.kind !== 'medication');
    const parts = [
      `- ${fmtDate(dayOf(e.startAt))} ${clock(e.startAt)}`,
      e.endAt ? `lasted ${fmtDuration(durationHours(e))}` : 'still in progress',
      peak !== undefined && `peak ${peak}/10`,
      e.locations.length > 0 && `where: ${e.locations.map((l) => labelOf(LOCATIONS, l)).join(', ')}`,
      e.quality && `felt ${labelOf(QUALITIES, e.quality).toLowerCase()}`,
      e.aura && `aura: ${labelOf(AURA, e.aura).toLowerCase()}`,
      e.symptoms.length > 0 && `symptoms: ${e.symptoms.map((s) => labelOf(SYMPTOMS, s).toLowerCase()).join(', ')}`,
      e.impact && `impact: ${labelOf(IMPACTS, e.impact).toLowerCase()}`,
      med === 'yes' && `medication: ${describeRelief(meds, clock) || 'yes'}`,
      med === 'no' && 'no medication',
      other.length > 0 && `other relief: ${describeRelief(other)}`,
      e.factorIds.length > 0 && `possible triggers logged: ${names(e.factorIds)}`,
      e.weather && `weather: ${fmtWeather(e.weather)}`,
      e.notes.trim() && `notes: "${e.notes.trim()}"`,
    ];
    lines.push(parts.filter(Boolean).join('; '));
  }

  lines.push('', `Daily check-ins: ${days.length} of ${REFLECTION_DAYS} days`);
  for (const c of days) {
    const parts = [
      `- ${fmtDate(c.date)}`,
      c.sleepHours !== undefined && `sleep ${c.sleepHours} h`,
      c.stress !== undefined && `stress ${c.stress}/5`,
      c.factorIds.length > 0 && `logged: ${names(c.factorIds)}`,
      c.notes.trim() && `notes: "${c.notes.trim()}"`,
    ];
    lines.push(parts.filter(Boolean).join('; '));
  }
  return { text: lines.join('\n'), episodes: inWeek.length, checkins: days.length };
}

export const REFLECT_SYSTEM = `You write a short weekly reflection for someone keeping a personal migraine log. They read it on their phone.

Write 3 short paragraphs, plain text with no headings, lists, or markdown, under 150 words in total:
1. What the week looked like: how many migraines, when, how long, how intense, using the numbers in the log.
2. What was logged around them: possible triggers, sleep, stress, weather, medication and what helped, as the person recorded it.
3. One or two neutral observations about the week's entries, such as days without check-ins or things logged on several migraine days.

Rules you must follow:
- Describe only what is in the log. Do not invent or assume anything.
- Never say or imply that something caused a migraine. Say "was logged before" or "was logged on the same day".
- Never diagnose, name conditions, or interpret symptoms.
- Never recommend, question, or comment on medications, doses, or how often medication was taken.
- Never judge how many migraines there were (no "a lot", "only", "good week", "bad week").
- No advice or suggestions of any kind, including lifestyle tips. If something might be worth raising, say it could be discussed with their healthcare provider.
- Speak to the person as "you", in a warm, calm, matter-of-fact tone.`;

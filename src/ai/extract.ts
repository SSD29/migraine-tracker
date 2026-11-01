import { z } from 'zod/v4';
import { blankEpisode, newId } from '../db';
import { fromInputValue, nowIso } from '../dates';
import { AURA, AURA_TYPES, IMPACTS, LOCATIONS, QUALITIES, RELIEF_RATINGS, SYMPTOMS, type Option } from '../options';
import type { Episode, Factor, ReliefEntry } from '../types';

// Pure part of "log by typing": the schema the model must fill, the prompt, and the conversion
// of its answer into an unsaved episode draft. No network here, so it can be unit-tested.

const values = <T extends string>(options: Option<T>[]) => options.map((o) => o.value) as [T, ...T[]];
const rating = z.enum(values(RELIEF_RATINGS)).nullable();
// Local wall-clock time as YYYY-MM-DDTHH:mm, the same format as <input type="datetime-local">.
const localTime = z.string().nullable();

export function extractionSchema(factorNames: string[]) {
  return z.object({
    startAt: localTime.describe('When the migraine started, local time YYYY-MM-DDTHH:mm. Null if not stated.'),
    endAt: localTime.describe('When it ended, local time YYYY-MM-DDTHH:mm. Null if still going or not stated.'),
    stillGoing: z.boolean().describe('True only if the user says it is still going.'),
    peakIntensity: z.number().int().nullable().describe('Worst pain 0-10 if the user gave a number or clear word.'),
    locations: z.array(z.enum(values(LOCATIONS))),
    quality: z.enum(values(QUALITIES)).nullable(),
    aura: z.enum(values(AURA)).nullable(),
    auraTypes: z.array(z.enum(values(AURA_TYPES))),
    symptoms: z.array(z.enum(values(SYMPTOMS))),
    impact: z.enum(values(IMPACTS)).nullable(),
    tookMedication: z.boolean().nullable().describe('True or false only if the user said so.'),
    medications: z.array(
      z.object({
        name: z.string().describe("Exactly as the user wrote it, including any dose they wrote."),
        takenAt: localTime,
        rating,
      }),
    ),
    otherRelief: z.array(z.object({ item: z.string(), rating })).describe('Non-medication things that helped or were tried.'),
    factors: factorNames.length
      ? z.array(z.enum(factorNames as [string, ...string[]])).describe('Only from the given list, only if mentioned.')
      : z.array(z.string()),
    notes: z.string().describe('Anything the user said that does not fit a field above, in their words. Empty if nothing.'),
  });
}

export type Extraction = z.infer<ReturnType<typeof extractionSchema>>;

export const EXTRACT_SYSTEM = `You turn a person's description of one migraine into fields for their personal migraine log.

Rules:
- Record only what the person said. Never guess or fill in typical values; leave a field null or empty when it was not mentioned.
- Map their words to the closest listed option (e.g. "pounding" is throbbing, "couldn't work" is unable to function, "light hurt" is light sensitivity).
- Resolve relative times ("this morning", "yesterday at 3") using the current date and time you are given. Use 24-hour local time.
- Copy medication names and doses exactly as written. Never add, correct, or comment on a medication or dose.
- Put anything that does not fit a field into notes, in the person's own words.
- This is a record-keeping tool. Do not diagnose, advise, or add any text of your own.`;

export function extractPrompt(text: string, now: Date, factorNames: string[], medicationNames: string[]) {
  const local = now.toLocaleString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return [
    `Current local date and time: ${local}.`,
    `Possible triggers this person tracks: ${factorNames.join('; ') || 'none'}.`,
    `Medications this person has logged before: ${medicationNames.join('; ') || 'none'}.`,
    '',
    '<description>',
    text,
    '</description>',
  ].join('\n');
}

const toIso = (local: string | null) => {
  if (!local) return null;
  const t = Date.parse(local);
  return Number.isNaN(t) ? null : fromInputValue(local);
};

/** Turns the model's answer into a draft for the episode form. The user reviews it before anything is saved. */
export function draftFromExtraction(x: Extraction, factors: Factor[], now = new Date(), allowOngoing = true): Episode {
  const nowStr = now.toISOString();
  const ongoing = x.stillGoing && allowOngoing; // only one migraine can be in progress at a time
  let startAt = toIso(x.startAt);
  // Same defaults as "Log a past migraine": ends now, started two hours before the end.
  let endAt = ongoing ? null : (toIso(x.endAt) ?? nowStr);
  if (endAt && endAt > nowStr) endAt = nowStr;
  if (!startAt) startAt = new Date(Date.parse(endAt ?? nowStr) - 2 * 3_600_000).toISOString();
  if (startAt > nowStr) startAt = nowStr;
  if (endAt && endAt <= startAt) endAt = new Date(Date.parse(startAt) + 3_600_000).toISOString();

  const byName = new Map(factors.map((f) => [f.name.toLowerCase(), f.id]));
  const factorIds = [...new Set(x.factors.map((n) => byName.get(n.toLowerCase())).filter((id): id is string => !!id))];

  const relief: ReliefEntry[] = [
    ...x.medications
      .filter((m) => m.name.trim())
      .map((m) => ({ id: newId(), kind: 'medication' as const, item: m.name.trim(), takenAt: toIso(m.takenAt) ?? startAt, rating: m.rating ?? undefined })),
    ...x.otherRelief
      .filter((r) => r.item.trim())
      .map((r) => ({ id: newId(), kind: 'other' as const, item: r.item.trim(), takenAt: startAt, rating: r.rating ?? undefined })),
  ];

  const peak = x.peakIntensity === null ? null : Math.min(10, Math.max(0, Math.round(x.peakIntensity)));
  const hasMed = relief.some((r) => r.kind === 'medication');

  return {
    ...blankEpisode(startAt),
    endAt,
    readings: peak === null ? [] : [{ at: startAt, value: peak }],
    locations: x.locations,
    quality: x.quality ?? undefined,
    aura: x.aura ?? undefined,
    auraTypes: x.aura === 'yes' ? x.auraTypes : [],
    symptoms: x.symptoms,
    impact: x.impact ?? undefined,
    relief,
    tookMedication: hasMed ? true : (x.tookMedication ?? undefined),
    factorIds,
    notes: x.notes.trim(),
    createdAt: nowIso(),
  };
}

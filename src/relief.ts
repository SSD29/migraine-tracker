import { isMedication } from './db';
import { RELIEF_RATINGS, labelOf } from './options';
import type { Episode, ReliefEntry } from './types';

/** 'yes' if any medication was logged or the user said so, 'no' if they said not, otherwise unknown. */
export function medicationStatus(e: Episode): 'yes' | 'no' | undefined {
  if (e.relief.some(isMedication) || e.tookMedication) return 'yes';
  return e.tookMedication === false ? 'no' : undefined;
}

/** "Naprosyn 500 mg (some relief); Rest (full relief)": the user's own words plus their rating. */
export const describeRelief = (entries: ReliefEntry[], time?: (iso: string) => string) =>
  entries
    .map(
      (r) =>
        `${r.item}${time ? ` at ${time(r.takenAt)}` : ''}${r.rating ? ` (${labelOf(RELIEF_RATINGS, r.rating).toLowerCase()})` : ''}`,
    )
    .join('; ');

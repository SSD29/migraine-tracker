import { db, ongoingEpisode } from '../db';
import { loadProvider } from './client';
import { EXTRACT_SYSTEM, draftFromExtraction, extractPrompt, extractionSchema } from './extract';

/** Sends the user's description to the chosen AI and returns an unsaved episode draft. */
export async function describeEpisode(text: string) {
  const now = new Date();
  const factors = (await db.factors.orderBy('order').toArray()).filter((f) => !f.hidden);
  const medicationNames = (await db.medications.orderBy('order').toArray()).map((m) => m.name);
  const factorNames = factors.map((f) => f.name);

  const ai = await loadProvider();
  const extraction = await ai.extract(
    extractionSchema(factorNames),
    EXTRACT_SYSTEM,
    extractPrompt(text, now, factorNames, medicationNames),
  );
  const allowOngoing = !(await ongoingEpisode());
  return draftFromExtraction(extraction, factors, now, allowOngoing);
}

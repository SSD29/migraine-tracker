import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { db, ongoingEpisode } from '../db';
import { FALLBACK, MODEL, aiClient } from './client';
import { EXTRACT_SYSTEM, draftFromExtraction, extractPrompt, extractionSchema } from './extract';

/**
 * Sends the user's description to Claude and returns an unsaved episode draft.
 * Structured outputs make the reply match the schema, so it can be used without hand-parsing.
 */
export async function describeEpisode(text: string) {
  const now = new Date();
  const factors = (await db.factors.orderBy('order').toArray()).filter((f) => !f.hidden);
  const medicationNames = (await db.medications.orderBy('order').toArray()).map((m) => m.name);
  const factorNames = factors.map((f) => f.name);

  const response = await aiClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK(),
    output_config: { effort: 'low', format: betaZodOutputFormat(extractionSchema(factorNames)) },
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: extractPrompt(text, now, factorNames, medicationNames) }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The AI could not process this description.');
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new Error('The AI reply was incomplete. Try a shorter description.');
  }
  const allowOngoing = !(await ongoingEpisode());
  return draftFromExtraction(response.parsed_output, factors, now, allowOngoing);
}

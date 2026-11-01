import { db } from '../db';
import { FALLBACK, MODEL, aiClient } from './client';
import { REFLECT_SYSTEM, weekLog } from './reflect';

/**
 * Streams a reflection on the last 7 days, calling onText as each piece arrives
 * so it appears word by word instead of after a long pause.
 */
export async function streamReflection(onText: (soFar: string) => void, now = new Date()) {
  const [episodes, checkins, factors] = await Promise.all([db.episodes.toArray(), db.checkins.toArray(), db.factors.toArray()]);
  const log = weekLog(episodes, checkins, factors, now);

  const stream = aiClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK(),
    output_config: { effort: 'medium' },
    system: REFLECT_SYSTEM,
    messages: [{ role: 'user', content: `Here is my log for the past week:\n\n<log>\n${log.text}\n</log>` }],
  });

  let soFar = '';
  stream.on('text', (delta) => {
    soFar += delta;
    onText(soFar);
  });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('The AI could not write a reflection for this week.');
  return soFar.trim();
}

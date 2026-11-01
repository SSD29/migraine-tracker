import { db } from '../db';
import { loadProvider } from './client';
import { REFLECT_SYSTEM, weekLog } from './reflect';

/**
 * Streams a reflection on the last 7 days, calling onText as each piece arrives
 * so it appears word by word instead of after a long pause.
 */
export async function streamReflection(onText: (soFar: string) => void, now = new Date()) {
  const [episodes, checkins, factors] = await Promise.all([db.episodes.toArray(), db.checkins.toArray(), db.factors.toArray()]);
  const log = weekLog(episodes, checkins, factors, now);
  const ai = await loadProvider();
  return ai.stream(REFLECT_SYSTEM, `Here is my log for the past week:\n\n<log>\n${log.text}\n</log>`, onText);
}

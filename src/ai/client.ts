import type { z } from 'zod/v4';
import { getProvider } from './key';

// The app talks to one interface; each provider's SDK is loaded only when that provider is chosen.

export interface AiProvider {
  /** One request whose reply must match the schema; returns the validated object. */
  extract<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<T>;
  /** Streams plain text, calling onText with everything so far; returns the full text. */
  stream(system: string, prompt: string, onText: (soFar: string) => void): Promise<string>;
  /** Checks a key without generating anything. */
  test(): Promise<void>;
  /** A short, plain-language message for a failure from this provider. */
  errorMessage(err: unknown): string;
}

export const REFUSED = 'The AI could not process this request.';
export const INCOMPLETE = 'The AI reply was incomplete. Try again, or with a shorter description.';
export const NO_KEY = 'Add your API key in Settings to use AI features.';

export async function loadProvider(): Promise<AiProvider> {
  return getProvider() === 'gemini' ? (await import('./gemini')).gemini : (await import('./claude')).claude;
}

export async function testApiKey() {
  await (await loadProvider()).test();
}

export async function aiErrorMessage(err: unknown): Promise<string> {
  try {
    return (await loadProvider()).errorMessage(err);
  } catch {
    return err instanceof Error ? err.message : 'Something went wrong.';
  }
}

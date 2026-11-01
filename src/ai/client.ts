import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from './key';

export const MODEL = 'claude-opus-5-5';

// If the model declines a request, the API retries it on a fallback model it picks by itself.
export const FALLBACK = () => ({
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
});

export function aiClient() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use AI features.');
  // The key belongs to the user and stays on their device; there is no server to hide it behind.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** A short, plain-language message for any failure, most specific first. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Your API key was not accepted. Check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use this model.';
  if (err instanceof Anthropic.RateLimitError) return 'Too many requests right now. Try again in a minute.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Check your connection.';
  if (err instanceof Anthropic.APIError) {
    if (err.status === 400 && /credit balance/i.test(err.message)) return 'Your Anthropic account is out of credit.';
    return `The AI service returned an error (${err.status ?? 'unknown'}). Try again later.`;
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** Checks a key without generating anything (listing a model costs nothing). */
export async function testApiKey() {
  await aiClient().models.retrieve(MODEL);
}

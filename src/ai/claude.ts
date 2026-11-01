import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { INCOMPLETE, NO_KEY, REFUSED, type AiProvider } from './client';
import { getApiKey } from './key';

const MODEL = 'claude-opus-5-5';

// If the model declines a request, the API retries it on a fallback model it picks by itself.
const FALLBACK = () => ({
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
});

function client() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error(NO_KEY);
  // The key belongs to the user and stays on their device; there is no server to hide it behind.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export const claude: AiProvider = {
  // Structured outputs make the reply match the schema, so it can be used without hand-parsing.
  async extract(schema, system, prompt) {
    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      ...FALLBACK(),
      output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new Error(REFUSED);
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new Error(INCOMPLETE);
    return response.parsed_output;
  },

  async stream(system, prompt, onText) {
    const stream = client().beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK(),
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    let soFar = '';
    stream.on('text', (delta) => {
      soFar += delta;
      onText(soFar);
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error(REFUSED);
    return soFar.trim();
  },

  // Looking up a model costs nothing.
  async test() {
    await client().models.retrieve(MODEL);
  },

  errorMessage(err) {
    if (err instanceof Anthropic.AuthenticationError) return 'Your API key was not accepted. Check it in Settings.';
    if (err instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use this model.';
    if (err instanceof Anthropic.RateLimitError) return 'Too many requests right now. Try again in a minute.';
    if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Check your connection.';
    if (err instanceof Anthropic.APIError) {
      if (err.status === 400 && /credit balance/i.test(err.message)) return 'Your Anthropic account is out of credit.';
      return `The AI service returned an error (${err.status ?? 'unknown'}). Try again later.`;
    }
    return err instanceof Error ? err.message : 'Something went wrong.';
  },
};

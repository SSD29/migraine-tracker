import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod/v4';
import { INCOMPLETE, NO_KEY, REFUSED, type AiProvider } from './client';
import { getApiKey } from './key';

// An alias for Google's current Flash model, which the free API tier includes.
const MODEL = 'gemini-flash-latest';

function client() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error(NO_KEY);
  return new GoogleGenAI({ apiKey });
}

export const gemini: AiProvider = {
  // Gemini takes a JSON schema rather than zod, and doesn't check its reply against it as strictly
  // as Claude's structured outputs, so the reply is validated here with the same zod schema.
  async extract(schema, system, prompt) {
    const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema);
    const response = await client().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: jsonSchema },
    });
    const text = response.text;
    if (!text) throw new Error(REFUSED); // blocked by Google's safety filters, or no answer
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Error(INCOMPLETE);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(INCOMPLETE);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new Error("The AI reply didn't fit the form. Try again.");
    return parsed.data;
  },

  async stream(system, prompt, onText) {
    const stream = await client().models.generateContentStream({
      model: MODEL,
      contents: prompt,
      config: { systemInstruction: system },
    });
    let soFar = '';
    for await (const chunk of stream) {
      if (!chunk.text) continue;
      soFar += chunk.text;
      onText(soFar);
    }
    if (!soFar.trim()) throw new Error(REFUSED);
    return soFar.trim();
  },

  // Looking up a model costs nothing and fails on a bad key.
  async test() {
    await client().models.get({ model: MODEL });
  },

  errorMessage(err) {
    if (err instanceof ApiError) {
      if (/api key/i.test(err.message) || err.status === 401) return 'Your API key was not accepted. Check it in Settings.';
      if (/location/i.test(err.message)) return "Google's Gemini API isn't available where you are.";
      if (err.status === 403) return 'This API key is not allowed to use Gemini.';
      if (err.status === 429) return "You've reached Gemini's usage limit for now. Try again in a minute, or tomorrow.";
      if (err.status >= 500) return 'Gemini is having problems right now. Try again later.';
      return `The AI service returned an error (${err.status}). Try again later.`;
    }
    if (err instanceof TypeError) return 'Could not reach the AI service. Check your connection.';
    return err instanceof Error ? err.message : 'Something went wrong.';
  },
};

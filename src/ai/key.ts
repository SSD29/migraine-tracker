import { storage } from '../lock';

// The user's own API key, kept only in this browser. Never in backups or exports.
const KEY = 'mt-ai-key';
const PROVIDER = 'mt-ai-provider';

export type Provider = 'gemini' | 'anthropic';

export const PROVIDERS: Record<Provider, { model: string; company: string; keyHint: string; keySite: string }> = {
  gemini: { model: 'Gemini', company: 'Google', keyHint: 'AIza…', keySite: 'aistudio.google.com' },
  anthropic: { model: 'Claude', company: 'Anthropic', keyHint: 'sk-ant-…', keySite: 'console.anthropic.com' },
};

export const getApiKey = () => storage.get(KEY);
export const getProvider = (): Provider => (storage.get(PROVIDER) === 'gemini' ? 'gemini' : 'anthropic');
export const setApiKey = (provider: Provider, key: string) => {
  storage.set(PROVIDER, provider);
  storage.set(KEY, key.trim());
};
export const clearApiKey = () => {
  storage.remove(KEY);
  storage.remove(PROVIDER);
};
export const aiEnabled = () => !!getApiKey();
/** Who receives what the user sends, for privacy notes. */
export const aiCompany = () => PROVIDERS[getProvider()].company;

export const AI_NOTE = 'Written by AI from your entries. It can make mistakes, so check it against your log.';

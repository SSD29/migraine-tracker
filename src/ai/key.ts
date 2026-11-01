import { storage } from '../lock';

// The user's own Anthropic API key, kept only in this browser. Never in backups or exports.
const KEY = 'mt-ai-key';

export const getApiKey = () => storage.get(KEY);
export const setApiKey = (key: string) => storage.set(KEY, key.trim());
export const clearApiKey = () => storage.remove(KEY);
export const aiEnabled = () => !!getApiKey();

export const AI_NOTE = 'Written by AI from your entries. It can make mistakes, so check it against your log.';

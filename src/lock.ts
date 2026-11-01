// FR-6.2 app lock. A PIN keeps casual onlookers out; it does not encrypt the data in the browser.
const PIN_KEY = 'mt-pin';
export const ONBOARDED_KEY = 'mt-onboarded';

export const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private mode); the setting just won't persist.
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hash(pin: string, salt: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)));
}

export const hasPin = () => storage.get(PIN_KEY) !== null;

export async function setPin(pin: string) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  storage.set(PIN_KEY, JSON.stringify({ salt, hash: await hash(pin, salt) }));
}

export async function checkPin(pin: string) {
  const raw = storage.get(PIN_KEY);
  if (!raw) return true;
  const { salt, hash: expected } = JSON.parse(raw) as { salt: string; hash: string };
  return (await hash(pin, salt)) === expected;
}

export const clearPin = () => storage.remove(PIN_KEY);

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

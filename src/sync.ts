import { db, importLocalData, seedPresets } from './db';

/**
 * Runs once at startup. Opening the database asks for sign-in the first time on a device
 * (Dexie Cloud's own email-code dialog), then pulls what's already in the account before
 * adding anything, so a new device doesn't duplicate what the account already has.
 */
let started: Promise<void> | null = null;

export function startSync() {
  started ??= run();
  return started;
}

async function run() {
  await db.open();
  try {
    await db.cloud.sync({ wait: true, purpose: 'pull' });
  } catch {
    // Offline: carry on with what's on this device; it syncs when the connection is back.
  }
  // Import first, so a device's own preset settings (hidden, renamed, reordered) carry over
  // into a new account instead of the defaults; an account that has them keeps its own.
  await importLocalData();
  await seedPresets();
}

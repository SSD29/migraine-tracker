import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteAllData, exportBackup, newId, rememberMedications, restoreBackup } from '../db';
import { localDateKey } from '../dates';
import { CATEGORIES, DISCLAIMER, SAFETY_NOTE } from '../options';
import { downloadFile } from '../csv';
import { clearPin, hasPin, setPin, validPin } from '../lock';
import { fetchWeather, fillMissingWeather, getLocation, setWeatherEnabled, weatherEnabled } from '../weather';
import { groupFactors, useFactors } from '../components/FactorPicker';
import { aiEnabled, clearApiKey, getApiKey, setApiKey } from '../ai/key';
import type { Factor, Medication } from '../types';

export function Settings({ onLockNow }: { onLockNow: () => void }) {
  return (
    <div className="screen">
      <MedicationSettings />
      <FactorSettings />
      <WeatherSettings />
      <AiSettings />
      <LockSettings onLockNow={onLockNow} />
      <DataSettings />
      <section className="card">
        <h2>About and safety</h2>
        <p>{DISCLAIMER}</p>
        <p className="note">{SAFETY_NOTE}</p>
        <p className="muted small">
          Your entries are stored only in this browser on this device. Weather and AI features, when you turn them on,
          send only what their descriptions say. Dates, times, and temperature units follow your
          device settings.
        </p>
      </section>
    </div>
  );
}

function MedicationSettings() {
  const meds = useLiveQuery(() => db.medications.orderBy('order').toArray(), []) ?? [];
  const [name, setName] = useState('');

  const add = async () => {
    await rememberMedications([name]);
    setName('');
  };

  const rename = async (m: Medication) => {
    const next = prompt('Rename medication', m.name)?.trim();
    if (next) await db.medications.update(m.id, { name: next });
  };

  const remove = async (m: Medication) => {
    if (!confirm(`Remove ${m.name} from your list? Past entries keep it.`)) return;
    await db.medications.delete(m.id);
  };

  return (
    <section className="card">
      <h2>My medications</h2>
      <p className="muted">
        The first three appear as one-tap buttons while a migraine is in progress. Names you type in an episode are added
        here automatically.
      </p>
      <div className="row">
        <input
          type="text"
          aria-label="Medication name"
          placeholder="Name, and dose if you like"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && add()}
        />
        <button className="btn" onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {meds.length > 0 && (
        <ul className="list compact">
          {meds.map((m) => (
            <li key={m.id} className="factor-row">
              <span>{m.name}</span>
              <span className="row tight">
                <button className="btn small" onClick={() => rename(m)}>
                  Rename
                </button>
                <button className="btn small" onClick={() => remove(m)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">The app only records what you enter. It never suggests medications or doses.</p>
    </section>
  );
}

function FactorSettings() {
  const factors = useFactors();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const order = Math.max(-1, ...factors.map((f) => f.order)) + 1;
    await db.factors.add({ id: newId(), name: trimmed, category, isCustom: true, hidden: false, order });
    setName('');
  };

  const rename = async (f: Factor) => {
    const next = prompt('Rename trigger', f.name)?.trim();
    if (next) await db.factors.update(f.id, { name: next });
  };

  // Swap order with the neighbour in the same category.
  const move = async (items: Factor[], i: number, delta: number) => {
    const a = items[i];
    const b = items[i + delta];
    if (!b) return;
    await db.transaction('rw', db.factors, async () => {
      await db.factors.update(a.id, { order: b.order });
      await db.factors.update(b.id, { order: a.order });
    });
  };

  return (
    <section className="card">
      <h2>Possible triggers</h2>
      <p className="muted">Add your own, rename, reorder, or hide ones that don't apply.</p>
      <div className="row wrap">
        <input type="text" aria-label="New trigger name" placeholder="Add your own" value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn" onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>
      <details className="factor-manage">
        <summary>Manage all {factors.length} triggers</summary>
        {groupFactors(factors).map(([cat, items]) => (
          <div key={cat} className="factor-group">
            <div className="factor-category">{cat}</div>
            <ul className="list compact">
              {items.map((f, i) => (
                <li key={f.id} className={`factor-row ${f.hidden ? 'is-hidden' : ''}`}>
                  <span>{f.name}</span>
                  <span className="row tight">
                    <button className="btn icon" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(items, i, -1)}>↑</button>
                    <button className="btn icon" aria-label={`Move ${f.name} down`} disabled={i === items.length - 1} onClick={() => move(items, i, 1)}>↓</button>
                    <button className="btn small" onClick={() => rename(f)}>Rename</button>
                    <button className="btn small" onClick={() => db.factors.update(f.id, { hidden: !f.hidden })}>
                      {f.hidden ? 'Show' : 'Hide'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}

function WeatherSettings() {
  const [enabled, setEnabled] = useState(weatherEnabled());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const fill = async () => {
    setBusy(true);
    try {
      const { filled, total } = await fillMissingWeather((done, all) => setMessage(`Looking up weather… ${done} of ${all}`));
      setMessage(
        total === 0
          ? 'All your entries already have weather.'
          : `Added weather to ${filled} of ${total} entries.${filled < total ? ' The rest can be tried again later.' : ''}`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not look up weather.');
    } finally {
      setBusy(false);
    }
  };

  const turnOn = async () => {
    setBusy(true);
    setMessage('Asking for your location…');
    try {
      const coords = await getLocation();
      await fetchWeather(new Date().toISOString(), coords); // confirm the service is reachable
      setWeatherEnabled(true);
      setEnabled(true);
      setBusy(false);
      await fill();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not turn on weather.');
      setBusy(false);
    }
  };

  const turnOff = () => {
    setWeatherEnabled(false);
    setEnabled(false);
    setMessage('Weather is off. Weather already saved with your entries is kept.');
  };

  return (
    <section className="card">
      <h2>Weather</h2>
      <p className="muted">
        Adds air pressure, temperature, and humidity to each episode and check-in, so you can see how pressure changed
        before episodes.
      </p>
      <p className="muted small">
        When on, the app sends your approximate location (rounded to about 10 km) and the time of each entry to
        Open-Meteo, a free weather service. Nothing else from your entries is sent. Past entries use your current
        location.
      </p>
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      <div className="row wrap">
        {enabled ? (
          <>
            <button className="btn" onClick={fill} disabled={busy}>
              Fill in missing weather
            </button>
            <button className="btn" onClick={turnOff} disabled={busy}>
              Turn off
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={turnOn} disabled={busy}>
            Turn on weather
          </button>
        )}
      </div>
    </section>
  );
}

function AiSettings() {
  const [enabled, setEnabled] = useState(aiEnabled());
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    setBusy(true);
    setMessage('Checking the key…');
    const previous = getApiKey();
    setApiKey(key);
    try {
      const { testApiKey } = await import('../ai/client');
      await testApiKey();
      setEnabled(true);
      setKey('');
      setMessage('AI features are on.');
    } catch (err) {
      const { aiErrorMessage } = await import('../ai/client');
      if (previous) setApiKey(previous); // keep the key that worked
      else clearApiKey();
      setMessage(aiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!confirm('Remove your API key from this device? AI features will turn off.')) return;
    clearApiKey();
    setEnabled(false);
    setMessage('AI features are off. Your key is no longer stored here.');
  };

  return (
    <section className="card">
      <h2>AI features</h2>
      <p className="muted">
        Describe a migraine in your own words and have the form filled in for you to check, and get a short reflection
        on your week on the Patterns page. Uses Claude, by Anthropic.
      </p>
      <p className="muted small">
        Needs your own Anthropic API key (from console.anthropic.com), which is stored only on this device and never in
        backups. When you use an AI feature, the text you typed or that week's entries are sent to Anthropic. Each use
        costs a cent or two on your Anthropic account. AI never diagnoses or suggests medications or doses.
      </p>
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      <div className="row">
        <input
          type="password"
          autoComplete="off"
          aria-label="Anthropic API key"
          placeholder={enabled ? 'Replace key (sk-ant-…)' : 'Paste your key (sk-ant-…)'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button className="btn primary" onClick={save} disabled={busy || !key.trim()}>
          Save
        </button>
      </div>
      {enabled && (
        <div className="row wrap">
          <button className="btn" onClick={remove} disabled={busy}>
            Remove key
          </button>
        </div>
      )}
    </section>
  );
}

function LockSettings({ onLockNow }: { onLockNow: () => void }) {
  const [enabled, setEnabled] = useState(hasPin());
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');

  const save = async () => {
    if (!validPin(pin)) return setMessage('Use 4 to 8 digits.');
    if (pin !== confirmPin) return setMessage("The PINs don't match.");
    await setPin(pin);
    setEnabled(true);
    setPinValue('');
    setConfirmPin('');
    setMessage('PIN saved. The app will ask for it each time it opens.');
  };

  return (
    <section className="card">
      <h2>App lock</h2>
      <p className="muted">
        A PIN stops others from opening the app on this device. If you forget it, you'll need to clear this site's data
        in your browser, which also removes your entries.
      </p>
      <div className="grid2">
        <label className="field">
          <span className="label">{enabled ? 'New PIN' : 'PIN'}</span>
          <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          <span className="label">Confirm PIN</span>
          <input type="password" inputMode="numeric" maxLength={8} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
      <div className="row wrap">
        <button className="btn" onClick={save}>
          {enabled ? 'Change PIN' : 'Set PIN'}
        </button>
        {enabled && (
          <>
            <button className="btn" onClick={onLockNow}>
              Lock now
            </button>
            <button
              className="btn"
              onClick={() => {
                clearPin();
                setEnabled(false);
                setMessage('PIN removed.');
              }}
            >
              Remove PIN
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function DataSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [confirming, setConfirming] = useState(false);

  const backup = async () => {
    const data = await exportBackup();
    downloadFile(`migraine-backup-${localDateKey(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    if (!confirm('Restoring replaces everything currently in the app with the backup. Continue?')) return;
    try {
      await restoreBackup(JSON.parse(await file.text()));
      setMessage('Backup restored.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const wipe = async () => {
    await deleteAllData();
    setConfirming(false);
    setConfirmText('');
    setMessage('All entries deleted from this device.');
  };

  return (
    <section className="card">
      <h2>Your data</h2>
      <p className="muted">Backups never include your API key. Save a backup file to move your entries to another device or keep a copy.</p>
      <div className="row wrap">
        <button className="btn" onClick={backup}>
          Save backup file
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Restore from backup
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </div>
      {message && <p className="muted" role="status">{message}</p>}

      <div className="danger-zone">
        {!confirming ? (
          <button className="btn danger" onClick={() => setConfirming(true)}>
            Delete all data
          </button>
        ) : (
          <>
            <label className="field">
              <span className="label">This permanently deletes every episode, check-in, custom trigger, and saved medication. Type DELETE to confirm.</span>
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </label>
            <div className="row">
              <button className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="btn danger" disabled={confirmText !== 'DELETE'} onClick={wipe}>
                Delete everything
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

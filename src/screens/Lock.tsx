import { useState } from 'react';
import { checkPin } from '../lock';
import { Logo } from '../components/Icon';

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await checkPin(pin)) onUnlock();
    else {
      setError('That PIN is not right.');
      setPin('');
    }
  };

  return (
    <form className="lock" onSubmit={submit}>
      <Logo size={56} />
      <h1>Migraine Tracker</h1>
      <label className="field">
        <span className="label">Enter your PIN</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" type="submit" disabled={pin.length < 4}>
        Unlock
      </button>
    </form>
  );
}

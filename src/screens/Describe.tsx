import { useState } from 'react';
import { aiCompany } from '../ai/key';
import type { Episode } from '../types';

interface Props {
  onDraft: (draft: Episode, text: string) => void;
  onClose: () => void;
}

const EXAMPLE =
  'e.g. Started yesterday around 3pm behind my left eye, throbbing, about 7/10. Light hurt and I felt sick. Took Naprosyn at 4, some relief. Slept badly the night before and skipped lunch. Gone by 10pm.';

/** "Log by typing": the user describes a migraine, AI fills the form, the user checks it and saves. */
export function Describe({ onDraft, onClose }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { describeEpisode } = await import('../ai/describe');
      onDraft(await describeEpisode(text.trim()), text.trim());
    } catch (err) {
      const { aiErrorMessage } = await import('../ai/client');
      setError(await aiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="screen form">
      <header className="form-header">
        <button className="btn link" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <h1>Describe a migraine</h1>
        <span />
      </header>

      <section className="card">
        <label className="field">
          <span>In your own words</span>
          <textarea
            rows={7}
            autoFocus
            placeholder={EXAMPLE}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
        </label>
        <p className="muted small">
          Include whatever you remember: when it started and ended, where it hurt, how bad, symptoms, medication, and
          what happened before. You can use the microphone on your keyboard to speak instead.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary big" onClick={submit} disabled={busy || text.trim().length < 5}>
          {busy ? 'Reading your description…' : 'Fill in the form'}
        </button>
        <p className="muted small">
          Your description is sent to {aiCompany()}'s AI to fill in the form. Nothing is saved until you check it and tap
          Save.
        </p>
      </section>
    </div>
  );
}

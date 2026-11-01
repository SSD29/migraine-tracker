# Migraine Tracker

A private, local-first web app for logging migraine episodes and possible triggers. It records and summarizes what you enter; it does not diagnose or recommend treatment. Product requirements: [Migraine-Tracker-PRD.md](Migraine-Tracker-PRD.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the insights logic
npm run build      # production build in dist/
```

To use it on a phone, deploy `dist/` to any static host with HTTPS, open it in Safari or Chrome, and choose **Add to Home Screen**.

## How it's built

- React + TypeScript + Vite. No backend.
- Data lives in the browser's IndexedDB via Dexie (`src/db.ts`). Nothing is uploaded unless the user turns on weather or AI.
- `src/insights.ts` holds the counting logic (attack days, factor frequency, time patterns) as pure, tested functions.
- Guardrail copy (disclaimer, safety note, insight note) lives in `src/options.ts`. Change it only after a guardrail review.
- `src/weather.ts` looks up weather from [Open-Meteo](https://open-meteo.com) (free, no key, non-commercial use) when the user turns it on. Only a rounded location (about 10 km) and the entry's time are sent.
- `src/ai/` holds the optional AI features (Claude, via `@anthropic-ai/sdk`). See below.
- `public/sw.js` caches the app shell so it opens offline (production builds only).

## AI features

Optional, and off until the user pastes their own Anthropic API key in Settings. The key stays in this browser's localStorage and is never in backups. The SDK is loaded only when a feature is used.

- **Describe a migraine in words** (`src/ai/extract.ts`, `src/ai/describe.ts`): the description goes to `claude-opus-5-5` with a structured-output schema built from the app's own option lists and the user's trigger names, so the reply always fits the form. `draftFromExtraction` turns it into an unsaved draft (clamping intensity, keeping times in the past, allowing only one ongoing episode); the user checks it in the episode form before saving.
- **Weekly reflection** (`src/ai/reflect.ts`, `src/ai/reflection.ts`): the last 7 days of episodes and check-ins become a plain-text log; the reply streams in word by word. The system prompt bans causal claims, diagnosis, medication or dose comments, judgements about frequency, and advice. The last reflection is cached on the device.
- Both requests opt into server-side refusal fallbacks (`fallbacks: "default"`). Errors map to plain messages in `src/ai/client.ts`.
- Pure parts are unit-tested in `src/ai/ai.test.ts`; network calls are not tested automatically.

Calling the API from the browser with the user's own key is fine for a personal app. A shared app would put the key behind a small server instead.

## PRD coverage in this version

Built: one-tap start, backfill, all episode fields, intensity readings, medication (yes/no, one-tap logging from a personal list) and other relief, attack mode, multi-day episodes (with a daily "still going?" check), preset and custom factors, daily check-in, calendar and filtered list, monthly counts, factor frequency (after 10 episodes and 30 days), time patterns, optional weather (pressure, temperature, humidity) with pressure-change patterns, printable PDF report, CSV export, PIN lock, backup and restore, delete all data.

Not yet:
- Daily check-in reminder (needs push notifications or a native app).
- Apple Health / Health Connect integration (planned for v1.1).
- Accounts and encrypted cloud sync. Use backup files for now.
- Encryption at rest. The PIN blocks casual access but browser storage is not encrypted by the app.
- Biometric unlock.

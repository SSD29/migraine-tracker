# Migraine Tracker — Product Requirements Document

Last updated: November 1, 2026

## Overview

Migraine Tracker is a personal logging app. People use it to record migraine episodes and the factors around them, so they can see their own patterns and bring an organized record to their doctor.

**Problem.** People with migraine are often asked "what triggers your attacks?" and "how many headache days do you have a month?" Most answer from memory. Paper diaries get lost, and general health apps don't capture migraine-specific detail like aura, phases, or relief taken.

**Product principle.** The app records and summarizes what the user tells it. It never diagnoses, recommends treatment, or tells someone what caused an attack. Any pattern it shows is a descriptive correlation in the user's own data, labeled as such.

## Goals and non-goals

The app succeeds if logging an attack takes under 30 seconds and the user can hand a clear summary to a clinician.

**Goals**

1. Log a migraine episode fast, including during an attack (one-handed, low-light, minimal typing).
2. Capture possible triggers and daily context (sleep, stress, food, weather, cycle, screen time) with or without an attack.
3. Show history and descriptive patterns: frequency, duration, intensity, and how often a factor appeared before an episode.
4. Export a shareable summary (PDF/CSV) for appointments.
5. Keep data private and under the user's control.

**Non-goals**

- Diagnosing migraine type or any other condition.
- Recommending, dosing, or adjusting medication or treatment.
- Stating that a factor *causes* the user's migraines.
- Emergency triage or symptom checking.
- Replacing a clinician, or acting as a regulated medical device.
- Social features or community forums (v1).

## Target users

The primary user is an adult who has migraines and wants to understand their own patterns.

| Persona | Situation | Main need |
| --- | --- | --- |
| Frequent sufferer | 8+ attack days a month, sees a neurologist | Accurate counts and a clean report for appointments |
| Occasional sufferer | A few attacks a month, no specialist | Spot what tends to come before an attack |
| Newly experiencing | Recent onset, about to see a GP | Start a structured record before the first visit |
| Caregiver | Logs for a teen or partner | Quick entry on someone else's behalf (later release) |

Clinicians are secondary readers of the exported report, not app users.

## User stories

| ID | As a user, I want to… | So that… | Priority |
| --- | --- | --- | --- |
| US-1 | start an episode with one tap when pain begins | I don't have to think during an attack | P0 |
| US-2 | add details (intensity, location, symptoms) later | I can log quickly now and complete it when I feel better | P0 |
| US-3 | end an episode and record how long it lasted | I know my typical duration | P0 |
| US-4 | tick off possible triggers from a list | I record context without typing | P0 |
| US-5 | log a short daily check-in even on headache-free days | patterns compare attack days with normal days | P1 |
| US-6 | record what I took or did for relief, and whether it helped | I and my doctor can review what I tried | P0 |
| US-7 | see a calendar of attack days | I can count headache days per month | P0 |
| US-8 | see how often each factor appeared before episodes | I can discuss possible triggers with my doctor | P1 |
| US-9 | export a summary for a date range | I can bring it to an appointment | P0 |
| US-10 | add my own custom triggers and symptoms | the app fits my situation | P1 |
| US-11 | lock the app and delete all my data | my health data stays private | P0 |

## Functional requirements

V1 covers five areas: episode logging, trigger and context logging, history, descriptive insights, and export.

### 1. Episode logging

- **FR-1.1** Quick start: one tap from the home screen (and a home-screen widget) creates an episode with the current time.
- **FR-1.2** Backfill: create an episode with past start and end times.
- **FR-1.3** Fields, all optional except start time:
  - Pain intensity, 0–10 scale
  - Pain location (left, right, both, front, back, behind eye, neck)
  - Pain quality (throbbing, pressing, stabbing, other)
  - Aura present (yes / no / unsure) and aura type (visual, sensory, speech, other)
  - Associated symptoms (nausea, vomiting, light sensitivity, sound sensitivity, smell sensitivity, dizziness, fatigue, neck pain)
  - Impact on activity (none, reduced, unable to function)
  - Free-text notes
- **FR-1.4** Intensity can be updated over the episode to record peak and changes.
- **FR-1.5** End episode records end time; duration is calculated.
- **FR-1.6** Relief log: what the user took or did (free text or saved items), time taken, and the user's own rating of relief (none, some, full). The app stores this as entered and never suggests items, doses, or timing.
- **FR-1.7** Dark, low-brightness "attack mode" UI with large touch targets.

### 2. Trigger and context logging

- **FR-2.1** Preset factor list grouped by category: sleep, stress, food and drink, hydration, caffeine, alcohol, skipped meals, menstrual cycle, weather, screen time, physical exertion, strong smells, bright light, travel.
- **FR-2.2** Users can add, rename, hide, and reorder factors.
- **FR-2.3** Factors can be attached to an episode ("in the 24 hours before") or logged in a daily check-in independent of episodes.
- **FR-2.4** Daily check-in (optional, under 15 seconds): sleep hours, stress 1–5, and tap-to-add factors. One optional reminder per day, user-set time.
- **FR-2.5** Optional automatic context (opt-in): local weather and barometric pressure via a weather API; sleep from Apple Health / Google Health Connect; cycle data where the user grants access.

### 3. History

- **FR-3.1** Calendar view marking attack days, shaded by peak intensity.
- **FR-3.2** List view of episodes, newest first, with filters (date range, intensity, aura, factor).
- **FR-3.3** Edit and delete any entry.

### 4. Descriptive insights

- **FR-4.1** Monthly counts: attack days, headache-free days, average duration, average peak intensity.
- **FR-4.2** Factor frequency: for each factor, the share of episodes it was logged before, compared with its share on non-attack days. Shown only after at least 10 episodes and 30 days of data.
- **FR-4.3** Time patterns: day of week and time of day when episodes started.
- **FR-4.4** Every insight uses neutral wording ("was logged before 6 of 10 episodes") and carries the note "This shows patterns in your entries, not causes. Discuss with your healthcare provider."

### 5. Export and sharing

- **FR-5.1** PDF report for a chosen date range: summary counts, calendar, episode table, relief log, and factor frequency.
- **FR-5.2** CSV export of all raw data.
- **FR-5.3** Sharing happens only through the OS share sheet the user triggers; there is no in-app clinician portal in v1.

### 6. Account, settings, and data control

- **FR-6.1** Works fully without an account; optional account enables encrypted cloud backup and sync across devices.
- **FR-6.2** App lock with device biometrics or PIN.
- **FR-6.3** Delete all data, on device and in the cloud, from settings in two steps.
- **FR-6.4** Units and formats follow device locale (°C/°F, 12/24-hour time).

## Data model

Six entities cover v1; an Episode links to many Factors, Symptoms, and Relief entries.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Episode | id, start_at, end_at, peak_intensity, locations[], quality, aura, aura_types[], impact, notes | end_at null while ongoing |
| IntensityReading | episode_id, at, value (0–10) | tracks change over an episode |
| Factor | id, name, category, is_custom, is_hidden | preset or user-created |
| FactorLog | factor_id, episode_id or checkin_id, logged_at | links a factor to an episode or day |
| ReliefEntry | episode_id, item (text), taken_at, user_rating | stored as entered, never validated |
| DailyCheckin | date, sleep_hours, stress (1–5), weather_snapshot, notes | one per day |

All timestamps are stored in UTC with the user's time zone at entry, so travel does not shift history.

## Non-functional requirements

Privacy is the top non-functional priority: health data is sensitive and the app must work offline.

| Area | Requirement |
| --- | --- |
| Privacy | Local-first storage; no data leaves the device without opt-in. No advertising SDKs, no sale or sharing of health data. Analytics are anonymous usage events only, never entry contents. |
| Security | Data encrypted at rest on device; TLS 1.2+ in transit; cloud backup encrypted with a user-derived key. |
| Compliance | Follow GDPR and applicable US state health-privacy laws (e.g. Washington My Health My Data Act); comply with App Store and Google Play health-data policies. |
| Offline | Every logging and history feature works without a connection; sync resolves conflicts by latest edit. |
| Performance | Cold start to quick-log under 2 s; quick-log save under 300 ms. |
| Accessibility | WCAG 2.2 AA; screen-reader labels on all controls; Dynamic Type; touch targets at least 48 pt; no color-only meaning. |
| Platforms | iOS 17+ and Android 12+ at launch. |
| Reliability | No data loss on crash; automatic local backup daily. |

## Clinical safety guardrails

The app stays a general wellness logging tool, which keeps it outside medical-device regulation (FDA, EU MDR). Every feature must pass these rules.

**The app must not**

- Name or suggest a diagnosis (e.g. "chronic migraine", "medication-overuse headache"), even when counts cross clinical thresholds.
- Recommend, rank, or dose any medication, supplement, or treatment, or comment on how often the user takes something.
- Say a factor causes or triggers the user's migraines; it may only report how often a factor was logged.
- Generate risk scores or predict upcoming attacks (v1).
- Use AI-generated free-text advice.

**The app must**

- Show a one-time onboarding notice: "This app helps you keep a record. It does not provide medical advice, diagnosis, or treatment."
- Show a persistent, non-alarming safety note in Help: "Seek urgent care for a sudden severe headache, headache with fever and stiff neck, weakness, confusion, vision loss, or after a head injury." This is static text, never triggered by the user's entries.
- Encourage the user to share their report with a healthcare provider.
- Have all user-facing copy about insights reviewed against this list before release.

**Copy examples**

| Avoid | Use instead |
| --- | --- |
| "Red wine is your trigger." | "Red wine was logged before 4 of your 9 episodes." |
| "You may have chronic migraine." | "You logged 16 attack days in October." |
| "Take your medication earlier." | "Relief rated 'full' in 5 of 8 entries." |

## Success metrics

The north-star metric is the share of active users who log consistently enough for patterns to mean something.

| Metric | Target (6 months after launch) |
| --- | --- |
| Median time to quick-log an episode | ≤ 30 s |
| Episodes completed with end time | ≥ 80% |
| Users logging 4+ weeks in a row (north star) | ≥ 40% of activated users |
| Day-30 retention | ≥ 35% |
| Users who export at least one report | ≥ 25% |
| App store rating | ≥ 4.5 |
| Guardrail breaches found in copy review or user reports | 0 |

Targets are initial estimates to revisit after the beta.

## Release plan

V1 reaches the public in about 21 weeks, through three gates. Durations are estimates.

| Phase | Weeks | Scope | Exit gate |
| --- | --- | --- | --- |
| 1. Research and design | 1–4 | User interviews, clickable prototype, guardrail checklist | **Design sign-off** — prototype tested |
| 2. MVP build | 5–14 | Episode logging, trigger logging, history and calendar, PDF and CSV export | **Feature complete** — all P0 stories done |
| 3. Closed beta | 15–20 | 100 invited users, fix logging friction, security review | **Launch gate** — guardrail and security review passed |
| 4. Public launch (v1) | 21+ | iOS and Android release; v1.1 adds weather and health-app sync | — |

Weather and health-app integrations follow in v1.1 so they don't block launch; caregiver mode and multi-language support are candidates for v2.

## Risks and open questions

| Risk | Mitigation |
| --- | --- |
| Users read factor frequency as cause | Neutral wording, minimum-data threshold, persistent disclaimer |
| Logging fatigue drops data quality | One-tap logging, backfill, single optional reminder |
| Health-data breach or misuse | Local-first, encryption, no ad SDKs, independent security review before launch |
| Feature creep toward clinical advice | Guardrail checklist in every spec and copy review |
| Weather/health integrations add cost and complexity | Ship as opt-in in v1.1, not blocking launch |

**Open questions**

- [ ] Native apps (iOS/Android) or a cross-platform framework, or a web app first?
- [ ] Free, or freemium with paid cloud sync and advanced reports?
- [ ] Should a regulatory consultant confirm the wellness classification before launch?
- [ ] Which headache types beyond migraine (tension, cluster) should logging support?
- [ ] Do we need a caregiver mode in v1 for parents of teens?

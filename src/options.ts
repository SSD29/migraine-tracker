import type { Aura, Impact, ReliefRating } from './types';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export const LOCATIONS: Option[] = [
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
  { value: 'both', label: 'Both sides' },
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'behind-eye', label: 'Behind eye' },
  { value: 'neck', label: 'Neck' },
];

export const QUALITIES: Option[] = [
  { value: 'throbbing', label: 'Throbbing' },
  { value: 'pressing', label: 'Pressing' },
  { value: 'stabbing', label: 'Stabbing' },
  { value: 'other', label: 'Other' },
];

export const AURA: Option<Aura>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
];

export const AURA_TYPES: Option[] = [
  { value: 'visual', label: 'Visual' },
  { value: 'sensory', label: 'Sensory' },
  { value: 'speech', label: 'Speech' },
  { value: 'other', label: 'Other' },
];

export const SYMPTOMS: Option[] = [
  { value: 'nausea', label: 'Nausea' },
  { value: 'vomiting', label: 'Vomiting' },
  { value: 'light', label: 'Light sensitivity' },
  { value: 'sound', label: 'Sound sensitivity' },
  { value: 'smell', label: 'Smell sensitivity' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'neck-pain', label: 'Neck pain' },
];

export const IMPACTS: Option<Impact>[] = [
  { value: 'none', label: 'No impact' },
  { value: 'reduced', label: 'Reduced activity' },
  { value: 'unable', label: 'Unable to function' },
];

export const RELIEF_RATINGS: Option<ReliefRating>[] = [
  { value: 'none', label: 'No relief' },
  { value: 'some', label: 'Some relief' },
  { value: 'full', label: 'Full relief' },
];

export const STRESS_LEVELS: Option[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: String(n),
}));

export const CATEGORIES = [
  'Sleep',
  'Stress',
  'Food and drink',
  'Hydration',
  'Caffeine',
  'Alcohol',
  'Meals',
  'Menstrual cycle',
  'Weather',
  'Screen time',
  'Exertion',
  'Environment',
  'Travel',
  'Other',
];

export const PRESET_FACTORS: { name: string; category: string }[] = [
  { name: 'Poor sleep', category: 'Sleep' },
  { name: 'Oversleeping', category: 'Sleep' },
  { name: 'High stress', category: 'Stress' },
  { name: 'Stress let-down', category: 'Stress' },
  { name: 'Chocolate', category: 'Food and drink' },
  { name: 'Aged cheese', category: 'Food and drink' },
  { name: 'Processed meat', category: 'Food and drink' },
  { name: 'Artificial sweetener', category: 'Food and drink' },
  { name: 'Not enough water', category: 'Hydration' },
  { name: 'More caffeine than usual', category: 'Caffeine' },
  { name: 'Missed usual caffeine', category: 'Caffeine' },
  { name: 'Red wine', category: 'Alcohol' },
  { name: 'Other alcohol', category: 'Alcohol' },
  { name: 'Skipped meal', category: 'Meals' },
  { name: 'Long gap between meals', category: 'Meals' },
  { name: 'Unusual meal times', category: 'Meals' },
  { name: 'Period', category: 'Menstrual cycle' },
  { name: 'Ovulation', category: 'Menstrual cycle' },
  { name: 'Weather change', category: 'Weather' },
  { name: 'Heat', category: 'Weather' },
  { name: 'Long screen time', category: 'Screen time' },
  { name: 'Intense exercise', category: 'Exertion' },
  { name: 'Strong smells', category: 'Environment' },
  { name: 'Bright or flickering light', category: 'Environment' },
  { name: 'Loud noise', category: 'Environment' },
  { name: 'Travel', category: 'Travel' },
];

// Guardrail copy (PRD: Clinical safety guardrails). Change only after a guardrail review.
export const DISCLAIMER =
  'This app helps you keep a record. It does not provide medical advice, diagnosis, or treatment.';
export const INSIGHT_NOTE =
  'This shows patterns in your entries, not causes. Discuss with your healthcare provider.';
export const SAFETY_NOTE =
  'Seek urgent care for a sudden severe headache, headache with fever and stiff neck, weakness, confusion, vision loss, or after a head injury.';

export const labelOf = (options: Option[], value: string | undefined) =>
  options.find((o) => o.value === value)?.label ?? value ?? '';

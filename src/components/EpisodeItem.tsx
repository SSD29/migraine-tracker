import { fmtDateTime, fmtDuration } from '../dates';
import { durationHours, intensityBand, peakIntensity } from '../insights';
import { isMedication } from '../db';
import { medicationStatus } from '../relief';
import type { Episode } from '../types';
import { Icon } from './Icon';

/** Peak intensity in a coloured disc; a dash when it was never rated. */
export function IntensityBadge({ peak }: { peak: number | undefined }) {
  return (
    <span
      className={`badge band-${intensityBand(peak)}`}
      aria-label={peak === undefined ? 'Intensity not rated' : `Peak ${peak} of 10`}
    >
      {peak ?? '–'}
    </span>
  );
}

export function EpisodeItem({ episode: e, onOpen }: { episode: Episode; onOpen: () => void }) {
  const meds = [...new Set(e.relief.filter(isMedication).map((r) => r.item))].join(', ');
  const details = [
    e.endAt ? fmtDuration(durationHours(e)) : 'In progress',
    e.aura === 'yes' && 'aura',
    medicationStatus(e) === 'yes' && (meds || 'medication'),
    medicationStatus(e) === 'no' && 'no medication',
  ].filter(Boolean);
  return (
    <li>
      <button className="ep-item" onClick={onOpen}>
        <IntensityBadge peak={peakIntensity(e)} />
        <span className="ep-main">
          <span className="ep-title">{fmtDateTime(e.startAt)}</span>
          <span className="ep-sub">{details.join(' · ')}</span>
        </span>
        <Icon name="chevronRight" size={18} className="ep-chevron" />
      </button>
    </li>
  );
}

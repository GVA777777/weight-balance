import { aircraft, airframe } from './profiles.js';
export const STORAGE_KEY = 'balance-flight:v1';
// Preserve invalid edits across reloads too: JSON cannot represent NaN directly.
export function serialize(state) { return JSON.stringify(state, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? '__invalid_number__' : value); }
export function restore(raw) {
  try {
    const value = JSON.parse(raw, (_key, item) => item === '__invalid_number__' ? NaN : item);
    if (value?.version !== 1 || value.airframeId !== airframe.id || !['kg','lbs'].includes(value.unit)) return null;
    if (!value.flight || !['date','number','route','captain'].every(k => typeof value.flight[k] === 'string')) return null;
    if (!value.loads || !aircraft.stations.every(s => s.id in value.loads && (typeof value.loads[s.id] === 'number' || value.loads[s.id] === null))) return null;
    if (!value.fuel || !['wing','ventral','remaining'].every(k => typeof value.fuel[k] === 'number' || value.fuel[k] === null)) return null;
    return value;
  } catch { return null; }
}

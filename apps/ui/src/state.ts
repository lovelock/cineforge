import type { AppInit, QueueSnapshot } from '@cineforge/shared';

export interface ViewState {
  init: AppInit | null;
  snapshot: QueueSnapshot | null;
  logs: Record<string, string[]>;
  error: string | null;
}

export type Action =
  | { type: 'init'; payload: AppInit }
  | { type: 'state'; payload: QueueSnapshot }
  | { type: 'log'; payload: { id: string; line: string } }
  | { type: 'error'; payload: string }
  | { type: 'clear-error' };

export const initialState: ViewState = {
  init: null,
  snapshot: null,
  logs: {},
  error: null,
};

export function reducer(state: ViewState, action: Action): ViewState {
  switch (action.type) {
    case 'init':
      return { ...state, init: action.payload, error: null };
    case 'state':
      return { ...state, snapshot: action.payload };
    case 'log': {
      const existing = state.logs[action.payload.id] ?? [];
      const next = [...existing, action.payload.line].slice(-500);
      return { ...state, logs: { ...state.logs, [action.payload.id]: next } };
    }
    case 'error':
      return { ...state, error: action.payload };
    case 'clear-error':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return '--';
  }
  if (n < 1024) {
    return `${Math.round(n)} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--';
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

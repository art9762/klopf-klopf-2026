import { create } from 'zustand';
import type {
  PhaseState,
  QueueState,
  MetricsState,
  EventLogEntry,
  MidzoneStatus,
  WsMessage,
  Phase,
} from '../lib/contracts';

interface PhaseHistoryEntry {
  phase: Phase;
  startedAt: number;
  endedAt: number;
}

interface TrafficStore {
  phase: PhaseState | null;
  queues: QueueState | null;
  metrics: MetricsState | null;
  midzone: MidzoneStatus | null;
  events: EventLogEntry[];
  phaseHistory: PhaseHistoryEntry[];
  fixedMetrics: MetricsState | null;
  adaptiveMetrics: MetricsState | null;

  dispatch: (msg: WsMessage) => void;
}

const MAX_EVENTS = 50;
const MAX_PHASE_HISTORY = 60;

export const useTrafficStore = create<TrafficStore>((set, get) => ({
  phase: null,
  queues: null,
  metrics: null,
  midzone: null,
  events: [],
  phaseHistory: [],
  fixedMetrics: null,
  adaptiveMetrics: null,

  dispatch: (msg) => {
    const { topic, payload } = msg;

    if (topic === 'traffic/state/phase') {
      const p = payload as PhaseState;
      const prev = get().phase;
      const history = get().phaseHistory;
      let newHistory = history;
      if (prev && prev.phase !== p.phase) {
        newHistory = [
          ...history.slice(-(MAX_PHASE_HISTORY - 1)),
          { phase: prev.phase, startedAt: prev.phase_started_at, endedAt: p.ts },
        ];
      }
      set({ phase: p, phaseHistory: newHistory });
    } else if (topic === 'traffic/state/queues') {
      set({ queues: payload as QueueState });
    } else if (topic === 'traffic/state/metrics') {
      const m = payload as MetricsState;
      set({ metrics: m });
      if (m.mode === 'fixed') set({ fixedMetrics: m });
      else set({ adaptiveMetrics: m });
    } else if (topic === 'traffic/sensor/midzone') {
      set({ midzone: payload as MidzoneStatus });
    } else if (topic === 'traffic/event/log') {
      const entry = payload as EventLogEntry;
      set({ events: [...get().events.slice(-(MAX_EVENTS - 1)), entry] });
    }
  },
}));

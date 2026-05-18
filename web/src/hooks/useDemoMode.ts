import { useEffect, useRef, useCallback } from 'react';
import type { WsMessage, Phase, TrafficMode } from '../lib/contracts';

const PHASES: Phase[] = ['GREEN_A', 'ALL_RED_A_to_B', 'GREEN_B', 'ALL_RED_B_to_A'];
const DEMO_EVENTS = [
  { level: 'info' as const, code: 'PHASE_CHANGE', msg: 'phase → GREEN_A (adaptive timer)' },
  { level: 'info' as const, code: 'PHASE_CHANGE', msg: 'phase → GREEN_B (adaptive timer)' },
  { level: 'info' as const, code: 'VEHICLE_ENTER', msg: 'trk_12 entered zone from Side A' },
  { level: 'info' as const, code: 'VEHICLE_EXIT', msg: 'trk_08 exited zone to Side B' },
  { level: 'warn' as const, code: 'QUEUE_HIGH', msg: 'queue A exceeds 10 vehicles' },
  { level: 'warn' as const, code: 'MIDZONE_SLOW', msg: 'midzone clearance >15s' },
  { level: 'info' as const, code: 'MODE_SWITCH', msg: 'adaptive mode engaged' },
  { level: 'info' as const, code: 'THROUGHPUT', msg: 'throughput: 42 veh/hr (↑12%)' },
  { level: 'error' as const, code: 'COMM_TIMEOUT', msg: 'sensor B heartbeat missed' },
  { level: 'info' as const, code: 'COMM_RESTORE', msg: 'sensor B reconnected' },
];

export function useDemoMode(
  wsStatus: string,
  dispatch: (msg: WsMessage) => void,
  isConnected: boolean,
): boolean {
  const activeRef = useRef(false);
  const phaseIdxRef = useRef(0);
  const tickRef = useRef(0);
  const modeRef = useRef<TrafficMode>('adaptive');

  const shouldDemo = !isConnected;

  useEffect(() => {
    if (!shouldDemo) {
      activeRef.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      activeRef.current = true;
    }, 3000);

    const interval = setInterval(() => {
      if (!activeRef.current) return;
      tickRef.current++;
      const tick = tickRef.current;
      const now = Date.now() / 1000;

      if (tick % 20 === 0) {
        phaseIdxRef.current = (phaseIdxRef.current + 1) % PHASES.length;
      }

      const phase = PHASES[phaseIdxRef.current];
      const phaseStartedAt = now - (tick % 20) * 0.5;

      dispatch({
        topic: 'traffic/state/phase',
        payload: {
          ts: now,
          phase,
          phase_started_at: phaseStartedAt,
          phase_will_end_at: phaseStartedAt + 15,
          reason: 'adaptive_timer',
        },
      });

      const qA = phase === 'GREEN_A' ? Math.max(2, 8 - (tick % 20) * 0.4) : 3 + (tick % 20) * 0.5;
      const qB = phase === 'GREEN_B' ? Math.max(2, 7 - (tick % 20) * 0.3) : 4 + (tick % 20) * 0.4;

      dispatch({
        topic: 'traffic/state/queues',
        payload: {
          ts: now,
          queue_A: Math.round(qA),
          queue_B: Math.round(qB),
          wait_A_sec: Math.round(qA * 3.2),
          wait_B_sec: Math.round(qB * 2.8),
        },
      });

      const vehiclesInZone = tick % 5 < 3
        ? ['trk_12', 'trk_08', 'trk_15'].slice(0, 1 + (tick % 3))
        : ['trk_12'];
      const stuckIds = tick % 15 === 0 ? ['trk_12'] : [];

      dispatch({
        topic: 'traffic/sensor/midzone',
        payload: { ts: now, vehicles_in_zone: vehiclesInZone, stuck_ids: stuckIds },
      });

      if (tick % 5 === 0) {
        if (tick % 30 === 0) modeRef.current = modeRef.current === 'adaptive' ? 'fixed' : 'adaptive';

        const mode = modeRef.current;
        const base = mode === 'adaptive' ? 0.7 : 1.0;
        dispatch({
          topic: 'traffic/state/metrics',
          payload: {
            ts: now,
            avg_delay_A: +(12.4 * base + Math.random() * 2).toFixed(1),
            avg_delay_B: +(14.1 * base + Math.random() * 2).toFixed(1),
            max_queue_A: Math.round(12 * base + Math.random() * 3),
            max_queue_B: Math.round(14 * base + Math.random() * 3),
            throughput_per_hour: Math.round(38 / base + Math.random() * 5),
            unsafe_switches: mode === 'adaptive' ? 0 : Math.round(Math.random() * 2),
            mode,
          },
        });
      }

      if (tick % 3 === 0) {
        const ev = DEMO_EVENTS[tick % DEMO_EVENTS.length];
        dispatch({
          topic: 'traffic/event/log',
          payload: { ts: now, level: ev.level, code: ev.code, msg: ev.msg },
        });
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      activeRef.current = false;
    };
  }, [shouldDemo, dispatch]);

  return shouldDemo;
}

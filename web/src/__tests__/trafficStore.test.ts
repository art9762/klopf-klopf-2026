import { describe, it, expect, beforeEach } from 'vitest';
import { useTrafficStore } from '../store/trafficStore';

describe('trafficStore', () => {
  beforeEach(() => {
    useTrafficStore.setState({
      phase: null,
      queues: null,
      metrics: null,
      midzone: null,
      events: [],
      phaseHistory: [],
      fixedMetrics: null,
      adaptiveMetrics: null,
    });
  });

  it('dispatches phase state', () => {
    const { dispatch } = useTrafficStore.getState();
    dispatch({
      topic: 'traffic/state/phase',
      payload: {
        ts: 1000,
        phase: 'GREEN_A',
        phase_started_at: 999,
        phase_will_end_at: 1015,
        reason: 'timer',
      },
    });
    const { phase } = useTrafficStore.getState();
    expect(phase).not.toBeNull();
    expect(phase!.phase).toBe('GREEN_A');
    expect(phase!.reason).toBe('timer');
  });

  it('dispatches queue state', () => {
    const { dispatch } = useTrafficStore.getState();
    dispatch({
      topic: 'traffic/state/queues',
      payload: { ts: 1000, queue_A: 5, queue_B: 3, wait_A_sec: 16, wait_B_sec: 8.4 },
    });
    const { queues } = useTrafficStore.getState();
    expect(queues!.queue_A).toBe(5);
    expect(queues!.queue_B).toBe(3);
  });

  it('dispatches metrics and separates fixed/adaptive', () => {
    const { dispatch } = useTrafficStore.getState();
    dispatch({
      topic: 'traffic/state/metrics',
      payload: {
        ts: 1000,
        avg_delay_A: 12.0,
        avg_delay_B: 14.0,
        max_queue_A: 8,
        max_queue_B: 10,
        throughput_per_hour: 42,
        unsafe_switches: 0,
        mode: 'adaptive',
      },
    });
    const state = useTrafficStore.getState();
    expect(state.metrics!.mode).toBe('adaptive');
    expect(state.adaptiveMetrics).not.toBeNull();
    expect(state.fixedMetrics).toBeNull();

    dispatch({
      topic: 'traffic/state/metrics',
      payload: {
        ts: 1001,
        avg_delay_A: 18.0,
        avg_delay_B: 20.0,
        max_queue_A: 12,
        max_queue_B: 14,
        throughput_per_hour: 30,
        unsafe_switches: 2,
        mode: 'fixed',
      },
    });
    const state2 = useTrafficStore.getState();
    expect(state2.fixedMetrics!.throughput_per_hour).toBe(30);
    expect(state2.adaptiveMetrics!.throughput_per_hour).toBe(42);
  });

  it('dispatches midzone status', () => {
    const { dispatch } = useTrafficStore.getState();
    dispatch({
      topic: 'traffic/sensor/midzone',
      payload: { ts: 1000, vehicles_in_zone: ['trk_1', 'trk_2'], stuck_ids: ['trk_1'] },
    });
    const { midzone } = useTrafficStore.getState();
    expect(midzone!.vehicles_in_zone).toEqual(['trk_1', 'trk_2']);
    expect(midzone!.stuck_ids).toEqual(['trk_1']);
  });

  it('dispatches event log entries with max limit', () => {
    const { dispatch } = useTrafficStore.getState();
    for (let i = 0; i < 60; i++) {
      dispatch({
        topic: 'traffic/event/log',
        payload: { ts: 1000 + i, level: 'info', code: 'TEST', msg: `event ${i}` },
      });
    }
    const { events } = useTrafficStore.getState();
    expect(events.length).toBe(50);
    expect(events[events.length - 1].msg).toBe('event 59');
  });

  it('tracks phase history on phase changes', () => {
    const { dispatch } = useTrafficStore.getState();
    dispatch({
      topic: 'traffic/state/phase',
      payload: { ts: 1000, phase: 'GREEN_A', phase_started_at: 990, phase_will_end_at: 1010, reason: 'init' },
    });
    dispatch({
      topic: 'traffic/state/phase',
      payload: { ts: 1010, phase: 'ALL_RED_A_to_B', phase_started_at: 1010, phase_will_end_at: 1015, reason: 'timer' },
    });
    const { phaseHistory } = useTrafficStore.getState();
    expect(phaseHistory.length).toBe(1);
    expect(phaseHistory[0].phase).toBe('GREEN_A');
    expect(phaseHistory[0].endedAt).toBe(1010);
  });
});

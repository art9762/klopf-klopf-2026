// Vehicle entry/exit event (topics: traffic/sensor/{side}/entry, traffic/sensor/{side}/exit)
export interface SensorEvent {
  ts: number;           // unix seconds, float
  side: 'A' | 'B';
  vehicle_id: string;   // ByteTrack ID like "trk_42"
  vehicle_class: 'car' | 'truck' | 'bus' | 'emergency';
  confidence: number;
}

// Midzone status (topic: traffic/sensor/midzone)
export interface MidzoneStatus {
  ts: number;
  vehicles_in_zone: string[];
  stuck_ids: string[];
}

// Phase state (topic: traffic/state/phase)
export type Phase = 'GREEN_A' | 'GREEN_B' | 'ALL_RED' | 'EMERGENCY';

export interface PhaseState {
  ts: number;
  phase: Phase;
  phase_started_at: number;
  phase_will_end_at: number | null;
  reason: string;
}

// Queue state (topic: traffic/state/queues)
export interface QueueState {
  ts: number;
  queue_A: number;
  queue_B: number;
  wait_A_sec: number;
  wait_B_sec: number;
}

// Metrics (topic: traffic/state/metrics)
export type TrafficMode = 'fixed' | 'adaptive';

export interface MetricsState {
  ts: number;
  avg_delay_A: number;
  avg_delay_B: number;
  max_queue_A: number;
  max_queue_B: number;
  throughput_per_hour: number;
  unsafe_switches: number;
  mode: TrafficMode;
}

// Event log (topic: traffic/event/log)
export type LogLevel = 'info' | 'warn' | 'error';

export interface EventLogEntry {
  ts: number;
  level: LogLevel;
  code: string;
  msg: string;
  data?: Record<string, unknown>;
}

// Commands
export type OverrideAction = 'FORCE_GREEN_A' | 'FORCE_GREEN_B' | 'ALL_RED';

export interface OverrideCommand {
  action: OverrideAction;
  operator: string;
}

export type ScenarioId = 'baseline' | 'rush_hour' | 'stuck_truck' | 'emergency' | 'comm_loss';

export interface ScenarioCommand {
  scenario_id: ScenarioId;
  mode: TrafficMode;
}

// WebSocket message wrapper (what the WS bridge sends)
export interface WsMessage {
  topic: string;
  payload: SensorEvent | MidzoneStatus | PhaseState | QueueState | MetricsState | EventLogEntry;
}

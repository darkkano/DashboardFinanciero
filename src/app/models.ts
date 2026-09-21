export type TxStatus = 'liberada' | 'en_cola' | 'compliance' | 'rechazada';
export type TxType = 'remesa' | 'cambio';

export interface Tick {
  id: string;
  ts: number;
  type: TxType;
  corridor: string;
  from: string;
  to: string;
  city: string;
  origin: string;
  amountSrc: number;
  amountDst: number;
  rate: number;
  status: TxStatus;
  slaMin: number;
  operator: string;
  channel: string;
}

export interface Kpis {
  windowMs: number;
  total: number;
  pending: number;
  released: number;
  sla: number;
  hotCorridor: string;
  hotShare: number;
  volumeUsd: number;
}

export interface FxRate {
  id: string;
  from: string;
  to: string;
  value: number;
  dir: number;
}

export interface CopilotFact {
  label: string;
  value: string;
}

export type CopilotSeverity = 'high' | 'mid' | 'ok';

export interface DeskMessage {
  type: 'hello' | 'batch';
  rows: Tick[];
  kpis: Kpis;
  rates: FxRate[];
  tps: number;
}

// Formato de las soluciones exportadas por los solvers Gurobi (notebooks/*.py → Outputs/).

export interface NodeDef {
  id: number;
  alpha: number;
  beta: number;
  isDepot: boolean;
  label: string;
}

export type SlotType = 'A' | 'B' | 'EMPTY';

export interface StepData {
  stepIndex: number;
  from: number;
  to: number;
  succ?: number | null;
  distance: number;
  deliverA: number;
  pickupB: number;
  /** Unidades α / β a bordo durante el tramo (al llegar al nodo `to`). */
  aOnTruck: number;
  bOnTruck: number;
  slots: SlotType[];
  slotsArrival?: SlotType[];
  slotsDeparture?: SlotType[];
  kMax?: number;
  /** Índices 1-based (slot 1 = puerta trasera). Son pistas: pueden venir incompletos. */
  rehandledB?: number[];
  rehandledA?: number[];
  deliveredSlots?: number[];
  newBSlots?: number[];
  handlingCount: number;
  handlingCost: number;
  wOnTruck?: number;
  zOnTruck?: number;
  /** Política 3: 1 → Política 1 (s_i = 1); 0 ó 2 → Política 2 (s_i = 0). */
  policyApplied?: number;
  explanation: string;
}

export type ModelType = 'TSPPD-H' | 'TSPPD-H_1' | 'TSPPD-H_2' | 'TSPPD-H_3';

export interface SolutionData {
  instance: string;
  model?: ModelType;
  modelName?: string;
  policy?: number;
  numCustomers: number;
  instanceId: number;
  h: number;
  h_a?: number;
  h_b?: number;
  capacity: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
  tour: number[];
  nodes: NodeDef[];
  steps: StepData[];
  distMatrix?: number[][];
  policyDecisions?: Record<string, number>;
}

export interface SolutionMeta {
  filename: string;
  instance: string;
  model: ModelType;
  modelName: string;
  policy: number;
  numCustomers: number;
  instanceId: number;
  h: number;
  capacity: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
  tourLength?: number;
  stepCount?: number;
  mtime?: number;
  error?: string;
}

export type DataSource = 'api' | 'static';

export type PlaybackStatus = 'idle' | 'playing' | 'paused';
export type AnimationSpeed = 0.5 | 1 | 1.5 | 2;

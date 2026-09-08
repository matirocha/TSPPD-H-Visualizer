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
  aOnTruck: number;
  bOnTruck: number;
  slots: SlotType[];
  slotsArrival?: SlotType[];
  slotsDeparture?: SlotType[];
  kMax?: number;
  rehandledB?: number[];
  rehandledA?: number[];
  deliveredSlots?: number[];
  newBSlots?: number[];
  handlingCount: number;
  handlingCost: number;
  explanation: string;
}

export type ModelType = 'TSPPD-H' | 'TSPPD-H_1';

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
}

export interface SolutionMeta {
  filename: string;
  instance: string;
  model?: ModelType;
  modelName?: string;
  policy?: number;
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

export type PlaybackStatus = 'idle' | 'playing' | 'paused';
export type AnimationSpeed = 0.5 | 1 | 1.5 | 2;

export interface CargoSubStepDef {
  id: number;
  title: string;
  shortTitle: string;
  statusText: string;
  color: 'amber' | 'rose' | 'cyan' | 'emerald' | 'zinc';
  hasAction: boolean;
}

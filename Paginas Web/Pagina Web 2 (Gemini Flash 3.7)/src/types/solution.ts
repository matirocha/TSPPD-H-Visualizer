export interface SolutionMeta {
  filename: string;
  mtime: number;
  instance: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  capacity: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
  tourLength: number;
  stepCount: number;
  error?: string;
}

export interface NodeDef {
  id: number;
  alpha: number; // Delivery demand
  beta: number;  // Pickup supply
  isDepot: boolean;
  label: string;
  x?: number;    // Computed 2D coordinates for rendering
  y?: number;
}

export interface StepData {
  stepIndex: number;
  from: number;
  to: number;
  distance: number;
  deliverA: number;
  pickupB: number;
  aOnTruck: number;
  bOnTruck: number;
  slots: Array<'A' | 'B' | 'EMPTY'>;
  handlingCount: number;
  handlingCost: number;
  explanation: string;
}

export interface SolutionData {
  instance: string;
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
  distMatrix: number[][];
}

export type PlaybackStatus = 'idle' | 'playing' | 'paused';
export type AnimationSpeed = 0.5 | 1 | 1.5 | 2 | 3;
export type MapLayoutMode = 'mds' | 'circular';

export type SlotState = "A" | "B" | "EMPTY";

export type OperationPhase =
  | "IDLE"
  | "TRAVELING"
  | "HANDLING_UNLOAD"
  | "DELIVERING_A"
  | "HANDLING_RELOAD"
  | "PICKING_UP_B"
  | "FINISHED_STEP";

export interface NodeDef {
  id: number;
  alpha: number;
  beta: number;
  isDepot: boolean;
  label: string;
}

export interface StepDef {
  stepIndex: number;
  from: number;
  to: number;
  distance: number;
  deliverA: number;
  pickupB: number;
  aOnTruck: number;
  bOnTruck: number;
  slots: SlotState[];
  handlingCount: number;
  handlingCost: number;
  explanation: string;
}

export interface SolutionData {
  instance: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  h_a: number;
  h_b: number;
  capacity: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
  tour: number[];
  nodes: NodeDef[];
  steps: StepDef[];
  distMatrix: number[][];
}

export interface SolutionSummary {
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
  error?: string;
}

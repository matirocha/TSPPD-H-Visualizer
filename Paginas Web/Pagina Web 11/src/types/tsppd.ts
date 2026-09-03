export type SlotType = "A" | "B" | "EMPTY";

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
  slots: SlotType[];
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
  steps: StepDef[];
  distMatrix: number[][];
}

export interface SolutionFileSummary {
  filename: string;
  instance: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
}

export type AnimationPhase = 
  | "traveling"        // Camión en movimiento hacia el nodo
  | "arrived"          // Arribó al nodo
  | "handling"         // LIFO conflict: descarga temporal de cajas B
  | "delivering_alpha" // Descarga de cajas Alpha
  | "reloading_beta"   // Reingreso de cajas B temporalmente descargadas
  | "loading_beta"     // Carga de nuevas unidades B recolectadas
  | "ready";           // Carga completada y estabilizada para el tramo actual

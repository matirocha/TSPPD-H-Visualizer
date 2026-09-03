export type SlotType = 'A' | 'B' | 'EMPTY';

export interface NodeDef {
  id: number;
  alpha: number;
  beta: number;
  isDepot: boolean;
  label: string;
  x?: number;
  y?: number;
}

export interface Step {
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

export interface Solution {
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
  steps: Step[];
  distMatrix: number[][];
}

export interface SolutionSummary {
  filename: string;
  instance: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  capacity: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
  tour?: number[];
  stepCount: number;
  mtime: number;
  error?: string;
}

export type CargoSubPhase =
  | 'arrival'
  | 'handling'
  | 'delivery'
  | 'reload'
  | 'pickup'
  | 'ready';

export interface PhaseInfo {
  id: CargoSubPhase;
  label: string;
  description: string;
  color: string;
  badge: string;
}

export const CARGO_PHASES: PhaseInfo[] = [
  {
    id: 'arrival',
    label: '1. Arribo',
    description: 'El camión llega al nodo con la carga transportada en el tramo.',
    color: 'border-zinc-700 text-zinc-300',
    badge: 'bg-zinc-800 text-zinc-300',
  },
  {
    id: 'handling',
    label: '2. Handling (LIFO)',
    description: 'Descarga temporal de unidades β que obstruyen el acceso a las unidades α en la puerta trasera.',
    color: 'border-amber-500/40 text-amber-300',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'delivery',
    label: '3. Entrega α',
    description: 'Descarga de mercancía de entrega requerida por el cliente.',
    color: 'border-rose-500/40 text-rose-300',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    id: 'reload',
    label: '4. Recarga β',
    description: 'Reubicación de las unidades β temporales en el compartimiento de carga.',
    color: 'border-blue-500/40 text-blue-300',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    id: 'pickup',
    label: '5. Recolección β',
    description: 'Carga de nuevas unidades β recolectadas desde el cliente hacia el depósito.',
    color: 'border-emerald-500/40 text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'ready',
    label: '6. Salida Lista',
    description: 'Carga final estabilizada y verificación de slots para el siguiente viaje.',
    color: 'border-purple-500/40 text-purple-300',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
];

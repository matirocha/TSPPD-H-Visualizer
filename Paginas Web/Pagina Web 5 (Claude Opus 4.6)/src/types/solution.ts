export interface NodeDef {
  id: number
  alpha: number
  beta: number
  isDepot: boolean
  label: string
}

export interface Step {
  stepIndex: number
  from: number
  to: number
  distance: number
  deliverA: number
  pickupB: number
  aOnTruck: number
  bOnTruck: number
  slots: ('A' | 'B' | 'EMPTY')[]
  handlingCount: number
  handlingCost: number
  explanation: string
}

export interface Solution {
  instance: string
  numCustomers: number
  instanceId: number
  h: number
  h_a: number
  h_b: number
  capacity: number
  objectiveValue: number
  totalDistance: number
  handlingCost: number
  tour: number[]
  nodes: NodeDef[]
  steps: Step[]
  distMatrix: number[][]
}

export type AnimationPhase =
  | 'idle'
  | 'moving'
  | 'handling-out'
  | 'unloading-alpha'
  | 'handling-back'
  | 'loading-beta'
  | 'step-complete'

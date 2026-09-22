export type SlotType = 'A' | 'B' | 'EMPTY'

export interface SolutionNode {
  id: number
  alpha: number
  beta: number
  isDepot: boolean
  label: string
}

export interface SolutionStep {
  stepIndex: number
  from: number
  to: number
  distance: number
  deliverA: number
  pickupB: number
  aOnTruck: number
  bOnTruck: number
  slots: SlotType[]
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
  nodes: SolutionNode[]
  steps: SolutionStep[]
  distMatrix: number[][]
}

export interface SolutionSummary {
  filename: string
  instance: string
  numCustomers: number
  instanceId: number
  h: number
  objectiveValue: number
  totalDistance: number
  handlingCost: number
  tour: number[]
  capacity: number
}

export interface SlotGroup {
  type: SlotType
  count: number
  startIdx: number
}

export function groupSlots(slots: SlotType[]): SlotGroup[] {
  const groups: SlotGroup[] = []
  let i = 0
  while (i < slots.length) {
    const type = slots[i]
    let count = 0
    const startIdx = i
    while (i < slots.length && slots[i] === type) {
      count++
      i++
    }
    groups.push({ type, count, startIdx })
  }
  return groups
}

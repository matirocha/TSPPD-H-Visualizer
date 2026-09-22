import { StepData, SolutionData } from '../types/solution';

/**
 * Normaliza el valor de la decisión de política s_i bajo TSPPD-H_3 (Battarra et al., 2010):
 * - s_i = 1 -> Política 1 (Compuerta Trasera / LIFO estándar)
 * - s_i = 0 (o 2) -> Política 2 (Reubicación al Frente / Fondo)
 */
export function getStepPolicyNumber(step: StepData | undefined | null): 1 | 2 {
  if (!step) return 1;
  if (step.policyApplied === 0 || step.policyApplied === 2) return 2;
  return 1;
}

export function getNodePolicyNumber(solution: SolutionData, nodeId: number): 1 | 2 {
  if (nodeId === 0) return 1;
  // Buscar en policyDecisions si existe
  if (solution.policyDecisions && solution.policyDecisions[nodeId.toString()] !== undefined) {
    const val = solution.policyDecisions[nodeId.toString()];
    return val === 0 || val === 2 ? 2 : 1;
  }
  // Buscar en los pasos
  const step = solution.steps.find((s) => s.to === nodeId);
  return getStepPolicyNumber(step);
}

export interface PolicyDetails {
  policyNum: 1 | 2;
  code: 'P1' | 'P2';
  shortLabel: string;
  fullTitle: string;
  variableForm: string;
  strategySummary: string;
  operationalRule: string;
  storageTarget: string;
  consequence: string;
  colors: {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
    glow: string;
    accent: string;
  };
}

export function getPolicyDetails(policyNum: 1 | 2): PolicyDetails {
  if (policyNum === 1) {
    return {
      policyNum: 1,
      code: 'P1',
      shortLabel: 'Pol. 1 (Puerta LIFO)',
      fullTitle: 'Política 1 (Compuerta Trasera)',
      variableForm: 's_i = 1',
      storageTarget: 'Compuerta Trasera',
      strategySummary: 'La mercancía β recogida se carga directamente en la compuerta trasera (LIFO).',
      operationalRule: 'No se desalojan mercancías de entrega pendientes en este nodo.',
      consequence: 'Si en próximas paradas hay entregas de α, las unidades β acumuladas en puerta deberán desalojarse y recargarse (costo hb).',
      colors: {
        badgeBg: 'bg-purple-500/15',
        badgeText: 'text-purple-300',
        badgeBorder: 'border-purple-500/30',
        pillBg: 'bg-purple-950/80',
        pillText: 'text-purple-300',
        pillBorder: 'border-purple-500/50',
        glow: 'rgba(168, 85, 247, 0.25)',
        accent: '#c084fc',
      },
    };
  }

  return {
    policyNum: 2,
    code: 'P2',
    shortLabel: 'Pol. 2 (Reubicación al Frente)',
    fullTitle: 'Política 2 (Fondo del Camión)',
    variableForm: 's_i = 0',
    storageTarget: 'Fondo del Camión',
    strategySummary: 'Toda la mercancía β recogida se reubica al frente (fondo) del compartimiento.',
    operationalRule: 'Se desalojan temporalmente las mercancías α remanentes y se vuelven a cargar detrás.',
    consequence: 'Se paga costo de manipulación ahora (ha × α remanente), pero las entregas restantes quedarán despejadas en la compuerta.',
    colors: {
      badgeBg: 'bg-sky-500/15',
      badgeText: 'text-sky-300',
      badgeBorder: 'border-sky-500/30',
      pillBg: 'bg-sky-950/80',
      pillText: 'text-sky-300',
      pillBorder: 'border-sky-500/50',
      glow: 'rgba(14, 165, 233, 0.25)',
      accent: '#38bdf8',
    },
  };
}

/**
 * Motor de coreografía LIFO.
 *
 * Convierte cada paso de una solución Gurobi en una secuencia de fases físicas
 * (evacuar, entregar, reacomodar, cargar…) siguiendo la IDENTIDAD de cada unidad
 * α/β a lo largo de todo el tour. Así la vista puede animar cada pallet desde su
 * slot hasta el andén, el cliente o su nuevo slot.
 *
 * Los arreglos `deliveredSlots`, `rehandledA/B` y `newBSlots` de los archivos de
 * salida se usan como PISTAS: en varias soluciones vienen incompletos o con
 * índices desplazados. La fuente de verdad son `slotsArrival`/`slotsDeparture`
 * más los conteos `deliverA`, `pickupB` y la cantidad de manipulaciones; el motor
 * resuelve una asignación consistente con todo eso.
 *
 * Convención: índice 0 = slot 1 = compuerta trasera; índice Q-1 = cabina/fondo.
 */
import type { ModelType, NodeDef, SlotType, SolutionData, StepData } from '../types/solution';
import { stepPolicy } from './policy.ts';

export type UnitType = 'A' | 'B';

export interface Unit {
  id: string;
  type: UnitType;
  /** Nodo donde la unidad subió al camión (0 = depósito). */
  origin: number;
  /** Paso en que subió (-1 = carga inicial en el depósito). */
  loadedAtStep: number;
  /** Nodo donde bajó definitivamente (entrega α en cliente o descarga β en depósito). */
  destination?: number;
  leftAtStep?: number;
  /** Veces que fue evacuada al andén y recargada. */
  handlings: number;
}

/** Contenido del camión: id de unidad por slot (null = vacío). */
export type Layout = (string | null)[];

export type PhaseKind =
  | 'initial'
  | 'arrive'
  | 'evac'
  | 'evac-b'
  | 'deliver-a'
  | 'evac-a'
  | 'compact'
  | 'load-b-front'
  | 'reload-a'
  | 'reload-b'
  | 'pickup-b'
  | 'unload-b'
  | 'complete';

export type PhaseTone = 'neutral' | 'alpha' | 'beta' | 'handling' | 'success';

/** Qué le ocurre a una unidad durante una fase (para resaltarla en la vista). */
export type UnitMotion = 'evac' | 'deliver' | 'pickup' | 'reload' | 'slide' | 'unload';

export interface Phase {
  kind: PhaseKind;
  title: string;
  short: string;
  detail: string;
  tone: PhaseTone;
  /** Estado del compartimiento al terminar la fase. */
  layout: Layout;
  /** Unidades en el andén temporal al terminar la fase. */
  dock: string[];
  /** Unidades ya entregadas en esta parada (α al cliente o β al depósito). */
  handedOver: string[];
  /** Unidades β que siguen esperando en el cliente para ser recogidas. */
  awaiting: string[];
  /** Movimientos ejecutados en esta fase. */
  motions: Record<string, UnitMotion>;
  /** Unidades manipuladas con costo (evacuadas) en esta fase. */
  costedUnits: number;
  /** Duración base de la fase en modo continuo a velocidad 1x. */
  durationMs: number;
}

/** P1: β en compuerta · P2: β al fondo · GEN: posiciones libres (modelo General). */
export type StopStyle = 'P1' | 'P2' | 'GEN' | 'DEPOT';

export interface StopPlan {
  stepIndex: number;
  from: number;
  to: number;
  label: string;
  isDepot: boolean;
  style: StopStyle;
  /** Política operada en la parada (P3: s_i), fija en P1/P2, null en General/depósito. */
  policy: 1 | 2 | null;
  arrival: Layout;
  departure: Layout;
  /** phases[0] siempre es la llegada ('arrive'). */
  phases: Phase[];
  handled: { A: number; B: number };
  slid: number;
  delivered: string[];
  picked: string[];
  /** Índice de la primera fase con costo de manipulación (-1 si no hay). */
  costPhase: number;
  warnings: string[];
}

export interface Choreography {
  capacity: number;
  model: ModelType;
  units: Record<string, Unit>;
  /** Camión cargado en el depósito antes de partir. */
  initial: Layout;
  stops: StopPlan[];
  warnings: string[];
}

export const PHASE_DURATION: Record<PhaseKind, number> = {
  initial: 1200,
  arrive: 1100,
  evac: 2600,
  'evac-b': 2600,
  'deliver-a': 2400,
  'evac-a': 2600,
  compact: 1700,
  'load-b-front': 2800,
  'reload-a': 2400,
  'reload-b': 2400,
  'pickup-b': 2400,
  'unload-b': 2600,
  complete: 1800,
};

// ───────────────────────────────────────────────────────────── helpers

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
const toIdx = (xs: number[] | undefined) => uniqSorted((xs ?? []).map((x) => x - 1));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const uds = (n: number) => `${n} ${plural(n, 'ud.', 'uds.')}`;

function indicesOf(types: SlotType[], t: SlotType): number[] {
  const out: number[] = [];
  types.forEach((x, i) => {
    if (x === t) out.push(i);
  });
  return out;
}

function nodeLabel(nodes: NodeDef[], id: number): string {
  return nodes.find((n) => n.id === id)?.label ?? (id === 0 ? 'Depósito' : `Cliente ${id}`);
}

interface Ctx {
  units: Record<string, Unit>;
  aCounter: number;
  bCounter: number;
  warnings: string[];
}

function newUnit(ctx: Ctx, type: UnitType, origin: number, step: number): string {
  const id = type === 'A' ? `a${++ctx.aCounter}` : `b${++ctx.bCounter}`;
  ctx.units[id] = { id, type, origin, loadedAtStep: step, handlings: 0 };
  return id;
}

/** Asegura que el layout coincide con los tipos esperados; si no, lo re-sincroniza. */
function syncLayout(ctx: Ctx, layout: Layout, types: SlotType[], step: number, origin: number, warnings: string[]): Layout {
  const ok = types.every((t, i) => {
    const u = layout[i];
    return t === 'EMPTY' ? u === null : u !== null && ctx.units[u]?.type === t;
  });
  if (ok) return layout;
  warnings.push('El estado de llegada no coincide con la salida anterior; se re-sincronizó el compartimiento.');
  const pool: Record<UnitType, string[]> = { A: [], B: [] };
  layout.forEach((u) => u && pool[ctx.units[u].type].push(u));
  return types.map((t) => (t === 'EMPTY' ? null : pool[t].shift() ?? newUnit(ctx, t, origin, step)));
}

/** Asigna unidades a slots destino preservando el orden (la k-ésima unidad al k-ésimo slot). */
function zipInOrder(unitsBySlot: [number, string][], targets: number[], out: Map<string, number>) {
  const sortedUnits = [...unitsBySlot].sort((a, b) => a[0] - b[0]);
  const sortedTargets = [...targets].sort((a, b) => a - b);
  sortedUnits.forEach(([, id], k) => {
    if (k < sortedTargets.length) out.set(id, sortedTargets[k]);
  });
  return sortedUnits.length - sortedTargets.length;
}

// ───────────────────────────────────────────────────────────── construcción de fases

interface PhaseDraft {
  kind: PhaseKind;
  title: string;
  short: string;
  detail: string;
  tone: PhaseTone;
  /** Unidades que salen del camión hacia el andén. */
  toDock?: string[];
  /** Unidades que salen del camión hacia el cliente/depósito. */
  toCustomer?: string[];
  /** Unidades que entran al camión: id → slot. */
  place?: Map<string, number>;
  /** Unidades que se deslizan dentro del camión: id → slot. */
  slide?: Map<string, number>;
  costed?: number;
}

function materialize(
  drafts: PhaseDraft[],
  start: Layout,
  initialAwaiting: string[],
  ctx: Ctx,
): Phase[] {
  let layout = [...start];
  let dock: string[] = [];
  let handedOver: string[] = [];
  let awaiting = [...initialAwaiting];

  return drafts.map((d) => {
    const motions: Record<string, UnitMotion> = {};
    const next = [...layout];
    const slotOf = new Map<string, number>();
    next.forEach((u, i) => u && slotOf.set(u, i));

    for (const id of d.toDock ?? []) {
      const s = slotOf.get(id);
      if (s !== undefined) next[s] = null;
      dock = [...dock, id];
      motions[id] = 'evac';
      ctx.units[id].handlings += 1;
    }
    for (const id of d.toCustomer ?? []) {
      const s = slotOf.get(id);
      if (s !== undefined) next[s] = null;
      handedOver = [...handedOver, id];
      motions[id] = d.kind === 'unload-b' ? 'unload' : 'deliver';
    }
    if (d.slide) {
      for (const id of d.slide.keys()) {
        const s = slotOf.get(id);
        if (s !== undefined && next[s] === id) next[s] = null;
      }
      for (const [id, target] of d.slide) {
        next[target] = id;
        motions[id] = 'slide';
      }
    }
    for (const [id, target] of d.place ?? []) {
      next[target] = id;
      if (dock.includes(id)) {
        dock = dock.filter((x) => x !== id);
        motions[id] = 'reload';
      } else {
        awaiting = awaiting.filter((x) => x !== id);
        motions[id] = 'pickup';
      }
    }
    layout = next;
    return {
      kind: d.kind,
      title: d.title,
      short: d.short,
      detail: d.detail,
      tone: d.tone,
      layout,
      dock,
      handedOver,
      awaiting,
      motions,
      costedUnits: d.costed ?? 0,
      durationMs: PHASE_DURATION[d.kind],
    };
  });
}

// ───────────────────────────────────────────────────────────── parada en cliente

function planCustomerStop(
  ctx: Ctx,
  solution: SolutionData,
  step: StepData,
  k: number,
  arrivalIn: Layout,
  nextArrival: SlotType[] | undefined,
): StopPlan {
  const Q = solution.capacity;
  const warnings: string[] = [];
  const policy = stepPolicy(solution, step);
  const positional = (solution.model ?? 'TSPPD-H') === 'TSPPD-H';
  const style: StopStyle = positional ? 'GEN' : policy === 2 ? 'P2' : 'P1';
  const label = nodeLabel(solution.nodes, step.to);

  const arrT: SlotType[] = step.slotsArrival ?? step.slots ?? Array(Q).fill('EMPTY');
  const depT: SlotType[] = step.slotsDeparture?.length ? step.slotsDeparture : nextArrival ?? arrT;
  const arrival = syncLayout(ctx, arrivalIn, arrT, k, step.from, warnings);
  const at = (i: number) => arrival[i] as string;

  const AA = indicesOf(arrT, 'A');
  const AB = indicesOf(arrT, 'B');
  const DA = indicesOf(depT, 'A');
  const DB = indicesOf(depT, 'B');

  const dA = Math.min(step.deliverA, AA.length);
  if (dA !== step.deliverA) warnings.push(`deliverA=${step.deliverA} excede las ${AA.length} α a bordo.`);
  const pB = step.pickupB;

  // Pistas del solver (validadas contra el estado de llegada)
  const isA = (i: number) => arrT[i] === 'A';
  const isB = (i: number) => arrT[i] === 'B';
  const delHint = toIdx(step.deliveredSlots).filter(isA);
  const rehAHint = toIdx(step.rehandledA).filter((i) => isA(i) && !delHint.includes(i));
  const rehBHint = toIdx(step.rehandledB).filter(isB);

  let budgetA: number;
  let budgetB: number;
  if (step.rehandledA || step.rehandledB) {
    budgetA = step.rehandledA?.length ?? 0;
    budgetB = step.rehandledB?.length ?? 0;
  } else {
    budgetB = style === 'P2' ? 0 : Math.min(step.handlingCount, AB.length);
    budgetA = step.handlingCount - budgetB;
  }
  budgetA = Math.max(0, Math.min(budgetA, AA.length - dA));
  budgetB = Math.max(0, Math.min(budgetB, AB.length));

  // ── α: entregadas (D), evacuadas (EA) y el resto (se quedan o se deslizan)
  const D = new Set<number>(delHint.slice(0, dA));
  const EA = new Set<number>(rehAHint.filter((i) => !D.has(i)).slice(0, budgetA));
  const moverA = new Set<number>();

  if (positional) {
    for (const i of AA) {
      if (depT[i] === 'A' || D.has(i) || EA.has(i)) continue;
      if (D.size < dA) D.add(i);
      else if (EA.size < budgetA) EA.add(i);
      else moverA.add(i);
    }
  }
  for (const i of AA) {
    if (D.size >= dA) break;
    if (!D.has(i) && !EA.has(i)) {
      D.add(i);
      moverA.delete(i);
    }
  }
  const promotable = (cands: number[], set: Set<number>, budget: number, movers: Set<number>) => {
    const order = [...cands.filter((i) => movers.has(i)), ...cands.filter((i) => !movers.has(i))];
    for (const i of order) {
      if (set.size >= budget) break;
      if (!set.has(i)) {
        set.add(i);
        movers.delete(i);
      }
    }
  };
  promotable(AA.filter((i) => !D.has(i)), EA, budgetA, moverA);

  const restA = AA.filter((i) => !D.has(i) && !EA.has(i));
  const placeA = new Map<string, number>(); // recargas desde el andén
  const slideMap = new Map<string, number>(); // deslizamientos sin costo
  const eaSorted = [...EA].sort((a, b) => a - b);

  if (positional) {
    const stayA = restA.filter((i) => !moverA.has(i) && depT[i] === 'A');
    const freeA = DA.filter((i) => !stayA.includes(i));
    const movers: [number, string][] = restA.filter((i) => !stayA.includes(i)).map((i) => [i, at(i)]);
    const reloads: [number, string][] = eaSorted.map((i) => [i, at(i)]);
    const all = new Map<string, number>();
    const diff = zipInOrder([...movers, ...reloads], freeA, all);
    if (diff !== 0) warnings.push(`Conservación α: ${diff > 0 ? `${diff} unidades sin slot` : `${-diff} slots α sin unidad`}.`);
    for (const [id, t] of all) (EA.has(arrival.indexOf(id)) ? placeA : slideMap).set(id, t);
  } else {
    const targets = [...DA];
    const reloadTargets = targets.slice(0, eaSorted.length);
    const keepTargets = targets.slice(eaSorted.length);
    zipInOrder(eaSorted.map((i) => [i, at(i)]), reloadTargets, placeA);
    const diff = zipInOrder(restA.map((i) => [i, at(i)]), keepTargets, slideMap);
    if (diff !== 0 || targets.length !== eaSorted.length + restA.length)
      warnings.push(`Conservación α: ${restA.length + eaSorted.length} unidades para ${targets.length} slots.`);
  }

  // ── β: evacuadas (EB), nuevas recogidas y el resto
  const EB = new Set<number>(rehBHint.slice(0, budgetB));
  const moverB = new Set<number>();
  if (positional) {
    for (const i of AB) {
      if (depT[i] === 'B' || EB.has(i)) continue;
      if (EB.size < budgetB) EB.add(i);
      else moverB.add(i);
    }
  }
  promotable(AB, EB, budgetB, moverB);
  const restB = AB.filter((i) => !EB.has(i));
  const ebSorted = [...EB].sort((a, b) => a - b);

  const pickupIds = Array.from({ length: pB }, () => newUnit(ctx, 'B', step.to, k));
  const placeNewB = new Map<string, number>();
  const placeB = new Map<string, number>();

  const stayB = positional ? restB.filter((i) => !moverB.has(i) && depT[i] === 'B') : [];
  const freeB = DB.filter((i) => !stayB.includes(i));
  const newHint = toIdx(step.newBSlots).filter((i) => depT[i] === 'B');
  const newTargets =
    !positional && newHint.length === pB ? newHint : freeB.slice(0, pB);
  const oldTargets = freeB.filter((i) => !newTargets.includes(i));
  pickupIds.forEach((id, n) => {
    if (n < newTargets.length) placeNewB.set(id, newTargets[n]);
  });

  if (positional) {
    const movers: [number, string][] = restB.filter((i) => !stayB.includes(i)).map((i) => [i, at(i)]);
    const reloads: [number, string][] = ebSorted.map((i) => [i, at(i)]);
    const all = new Map<string, number>();
    const diff = zipInOrder([...movers, ...reloads], oldTargets, all);
    if (diff !== 0) warnings.push(`Conservación β: ${diff > 0 ? `${diff} unidades sin slot` : `${-diff} slots β sin unidad`}.`);
    for (const [id, t] of all) (EB.has(arrival.indexOf(id)) ? placeB : slideMap).set(id, t);
  } else {
    // [nuevas…, recargadas…, las que no se tocaron…] desde la puerta hacia el fondo
    const reloadTargets = oldTargets.slice(0, ebSorted.length);
    const keepTargets = oldTargets.slice(ebSorted.length);
    zipInOrder(ebSorted.map((i) => [i, at(i)]), reloadTargets, placeB);
    const diff = zipInOrder(restB.map((i) => [i, at(i)]), keepTargets, slideMap);
    if (diff !== 0 || oldTargets.length !== ebSorted.length + restB.length)
      warnings.push(`Conservación β: ${restB.length + ebSorted.length} unidades para ${oldTargets.length} slots.`);
  }
  if (newTargets.length < pB) warnings.push(`Solo hay ${newTargets.length} slots para ${pB} β recogidas.`);

  // Deslizamientos reales (unidades cuyo slot cambia sin manipulación)
  for (const [id, t] of [...slideMap]) if (arrival[t] === id) slideMap.delete(id);

  // ── fases
  const deliveredIds = [...D].sort((a, b) => a - b).map(at);
  const evacAIds = eaSorted.map(at);
  const evacBIds = ebSorted.map(at);
  const occ = AA.length + AB.length;

  const drafts: PhaseDraft[] = [
    {
      kind: 'arrive',
      title: `Llegada a ${label}`,
      short: 'Llegada',
      detail:
        `El camión llega con ${AA.length} α y ${AB.length} β a bordo (${occ}/${Q}). ` +
        `Aquí debe entregar ${uds(dA)} α y recoger ${uds(pB)} β` +
        (step.handlingCount > 0 ? `, con ${step.handlingCount} manipulaciones LIFO.` : ', sin manipulaciones.'),
      tone: 'neutral',
    },
  ];

  if (style === 'GEN') {
    if (evacAIds.length + evacBIds.length > 0) {
      drafts.push({
        kind: 'evac',
        title: 'Evacuación al andén',
        short: 'Evacuar',
        detail:
          `${[evacBIds.length && `${uds(evacBIds.length)} β`, evacAIds.length && `${uds(evacAIds.length)} α`]
            .filter(Boolean)
            .join(' y ')} bloquean el acceso a la mercancía a entregar: se descargan temporalmente al andén.`,
        tone: 'handling',
        toDock: [...evacBIds, ...evacAIds],
        costed: evacAIds.length + evacBIds.length,
      });
    }
  } else if (evacBIds.length > 0) {
    drafts.push({
      kind: 'evac-b',
      title: 'Evacuación de β en compuerta',
      short: 'Evacuar β',
      detail:
        style === 'P2'
          ? `${uds(evacBIds.length)} β del bloque trasero obstruyen la compuerta: se bajan al andén para reubicarlas al fondo.`
          : `${uds(evacBIds.length)} β en la compuerta bloquean la mercancía α: se descargan temporalmente al andén.`,
      tone: 'handling',
      toDock: evacBIds,
      costed: evacBIds.length,
    });
  }

  if (deliveredIds.length > 0) {
    drafts.push({
      kind: 'deliver-a',
      title: `Entrega de α a ${label}`,
      short: 'Entregar α',
      detail: `Con la compuerta despejada se entregan ${uds(deliveredIds.length)} α, las más cercanas a la puerta.`,
      tone: 'alpha',
      toCustomer: deliveredIds,
    });
  }

  if (style !== 'GEN' && evacAIds.length > 0) {
    drafts.push({
      kind: 'evac-a',
      title: 'Evacuación de α remanentes',
      short: 'Evacuar α',
      detail: `${uds(evacAIds.length)} α que siguen en ruta se retiran al andén para dejar libre el fondo del camión.`,
      tone: 'handling',
      toDock: evacAIds,
      costed: evacAIds.length,
    });
  }

  const reloadAMap = placeA;
  const reloadBMap = placeB;
  const loadDrafts: PhaseDraft[] = [];
  if (style === 'P2') {
    const frontB = new Map([...reloadBMap, ...placeNewB]);
    if (frontB.size > 0) {
      loadDrafts.push({
        kind: 'load-b-front',
        title: 'Carga de β al fondo',
        short: 'β al fondo',
        detail:
          [pB > 0 && `${uds(pB)} β recogidas`, reloadBMap.size > 0 && `${uds(reloadBMap.size)} β del andén`]
            .filter(Boolean)
            .join(' y ') + ' se ubican al fondo del compartimiento (junto a la cabina), según la Política 2.',
        tone: 'beta',
        place: frontB,
      });
    }
    if (reloadAMap.size > 0) {
      loadDrafts.push({
        kind: 'reload-a',
        title: 'Reingreso de α a la compuerta',
        short: 'Reingreso α',
        detail: `${uds(reloadAMap.size)} α vuelven desde el andén y quedan frente a la carga β, listas para las próximas entregas.`,
        tone: 'handling',
        place: reloadAMap,
      });
    }
  } else {
    const groups: PhaseDraft[] = [];
    if (reloadAMap.size > 0)
      groups.push({
        kind: 'reload-a',
        title: 'Reingreso de α',
        short: 'Reingreso α',
        detail: `${uds(reloadAMap.size)} α vuelven desde el andén al compartimiento.`,
        tone: 'handling',
        place: reloadAMap,
      });
    if (reloadBMap.size > 0)
      groups.push({
        kind: 'reload-b',
        title: 'Reingreso de β',
        short: 'Reingreso β',
        detail: `${uds(reloadBMap.size)} β vuelven desde el andén tras la entrega.`,
        tone: 'handling',
        place: reloadBMap,
      });
    if (placeNewB.size > 0)
      groups.push({
        kind: 'pickup-b',
        title: `Recolección de β en ${label}`,
        short: 'Recoger β',
        detail:
          `Se cargan ${uds(placeNewB.size)} β recogidas` +
          (style === 'P1' ? ' en la compuerta trasera (Política 1).' : ' en los slots libres elegidos por el modelo.'),
        tone: 'beta',
        place: placeNewB,
      });
    if (style === 'GEN') {
      // El camión se carga por la puerta: primero lo que va más al fondo.
      const depth = (d: PhaseDraft) => {
        const v = [...(d.place?.values() ?? [])];
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      };
      groups.sort((a, b) => depth(b) - depth(a));
    }
    loadDrafts.push(...groups);
  }

  // Reacomodos sin costo: se funden con la última fase de retiro (el hueco se cierra
  // mientras salen las últimas unidades); si no hubo retiros, con la primera carga.
  if (slideMap.size > 0) {
    const removalKinds: PhaseKind[] = ['evac', 'evac-b', 'deliver-a', 'evac-a'];
    const lastRemoval = [...drafts].reverse().find((d) => removalKinds.includes(d.kind));
    const host = lastRemoval ?? loadDrafts[0];
    const note = `${uds(slideMap.size)} se desplazan dentro del camión para consolidar los bloques (reacomodo sin costo).`;
    if (host) {
      host.slide = slideMap;
      host.detail += ` ${note}`;
    } else {
      drafts.push({ kind: 'compact', title: 'Reacomodo del compartimiento', short: 'Reacomodo', detail: note, tone: 'neutral', slide: slideMap });
    }
  }
  drafts.push(...loadDrafts);

  const phases = materialize(drafts, arrival, pickupIds, ctx);
  const departure = phases[phases.length - 1].layout;

  // Contabilidad de identidades
  for (const id of deliveredIds) {
    ctx.units[id].destination = step.to;
    ctx.units[id].leftAtStep = k;
  }

  const mismatch = depT.findIndex((t, i) => (t === 'EMPTY' ? departure[i] !== null : ctx.units[departure[i] ?? '']?.type !== t));
  if (mismatch >= 0) warnings.push(`La salida calculada difiere del solver desde el slot ${mismatch + 1}.`);

  const costPhase = phases.findIndex((p) => p.costedUnits > 0);
  return {
    stepIndex: k,
    from: step.from,
    to: step.to,
    label,
    isDepot: false,
    style,
    policy,
    arrival,
    departure,
    phases,
    handled: { A: evacAIds.length, B: evacBIds.length },
    slid: slideMap.size,
    delivered: deliveredIds,
    picked: pickupIds,
    costPhase,
    warnings,
  };
}

// ───────────────────────────────────────────────────────────── retorno al depósito

function planDepotStop(ctx: Ctx, solution: SolutionData, step: StepData, k: number, arrivalIn: Layout, isLast: boolean): StopPlan {
  const warnings: string[] = [];
  const Q = solution.capacity;
  const arrT: SlotType[] = step.slotsArrival ?? step.slots ?? Array(Q).fill('EMPTY');
  const arrival = syncLayout(ctx, arrivalIn, arrT, k, step.from, warnings);
  const onboard = arrival
    .map((u, i) => [u, i] as const)
    .filter(([u]) => u !== null)
    .sort((a, b) => a[1] - b[1])
    .map(([u]) => u as string);
  const nB = onboard.filter((u) => ctx.units[u].type === 'B').length;
  const nA = onboard.length - nB;
  if (nA > 0) warnings.push(`${nA} unidades α regresan al depósito sin entregar.`);

  const drafts: PhaseDraft[] = [
    {
      kind: 'arrive',
      title: 'Retorno al Depósito',
      short: 'Llegada',
      detail: `El camión vuelve al depósito con ${uds(nB)} β recolectadas en la ruta.`,
      tone: 'neutral',
    },
  ];
  if (onboard.length > 0) {
    drafts.push({
      kind: 'unload-b',
      title: 'Descarga total en el depósito',
      short: 'Descargar β',
      detail: `Se descargan las ${uds(nB)} β por la compuerta trasera; el compartimiento queda vacío.`,
      tone: 'beta',
      toCustomer: onboard,
    });
  }
  if (isLast) {
    drafts.push({
      kind: 'complete',
      title: 'Tour completado',
      short: 'Fin',
      detail: `Todas las demandas quedaron satisfechas. Z* = ${solution.objectiveValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })}.`,
      tone: 'success',
    });
  }
  const phases = materialize(drafts, arrival, [], ctx);
  for (const u of onboard) {
    ctx.units[u].destination = 0;
    ctx.units[u].leftAtStep = k;
  }
  return {
    stepIndex: k,
    from: step.from,
    to: step.to,
    label: nodeLabel(solution.nodes, 0),
    isDepot: true,
    style: 'DEPOT',
    policy: null,
    arrival,
    departure: phases[phases.length - 1].layout,
    phases,
    handled: { A: 0, B: 0 },
    slid: 0,
    delivered: onboard,
    picked: [],
    costPhase: -1,
    warnings,
  };
}

// ───────────────────────────────────────────────────────────── API pública

export function buildChoreography(solution: SolutionData): Choreography {
  const ctx: Ctx = { units: {}, aCounter: 0, bCounter: 0, warnings: [] };
  const Q = solution.capacity;
  const steps = solution.steps;
  const firstArrival: SlotType[] = steps[0]?.slotsArrival ?? steps[0]?.slots ?? Array(Q).fill('EMPTY');
  const initial: Layout = firstArrival.map((t) => (t === 'EMPTY' ? null : newUnit(ctx, t, 0, -1)));

  const stops: StopPlan[] = [];
  let layout = initial;
  steps.forEach((step, k) => {
    const next = steps[k + 1];
    const nextArrival = next ? next.slotsArrival ?? next.slots : undefined;
    const plan =
      step.to === 0
        ? planDepotStop(ctx, solution, step, k, layout, k === steps.length - 1)
        : planCustomerStop(ctx, solution, step, k, layout, nextArrival);
    stops.push(plan);
    layout = plan.departure;
  });

  for (const s of stops) for (const w of s.warnings) ctx.warnings.push(`Paso ${s.stepIndex + 1}: ${w}`);
  return { capacity: Q, model: solution.model ?? 'TSPPD-H', units: ctx.units, initial, stops, warnings: ctx.warnings };
}

/** Vista del compartimiento en un instante dado de la reproducción. */
export interface BayView {
  layout: Layout;
  dock: string[];
  handedOver: string[];
  awaiting: string[];
  motions: Record<string, UnitMotion>;
  phase: Phase | null;
}

export function bayViewAt(
  choreo: Choreography,
  stepIndex: number,
  arrived: boolean,
  subStep: number,
  atDepotInitial: boolean,
): BayView {
  const stop = choreo.stops[stepIndex];
  if (!stop || atDepotInitial) {
    return { layout: choreo.initial, dock: [], handedOver: [], awaiting: [], motions: {}, phase: null };
  }
  if (!arrived) {
    return { layout: stop.arrival, dock: [], handedOver: [], awaiting: [], motions: {}, phase: null };
  }
  const phase = stop.phases[Math.max(0, Math.min(subStep, stop.phases.length - 1))];
  return {
    layout: phase.layout,
    dock: phase.dock,
    handedOver: phase.handedOver,
    awaiting: phase.awaiting,
    motions: phase.motions,
    phase,
  };
}

export function countLayout(choreo: Choreography, layout: Layout) {
  let A = 0;
  let B = 0;
  for (const u of layout) {
    if (!u) continue;
    if (choreo.units[u]?.type === 'A') A++;
    else B++;
  }
  return { A, B, empty: layout.length - A - B };
}

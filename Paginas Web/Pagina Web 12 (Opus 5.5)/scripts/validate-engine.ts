// Valida el motor de coreografía sobre todas las soluciones de ../../Outputs.
// Uso: node scripts/validate-engine.ts   (Node ≥ 22.18 ejecuta TypeScript directamente)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildChoreography } from '../src/lib/choreography.ts';
import type { SolutionData, SlotType } from '../src/types/solution.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../../Outputs');
const files = fs.readdirSync(outputsDir).filter((f) => f.endsWith('.txt') || f.endsWith('.json'));

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.log('  ✗ ' + msg);
};
const tally = { solutions: 0, stops: 0, phases: 0, warnings: 0, handlingMismatch: 0, slides: 0, maxPhases: 0 };
const phaseKinds: Record<string, number> = {};

for (const f of files) {
  const sol: SolutionData = JSON.parse(fs.readFileSync(path.join(outputsDir, f), 'utf-8'));
  const ch = buildChoreography(sol);
  tally.solutions++;
  tally.warnings += ch.warnings.length;
  if (ch.warnings.length) for (const w of ch.warnings.slice(0, 3)) console.log(`  ⚠ ${f}: ${w}`);

  ch.stops.forEach((stop, k) => {
    tally.stops++;
    tally.phases += stop.phases.length;
    tally.maxPhases = Math.max(tally.maxPhases, stop.phases.length);
    tally.slides += stop.slid;
    for (const p of stop.phases) phaseKinds[p.kind] = (phaseKinds[p.kind] ?? 0) + 1;
    const step = sol.steps[k];
    const depT: SlotType[] = step.slotsDeparture?.length ? step.slotsDeparture : sol.steps[k + 1]?.slotsArrival ?? [];
    const got = stop.departure.map((u) => (u ? ch.units[u].type : 'EMPTY'));
    if (got.join() !== depT.join()) fail(`${f} paso ${k + 1}: salida calculada ≠ solver`);
    if (stop.phases[0].kind !== 'arrive') fail(`${f} paso ${k + 1}: la primera fase no es 'arrive'`);

    if (!stop.isDepot) {
      if (stop.delivered.length !== step.deliverA) fail(`${f} paso ${k + 1}: entregadas ${stop.delivered.length} ≠ ${step.deliverA}`);
      if (stop.picked.length !== step.pickupB) fail(`${f} paso ${k + 1}: recogidas ${stop.picked.length} ≠ ${step.pickupB}`);
      if (stop.handled.A + stop.handled.B !== step.handlingCount) tally.handlingMismatch++;
    }

    // Unicidad y conservación de unidades en cada fase
    for (const p of stop.phases) {
      const seen = new Set<string>();
      for (const u of [...p.layout, ...p.dock, ...p.awaiting, ...p.handedOver]) {
        if (!u) continue;
        if (seen.has(u)) fail(`${f} paso ${k + 1} fase ${p.kind}: unidad ${u} duplicada`);
        seen.add(u);
      }
      const inTruck = p.layout.filter(Boolean).length + p.dock.length + p.awaiting.length + p.handedOver.length;
      const expected = stop.arrival.filter(Boolean).length + stop.picked.length;
      if (inTruck !== expected) fail(`${f} paso ${k + 1} fase ${p.kind}: ${inTruck} unidades ≠ ${expected}`);
    }
    const last = stop.phases[stop.phases.length - 1];
    if (last.dock.length) fail(`${f} paso ${k + 1}: quedan ${last.dock.length} unidades en el andén`);
    if (last.awaiting.length) fail(`${f} paso ${k + 1}: quedan ${last.awaiting.length} β sin recoger`);
  });

  // Identidad: cada cliente recibe exactamente α_i unidades y entrega β_i unidades
  for (const node of sol.nodes.filter((n) => !n.isDepot)) {
    const toNode = Object.values(ch.units).filter((u) => u.type === 'A' && u.destination === node.id).length;
    const fromNode = Object.values(ch.units).filter((u) => u.type === 'B' && u.origin === node.id).length;
    if (toNode !== node.alpha) fail(`${f}: ${node.label} recibe ${toNode} α ≠ α_i=${node.alpha}`);
    if (fromNode !== node.beta) fail(`${f}: ${node.label} aporta ${fromNode} β ≠ β_i=${node.beta}`);
  }
  const lastStop = ch.stops[ch.stops.length - 1];
  if (lastStop.departure.some(Boolean)) fail(`${f}: el camión no termina vacío`);
  const undelivered = Object.values(ch.units).filter((u) => u.destination === undefined);
  if (undelivered.length) fail(`${f}: ${undelivered.length} unidades sin destino final`);
}

console.log('\nResumen:', JSON.stringify({ ...tally, phaseKinds }, null, 2));
console.log(failures === 0 ? '\n✓ Motor consistente en todas las soluciones' : `\n✗ ${failures} fallas`);
process.exit(failures === 0 ? 0 : 1);

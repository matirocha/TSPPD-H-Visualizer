// Pruebas de la máquina de estados de reproducción sobre fases reales del motor.
// Uso: node scripts/validate-playback.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildChoreography } from '../src/lib/choreography.ts';
import * as P from '../src/state/playback.ts';
import type { PlaybackEnv, PlaybackState } from '../src/state/playback.ts';
import type { SolutionData } from '../src/types/solution.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../../Outputs');
const files = fs.readdirSync(outputsDir).filter((f) => f.endsWith('.txt'));

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    if (failures <= 30) console.log('  ✗ ' + msg);
  }
};

/** Ejecuta la reproducción automática hasta que se pause o termine. */
function run(s: PlaybackState, env: PlaybackEnv, visits: string[], maxIter = 200000): PlaybackState {
  for (let i = 0; i < maxIter; i++) {
    if (s.status !== 'playing') return s;
    if (!s.arrived) s = P.tick(s, 16, 3200, env);
    else {
      visits.push(`${s.stepIndex}:${s.subStep}`);
      s = P.autoAdvance(s, s.stepIndex, s.subStep, env);
    }
    if (s.arrived && s.status === 'paused') visits.push(`${s.stepIndex}:${s.subStep}`);
  }
  throw new Error('bucle sin fin');
}

for (const f of files) {
  const sol: SolutionData = JSON.parse(fs.readFileSync(path.join(outputsDir, f), 'utf-8'));
  const ch = buildChoreography(sol);
  const counts = ch.stops.map((s) => s.phases.length);
  const expected = counts.flatMap((n, k) => Array.from({ length: n }, (_, j) => `${k}:${j}`));
  const envOn: PlaybackEnv = { lastStep: sol.steps.length - 1, phaseCounts: counts, continuous: true };
  const envOff: PlaybackEnv = { ...envOn, continuous: false };

  // 1. Continuo ON: recorre todo sin pausas y termina.
  {
    const visits: string[] = [];
    const end = run(P.play(P.START), envOn, visits);
    check(end.finished && end.status === 'idle', `${f}: continuo ON no termina`);
    check(visits.join() === expected.join(), `${f}: continuo ON visita fases fuera de orden`);
  }

  // 2. Continuo OFF: se pausa exactamente al llegar a cada parada; Play continúa.
  {
    let s = P.play(P.START);
    let pauses = 0;
    const visits: string[] = [];
    for (let guard = 0; guard < 1000 && !s.finished; guard++) {
      const v: string[] = [];
      s = run(s, envOff, v);
      visits.push(...v);
      if (s.finished) break;
      check(s.status === 'paused' && s.arrived && s.subStep === 0, `${f}: OFF debería pausar al llegar (paso ${s.stepIndex})`);
      pauses++;
      s = P.play(s);
    }
    check(pauses === sol.steps.length, `${f}: OFF pausó ${pauses} veces ≠ ${sol.steps.length} paradas`);
    check([...new Set(visits)].join() === expected.join(), `${f}: OFF no recorre todas las fases`);
  }

  // 3. Paso a paso manual con "Siguiente" (incluye continuar ruta y tránsito).
  {
    let s: PlaybackState = P.START;
    const visits: string[] = [];
    for (let guard = 0; guard < 5000 && !s.finished; guard++) {
      if (s.status === 'playing') {
        s = run(s, envOn, []);
        check(s.status === 'paused' && s.arrived, `${f}: "Continuar ruta" manual debe pausar al llegar`);
      }
      if (s.arrived) visits.push(`${s.stepIndex}:${s.subStep}`);
      s = P.nextSubStep(s, envOn);
    }
    check(s.finished, `${f}: manual no termina`);
    check([...new Set(visits)].join() === expected.join(), `${f}: manual no recorre todas las fases en orden`);
  }

  // 4. "Anterior" desde el final retrocede por todas las fases hasta el depósito.
  {
    let s: PlaybackState = { ...P.START, stepIndex: envOn.lastStep, arrived: true, progress: 1, subStep: counts[envOn.lastStep] - 1, finished: true };
    const visits: string[] = [];
    for (let guard = 0; guard < 5000; guard++) {
      s = P.prevSubStep(s, envOn);
      if (!s.arrived) break;
      visits.push(`${s.stepIndex}:${s.subStep}`);
    }
    check(s.stepIndex === 0 && !s.arrived && s.progress === 0, `${f}: retroceso no vuelve al depósito`);
    const rev = [...new Set(visits)].reverse();
    check(rev.join() === expected.join(), `${f}: retroceso no pasa por todas las fases`);
  }

  // 5. Casos borde heredados de la Página 10
  {
    const a = P.nextStop(P.START, envOn);
    check(a.stepIndex === 0 && a.arrived, `${f}: "Siguiente" desde el depósito debe llegar al PRIMER cliente`);
    const b = P.seek(P.START, 2, 0.5, envOn);
    check(b.stepIndex === 2 && !b.arrived && b.progress === 0.5 && b.status === 'paused', `${f}: seek`);
    const c = run(P.play(b), envOn, []);
    check(c.finished, `${f}: tras seek, play termina el tour`);
    const d = P.play({ ...P.START, finished: true, stepIndex: envOn.lastStep, arrived: true });
    check(d.stepIndex === 0 && d.status === 'playing' && !d.finished, `${f}: play al terminar reinicia`);
    const e = P.prevStop(P.selectStep(P.START, 3, envOn), envOn);
    check(e.stepIndex === 2 && e.arrived && e.subStep === 0, `${f}: prevStop`);
    const g = P.setSubStep(P.seek(P.START, 1, 0.3, envOn), 99, envOn);
    check(g.arrived && g.subStep === counts[1] - 1, `${f}: setSubStep acota y marca llegada`);
  }
}

console.log(failures === 0 ? `✓ Reproducción consistente en ${files.length} soluciones` : `✗ ${failures} fallas`);
process.exit(failures === 0 ? 0 : 1);

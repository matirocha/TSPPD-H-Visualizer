/**
 * Instancias grandes de Erdoğan et al. (2012, §5): las 10 instancias euclidianas de 200 clientes de
 * Gendreau, Laporte & Vigo (1999) —e_vigo/, bloques «0. 200 Id» (β = 0)— recortadas a sus primeros
 * |Vc| = 20, 40, …, 200 clientes, con la demanda escalada como en Battarra et al. (2010), Ec. (15):
 *
 *     p'_i = max{1, p_i mod 20},   β_i = ⌊p'_i (i mod 5) / 5⌋,   α_i = p'_i − β_i,
 *     Q = max{Σ α_i, Σ β_i},       h_a = h_b = h (PAPER_H: el que reproduce las Tablas 8–9).
 *
 * verify.mjs comprueba que así se reproducen exactamente (matriz, α, β y Q) los 49 archivos
 * Instancias/2_<N>_<Id>.tsp que ya existían para |Vc| ≤ 100.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COST_FILE = path.join(BASE_DIR, 'e_vigo', 'ecosti.dat');
export const DATA_FILE = path.join(BASE_DIR, 'e_vigo', 'edati.dat');

export const SIZES = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
export const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Clientes de las instancias originales de Gendreau et al. */
export const FULL_SIZE = 200;
/** h·|Vc| = 20: costos de ruteo y de manipulación de magnitud parecida (§5). */
export const H_TIMES_N = 20;

/**
 * h que realmente usaron las Tablas 8–9 del paper. El texto (§5) dice h·|Vc| = 20, pero los valores
 * publicados solo se reproducen con 20/|Vc| redondeado a dos decimales (0,33 · 0,17 · 0,14 · 0,11) y,
 * en |Vc| = 80 y 100, con la mitad (0,125 y 0,1). Se determinó comparando nuestras soluciones iniciales
 * (TSP + reubicación del depósito + DP) con la columna «Initial solution»: cada h elegido reproduce
 * exactamente varias de ellas y ningún otro candidato reproduce alguna; los decimales de todas las cifras
 * de cada |Vc| (múltiplos de 0,125 con 80 y 160, de 0,1 con 100 y 200, centésimas pares con 140) lo confirman.
 */
export const PAPER_H = { 20: 1, 40: 0.5, 60: 0.33, 80: 0.125, 100: 0.1, 120: 0.17, 140: 0.14, 160: 0.125, 180: 0.11, 200: 0.1 };

/** h por defecto: el de las Tablas 8–9 si |Vc| es uno de sus tamaños; si no, 20/|Vc|. */
export function defaultH(n) {
  return PAPER_H[n] ?? H_TIMES_N / n;
}

const SEPARATOR = '---------------------';
let blockCache = null;
const baseCache = new Map();

function blocks() {
  if (!blockCache) {
    blockCache = {
      cost: fs.readFileSync(COST_FILE, 'utf8').split(SEPARATOR),
      data: fs.readFileSync(DATA_FILE, 'utf8').split(SEPARATOR),
    };
  }
  return blockCache;
}

/** Tokens del bloque «β |V| Id …» (sin la cabecera de 4 tokens). β = «0.»: instancias con β = 0. */
function findBlock(list, size, id, betaToken = '0.') {
  for (const b of list) {
    const t = b.trim().split(/\s+/);
    if (t.length >= 4 && t[0] === betaToken && t[1] === String(size) && t[2] === String(id)) return t.slice(4);
  }
  throw new Error(`No se encontró el bloque β=${betaToken} |V|=${size} Id=${id} en e_vigo/`);
}

/** Matriz completa 201×201 y valores p_i de la instancia original de 200 clientes. */
export function loadBase(id) {
  if (baseCache.has(id)) return baseCache.get(id);
  const { cost, data } = blocks();
  const V = FULL_SIZE + 1;
  const ct = findBlock(cost, FULL_SIZE, id);
  if (ct.length < V * V) throw new Error(`Matriz incompleta para Id=${id}: ${ct.length} valores`);
  const c = new Int32Array(V * V);
  for (let k = 0; k < V * V; k++) c[k] = Number.parseInt(ct[k], 10);
  const dt = findBlock(data, FULL_SIZE, id);
  const p = new Int32Array(FULL_SIZE);
  for (let i = 0; i < FULL_SIZE; i++) p[i] = Number.parseInt(dt[i], 10);
  const base = { id, V, c, p };
  baseCache.set(id, base);
  return base;
}

/**
 * Instancia con los primeros n clientes. c es una matriz plana (n+1)×(n+1) en Float64Array
 * (c[i*V + j]); la diagonal de e_vigo (10 000 000) se reemplaza por 0, nunca se usa.
 */
export function buildInstance(n, id, { h } = {}) {
  if (!Number.isInteger(n) || n < 1 || n > FULL_SIZE) throw new Error(`n fuera de rango: ${n}`);
  const base = loadBase(id);
  const V = n + 1;
  const c = new Float64Array(V * V);
  for (let i = 0; i < V; i++) {
    for (let j = 0; j < V; j++) c[i * V + j] = i === j ? 0 : base.c[i * base.V + j];
  }
  const alpha = new Int32Array(V);
  const beta = new Int32Array(V);
  let sumA = 0;
  let sumB = 0;
  for (let i = 1; i <= n; i++) {
    const pp = Math.max(1, base.p[i - 1] % 20);
    const b = Math.floor((pp * (i % 5)) / 5);
    alpha[i] = pp - b;
    beta[i] = b;
    sumA += alpha[i];
    sumB += beta[i];
  }
  const hv = h ?? defaultH(n);
  return { n, id, V, c, alpha, beta, Q: Math.max(sumA, sumB), sumAlpha: sumA, sumBeta: sumB, h: hv, ha: hv, hb: hv };
}

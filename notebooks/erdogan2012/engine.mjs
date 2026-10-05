/**
 * Motor de las metaheurísticas de Erdoğan, Battarra, Laporte & Vigo (2012) para el TSPPD-H bajo la
 * Política 3 (papers/Erdogan2012.pdf). En JavaScript (Node.js) y no en Python porque con |Vc| = 200
 * el vecindario relocate + 2-opt tiene ~60 000 movimientos y cada evaluación exacta cuesta O(n²):
 * en Python puro una sola corrida tardaría días.
 *
 *   · Evaluación EXACTA de la manipulación (§2.1): Algoritmo 2.1 (p_ij) + DP f(i) = min_j {p_ij + f(j)},
 *     fusionados en una sola pasada O(n²) hacia atrás, sin guardar la matriz p.
 *   · Evaluación HEURÍSTICA lineal (§2.2): umbral sobre la cantidad de recogidas a bordo derivado de la
 *     solución cerrada del caso especial (Ecs. 13–14), recalculado tras cada aplicación de la Política 2.
 *   · Vecindario (§3): relocate (|Vc|(|Vc|−1) movimientos) + 2-opt ((|Vc|+1)(|Vc|−2)/2); solo tours
 *     factibles (capacidad Q). Con evaluación heurística, el mejor movimiento se re-evalúa con la DP exacta.
 *   · Dos fases (solución inicial, §4): tour TSP + reubicación del depósito (Mosheiov 1994) eligiendo la
 *     posición factible de menor ruteo + manipulación óptima.
 *   · ILS (Algoritmo 4.2), TS (Algoritmo 4.1) e ITS (Algoritmo 4.3).
 *
 * Decisiones de implementación (el paper no las fija o usa software externo) — ver también benchmark.mjs:
 *   · Tour TSP: el paper usa Lin–Kernighan de Concorde. Aquí: búsqueda local 2-opt + Or-opt (listas de
 *     vecinos completas, primera mejora) iterada con perturbaciones double-bridge (semilla fija).
 *   · Poda exacta del barrido: se descarta un vecino cuyo ruteo ya iguala o supera el mejor costo
 *     encontrado en el barrido (la manipulación es ≥ 0). El movimiento elegido es idéntico al de
 *     evaluar todo el vecindario, y la regla es la misma con evaluación exacta y heurística.
 *   · En la DP se corta la búsqueda de j cuando el costo acumulado de la Política 1 (y, que solo crece)
 *     ya alcanza el mínimo f(i) encontrado: p_ij ≥ y y f(j) ≥ 0, así que ningún j posterior mejora.
 *   · Empates: «if cost1 < cost2 relocate, else 2-opt» (Algoritmo 4.1), también en el ILS.
 *   · Lista tabú (§4.1): relocate del cliente v → entrada (v, v), que prohíbe reubicar a v; 2-opt entre las
 *     posiciones i y j → entrada (i, j), que prohíbe ese mismo 2-opt. Largo 0,5·|Vc| (FIFO). Aspiración:
 *     un movimiento tabú se permite si su costo mejora costCurrent (el costo del tour actual), como dice §4.1.
 *   · Diversificación (ILS, ITS): un movimiento aleatorio infactible se descarta y se sortea otro
 *     (máx. 100 intentos), igual que notebooks/tsppd_h_alg42_ils.py.
 *   · Búsqueda local del ILS: un movimiento se acepta si mejora costCurrent (ver ils(), `lsRule`).
 */

export const EPS = 1e-9;
export const MAX_RANDOM_TRIES = 100;

/* ─────────────────────────── Números aleatorios ─────────────────────────── */

/** splitmix32 → semilla de xoshiro128** (reproducible entre corridas y máquinas). */
export function makeRng(seed) {
  let s = seed >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = split();
  let b = split();
  let c = split();
  let d = split();
  const next32 = () => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return result;
  };
  return {
    /** Real uniforme en [0, 1). */
    next: () => next32() / 4294967296,
    /** Entero uniforme en [lo, hi]. */
    int: (lo, hi) => lo + Math.floor((next32() / 4294967296) * (hi - lo + 1)),
  };
}

function rotl(x, k) {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Semilla entera a partir de varios enteros (FNV-1a sobre sus bytes). */
export function seedOf(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    let x = p >>> 0;
    for (let k = 0; k < 4; k++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      x >>>= 8;
    }
  }
  return h >>> 0;
}

/* ─────────────────────────── Manipulación: exacta y heurística ─────────────────────────── */

/**
 * Algoritmo 2.1 + DP en una pasada (a[k], b[k] del k-ésimo cliente del tour, k = 1..n; índice 0 sin uso).
 *   p_ij: Política 1 en i+1..j−1 y Política 2 en j;  f(n) = 0;  f(i) = min_{j>i} {p_ij + f(j)}.
 * Devuelve f(0). `f` es un búfer de largo ≥ n+1.
 */
export function exactHandling(a, b, n, ha, hb, f) {
  f[n] = 0;
  let aRem = 0; // Σ_{j>i} a_j: entregas a bordo tras atender al cliente i
  for (let i = n - 1; i >= 0; i--) {
    aRem += a[i + 1];
    let ap = aRem; // a'
    let bp = 0; // b' (recogidas en la compuerta desde la última Política 2)
    let y = 0; // costo acumulado de la Política 1
    let best = Infinity;
    for (let j = i + 1; j <= n; j++) {
      if (y >= best) break; // p_ij ≥ y y f(j) ≥ 0: ningún j posterior mejora f(i)
      ap -= a[j];
      const bj = b[j];
      const v = (bp + bj > 0 ? y + ha * ap + hb * bp : y) + f[j];
      if (v < best) best = v;
      if (a[j] > 0) y += hb * bp;
      bp += bj;
    }
    f[i] = best;
  }
  return f[0];
}

/**
 * Umbral de la heurística lineal (§2.2) para el subproblema que empieza tras la posición i: con
 * ᾱ = Σ_{j>i} α_j/(n−i) y β̄ = Σ_{j>i} β_j/(n−i), p* de la Ec. (14) (redondeado hacia abajo, ≥ 1,
 * para respetar k_p ≥ 1) y k*_1 de la Ec. (13); el umbral es la cantidad de recogidas a bordo en la
 * primera aplicación de la Política 2 en el caso especial: β̄ · k*_1.
 */
export function heuristicThreshold(sumA, sumB, m, ha, hb) {
  if (m <= 0 || sumA <= 0 || sumB <= 0) return Infinity; // sin entregas o sin recogidas: nunca conviene P2
  const abar = sumA / m;
  const bbar = sumB / m;
  const r = (hb * bbar) / (ha * abar);
  const pStar = (1 - 2 * r + Math.sqrt((2 * r - 1) * (2 * r - 1) + 8 * m * r)) / 2;
  const p = Math.max(1, Math.min(m, Math.floor(pStar + 1e-12)));
  const k1 = (p - 1) / (2 * r) + m / p;
  return bbar * k1;
}

/**
 * Heurística lineal O(n) de §2.2. Recorre el tour: en cada cliente k (tras entregar) se aplica la
 * Política 2 cuando las recogidas en la compuerta más las de k alcanzan el umbral; si no, Política 1.
 * El costo se simula con las mismas reglas que la DP (es una cota superior del óptimo).
 * `sa`, `sb` son búferes de largo ≥ n+2 para las sumas de sufijo; si se pasa `policy` (largo ≥ n+1)
 * se anota en policy[k] la política elegida en cada posición.
 */
export function heuristicHandling(a, b, n, ha, hb, sa, sb, policy = null) {
  sa[n + 1] = 0;
  sb[n + 1] = 0;
  for (let k = n; k >= 1; k--) {
    sa[k] = sa[k + 1] + a[k];
    sb[k] = sb[k + 1] + b[k];
  }
  let aOn = sa[1];
  let bDoor = 0;
  let cost = 0;
  let thr = heuristicThreshold(sa[1], sb[1], n, ha, hb);
  for (let k = 1; k <= n; k++) {
    aOn -= a[k];
    const onBoard = bDoor + b[k];
    if (onBoard > 0 && onBoard >= thr) {
      // Política 2: las recogidas de la compuerta y las α remanentes se descargan y se reordenan
      cost += hb * bDoor + ha * aOn;
      bDoor = 0;
      thr = heuristicThreshold(sa[k + 1], sb[k + 1], n - k, ha, hb);
      if (policy) policy[k] = 2;
    } else {
      // Política 1: si hay entrega, las recogidas de la compuerta obstruyen
      if (a[k] > 0) cost += hb * bDoor;
      bDoor = onBoard;
      if (policy) policy[k] = 1;
    }
  }
  return cost;
}

/**
 * Simulación física de una asignación de políticas (policy[k] ∈ {1, 2}, k = 1..n): misma
 * convención que simulate_policies de notebooks/tsppd_h_alg21_dp.py. Solo para verificación.
 */
export function simulatePolicies(a, b, n, ha, hb, policy) {
  let aOn = 0;
  for (let k = 1; k <= n; k++) aOn += a[k];
  let bRear = 0;
  let total = 0;
  for (let k = 1; k <= n; k++) {
    aOn -= a[k];
    if (policy[k] === 1) {
      if (a[k] > 0) total += hb * bRear;
      bRear += b[k];
    } else {
      if (bRear + b[k] > 0) total += hb * bRear + ha * aOn;
      bRear = 0;
    }
  }
  return total;
}

/* ─────────────────────────── Movimientos (posiciones 0-based, sin el depósito) ─────────────────────────── */

/** Relocate (1-opt): saca al cliente de la posición i y lo reinserta en la posición p de la lista reducida. */
export function applyRelocate(perm, i, p) {
  const v = perm[i];
  if (p > i) for (let k = i; k < p; k++) perm[k] = perm[k + 1];
  else for (let k = i; k > p; k--) perm[k] = perm[k - 1];
  perm[p] = v;
}

/** 2-opt: invierte la cadena de clientes entre las posiciones i y j (i < j). */
export function applyTwoOpt(perm, i, j) {
  while (i < j) {
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
    i++;
    j--;
  }
}

/* ─────────────────────────── Evaluador ─────────────────────────── */

export class Evaluator {
  constructor(inst) {
    const n = inst.n;
    this.n = n;
    this.V = inst.V;
    this.c = inst.c;
    this.alpha = inst.alpha;
    this.beta = inst.beta;
    this.Q = inst.Q;
    this.ha = inst.ha;
    this.hb = inst.hb;
    this.sumAlpha = inst.sumAlpha;
    this.a = new Float64Array(n + 2);
    this.b = new Float64Array(n + 2);
    this.f = new Float64Array(n + 2);
    this.sa = new Float64Array(n + 2);
    this.sb = new Float64Array(n + 2);
    this.cand = new Int32Array(n);
    this.tmp = new Int32Array(n);
    this.resetStats();
  }

  resetStats() {
    /** exact/heuristic: evaluaciones de manipulación; scanned: vecinos recorridos; pruned: descartados por la cota. */
    this.stats = { exact: 0, heuristic: 0, scanned: 0, pruned: 0, infeasible: 0 };
  }

  routing(perm) {
    const { c, V } = this;
    const n = perm.length;
    let r = c[perm[0]] + c[perm[n - 1] * V];
    for (let k = 0; k < n - 1; k++) r += c[perm[k] * V + perm[k + 1]];
    return r;
  }

  feasible(perm) {
    const { alpha, beta, Q } = this;
    let load = this.sumAlpha;
    if (load > Q) return false;
    for (let k = 0; k < perm.length; k++) {
      const v = perm[k];
      load += beta[v] - alpha[v];
      if (load > Q) return false;
    }
    return true;
  }

  /** Copia α y β del tour a this.a/this.b (1-based) y comprueba la capacidad en el camino. */
  load(perm) {
    const { alpha, beta, Q, a, b } = this;
    let load = this.sumAlpha;
    let ok = load <= Q;
    for (let k = 0; k < perm.length; k++) {
      const v = perm[k];
      a[k + 1] = alpha[v];
      b[k + 1] = beta[v];
      load += beta[v] - alpha[v];
      if (load > Q) ok = false;
    }
    return ok;
  }

  /** Manipulación del tour cargado con load(): 'exact' (Alg. 2.1 + DP) o 'heuristic' (§2.2). */
  handlingLoaded(mode) {
    if (mode === 'exact') {
      this.stats.exact++;
      return exactHandling(this.a, this.b, this.n, this.ha, this.hb, this.f);
    }
    this.stats.heuristic++;
    return heuristicHandling(this.a, this.b, this.n, this.ha, this.hb, this.sa, this.sb);
  }

  exactHandling(perm) {
    this.load(perm);
    return this.handlingLoaded('exact');
  }

  heuristicHandling(perm) {
    this.load(perm);
    return this.handlingLoaded('heuristic');
  }

  /** Costo exacto Z = ruteo + manipulación óptima de la Política 3. */
  exactTotal(perm) {
    return this.routing(perm) + this.exactHandling(perm);
  }

  /**
   * Carga el candidato en this.a/this.b sin construir otro arreglo: cand = perm con el movimiento
   * aplicado. Devuelve false si viola la capacidad (corta en cuanto la excede).
   */
  loadMove(perm, kind, i, j) {
    const { alpha, beta, Q, a, b } = this;
    const n = this.n;
    let load = this.sumAlpha;
    let pos = 1;
    const put = (v) => {
      a[pos] = alpha[v];
      b[pos] = beta[v];
      pos++;
      load += beta[v] - alpha[v];
      return load <= Q;
    };
    if (kind === 0) {
      // relocate i → p (= j)
      const v = perm[i];
      const p = j;
      if (p > i) {
        for (let k = 0; k < i; k++) if (!put(perm[k])) return false;
        for (let k = i + 1; k <= p; k++) if (!put(perm[k])) return false;
        if (!put(v)) return false;
        for (let k = p + 1; k < n; k++) if (!put(perm[k])) return false;
      } else {
        for (let k = 0; k < p; k++) if (!put(perm[k])) return false;
        if (!put(v)) return false;
        for (let k = p; k < i; k++) if (!put(perm[k])) return false;
        for (let k = i + 1; k < n; k++) if (!put(perm[k])) return false;
      }
    } else {
      for (let k = 0; k < i; k++) if (!put(perm[k])) return false;
      for (let k = j; k >= i; k--) if (!put(perm[k])) return false;
      for (let k = j + 1; k < n; k++) if (!put(perm[k])) return false;
    }
    return true;
  }

  /**
   * Mejor movimiento relocate y mejor 2-opt factibles según `mode` (Find Best … Move de los
   * Algoritmos 4.1/4.2). Con `tabu`, un movimiento tabú solo entra si su costo mejora `aspiration`
   * (costCurrent). Devuelve el elegido con la regla «if cost1 < cost2 relocate, else 2-opt», o null.
   * cost es el costo según `mode` (exacto o estimado).
   */
  bestMove(perm, mode, tabu = null, aspiration = -Infinity) {
    const { c, V } = this;
    const n = this.n;
    const st = this.stats;
    const R = this.routing(perm);

    // ── relocate ──
    let cost1 = Infinity;
    let ri = -1;
    let rp = -1;
    for (let i = 0; i < n; i++) {
      const v = perm[i];
      const isTabu = tabu !== null && tabu.has(tabu.relocateKey(v));
      if (isTabu && aspiration === -Infinity) {
        st.scanned += n - 1;
        continue;
      }
      const prev = i > 0 ? perm[i - 1] : 0;
      const next = i < n - 1 ? perm[i + 1] : 0;
      const removal = c[prev * V + next] - c[prev * V + v] - c[v * V + next];
      const vRow = v * V;
      for (let p = 0; p < n; p++) {
        if (p === i) continue;
        st.scanned++;
        // vecinos del punto de inserción en la lista reducida (sin la posición i)
        const x = p > 0 ? perm[p - 1 < i ? p - 1 : p] : 0;
        const y = p < n - 1 ? perm[p < i ? p : p + 1] : 0;
        const rn = R + removal + c[x * V + v] + c[vRow + y] - c[x * V + y];
        const bound = isTabu ? Math.min(cost1, aspiration) : cost1;
        if (rn >= bound - EPS) {
          st.pruned++;
          continue;
        }
        if (!this.loadMove(perm, 0, i, p)) {
          st.infeasible++;
          continue;
        }
        const cost = rn + this.handlingLoaded(mode);
        if (cost < bound - EPS) {
          cost1 = cost;
          ri = i;
          rp = p;
        }
      }
    }

    // ── 2-opt (los empates con el mejor relocate se quedan con el 2-opt) ──
    let cost2 = Infinity;
    let ti = -1;
    let tj = -1;
    const tieCap = cost1 + 2 * EPS;
    for (let i = 0; i < n - 1; i++) {
      const prev = i > 0 ? perm[i - 1] : 0;
      const pi = perm[i];
      const base = R - c[prev * V + pi];
      for (let j = i + 1; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // invertir todo quita dos aristas consecutivas: no es un 2-opt
        st.scanned++;
        const pj = perm[j];
        const next = j < n - 1 ? perm[j + 1] : 0;
        const rn = base - c[pj * V + next] + c[prev * V + pj] + c[pi * V + next];
        let bound = cost2 < tieCap ? cost2 : tieCap;
        if (tabu !== null && tabu.has(tabu.twoOptKey(i, j))) bound = Math.min(bound, aspiration);
        if (rn >= bound - EPS) {
          st.pruned++;
          continue;
        }
        if (!this.loadMove(perm, 1, i, j)) {
          st.infeasible++;
          continue;
        }
        const cost = rn + this.handlingLoaded(mode);
        if (cost < bound - EPS) {
          cost2 = cost;
          ti = i;
          tj = j;
        }
      }
    }

    if (ti >= 0) return { kind: '2opt', i: ti, j: tj, cost: cost2 };
    if (ri >= 0) return { kind: 'relocate', i: ri, j: rp, cost: cost1 };
    return null;
  }
}

/** Aplica in situ el movimiento devuelto por bestMove. */
export function applyMove(perm, move) {
  if (move.kind === 'relocate') applyRelocate(perm, move.i, move.j);
  else applyTwoOpt(perm, move.i, move.j);
}

/** Deshace applyMove (relocate i→p se deshace con p→i; el 2-opt es su propio inverso). */
export function undoMove(perm, move) {
  if (move.kind === 'relocate') applyRelocate(perm, move.j, move.i);
  else applyTwoOpt(perm, move.i, move.j);
}

/* ─────────────────────────── Lista tabú ─────────────────────────── */

export class TabuList {
  constructor(length, n) {
    this.length = Math.max(1, length);
    this.n = n;
    this.queue = [];
    this.counts = new Int32Array((n + 2) * (n + 1) + 2);
  }
  /** Entrada (v, v): reubicar al cliente v es tabú. Claves 1..n. */
  relocateKey(v) {
    return v;
  }
  /** Entrada (i, j): el 2-opt entre las posiciones i y j es tabú. Claves > n. */
  twoOptKey(i, j) {
    return this.n + 1 + i * (this.n + 1) + j;
  }
  has(key) {
    return this.counts[key] > 0;
  }
  add(key) {
    this.queue.push(key);
    this.counts[key]++;
    if (this.queue.length > this.length) this.counts[this.queue.shift()]--;
  }
}

/* ─────────────────────────── Diversificación aleatoria (Algoritmos 4.2 y 4.3) ─────────────────────────── */

/**
 * i, j ~ U{1..|Vc|}; si i = j se reubica el cliente de la posición i en p ≠ i; si no, se invierte la
 * cadena entre i y j. Un movimiento infactible se descarta y se sortea otro (máx. 100 intentos).
 */
export function randomMove(ev, tour, rng) {
  const n = tour.length;
  const cand = ev.tmp;
  for (let t = 0; t < MAX_RANDOM_TRIES; t++) {
    const i = rng.int(1, n);
    const j = rng.int(1, n);
    cand.set(tour);
    if (i === j) {
      let p = rng.int(1, n - 1);
      if (p >= i) p++;
      applyRelocate(cand, i - 1, p - 1);
    } else {
      applyTwoOpt(cand, Math.min(i, j) - 1, Math.max(i, j) - 1);
    }
    if (ev.feasible(cand)) {
      tour.set(cand);
      return true;
    }
  }
  return false;
}

/* ─────────────────────────── ILS — Algoritmo 4.2 ─────────────────────────── */

/**
 * ILS(Niter, Nrand, Tour). Búsqueda local: «while (improvement) costNew ← Perform Best Move(Tour)».
 * Con evaluación heurística el mejor movimiento (según la estimación) se re-evalúa con la DP y solo se
 * aplica si mejora de verdad; si no, la búsqueda local termina.
 *
 * `lsRule` fija qué debe mejorar el movimiento («improvement» no está definido en el pseudo-código):
 *   · 'incumbent' (por defecto): el costo costCurrent de la mejor solución conocida. Es la lectura que
 *     reproduce el paper: su ILS exacto nunca mejora la solución inicial con |Vc| ≥ 60 (Tablas 8–9) y
 *     su tiempo por iteración equivale a un par de barridos del vecindario (Tabla 2: ILS ≈ 2 × TS).
 *   · 'descent': el costo del tour perturbado (descenso completo hasta un óptimo local). Mucho más
 *     fuerte y caro (~48 barridos por iteración con |Vc| = 200); es la que usa tsppd_h_alg42_ils.py.
 */
export function ils(ev, perm0, { mode, nIter, nRand, rng, lsRule = 'incumbent' }) {
  const n = perm0.length;
  let costCurrent = ev.exactTotal(perm0);
  const best = Int32Array.from(perm0);
  const tour = new Int32Array(n);
  const history = [];
  const localOptima = [];
  let bestIteration = 0;
  let improvements = 0;
  let lsMoves = 0;
  let rejectedMoves = 0;
  let discarded = 0;
  for (let it = 1; it <= nIter; it++) {
    tour.set(best);
    for (let r = 0; r < nRand; r++) if (!randomMove(ev, tour, rng)) discarded++;
    let cost = ev.exactTotal(tour);
    for (;;) {
      const move = ev.bestMove(tour, mode);
      if (move === null) break;
      // 'descent': el movimiento debe mejorar el tour actual; 'incumbent': debe mejorar costCurrent
      const target = lsRule === 'descent' ? cost : Math.min(cost, costCurrent);
      if (mode === 'exact') {
        if (move.cost >= target - EPS) break;
        applyMove(tour, move);
        cost = move.cost;
      } else {
        applyMove(tour, move);
        const exact = ev.exactTotal(tour);
        if (exact >= target - EPS) {
          undoMove(tour, move);
          rejectedMoves++;
          break;
        }
        cost = exact;
      }
      lsMoves++;
    }
    if (cost < costCurrent - EPS) {
      costCurrent = cost;
      best.set(tour);
      bestIteration = it;
      improvements++;
    }
    history.push(round6(costCurrent));
    localOptima.push(round6(cost));
  }
  return { perm: best, cost: costCurrent, history, localOptima, bestIteration, improvements, lsMoves, rejectedMoves, discarded };
}

/* ─────────────────────────── TS — Algoritmo 4.1 ─────────────────────────── */

/**
 * TS(Niter, Tour): en cada iteración se aplica el mejor movimiento no tabú (relocate o 2-opt, aunque
 * empeore) y se actualiza la lista tabú; el número de iteraciones no se reinicia al mejorar. Devuelve el
 * mejor tour visitado. Con evaluación heurística, costCurrent es el costo exacto del tour tras el
 * movimiento («el mejor movimiento se re-evalúa con la DP», §4).
 */
export function tabuSearch(ev, perm0, cost0, { mode, nIter, tabuLength }) {
  const n = perm0.length;
  const perm = Int32Array.from(perm0);
  let costCurrent = cost0;
  const best = Int32Array.from(perm0);
  let bestCost = cost0;
  const tabu = new TabuList(tabuLength, n);
  let moves = 0;
  let bestIteration = 0;
  for (let it = 1; it <= nIter; it++) {
    const move = ev.bestMove(perm, mode, tabu, costCurrent);
    if (move === null) break;
    if (move.kind === 'relocate') {
      const v = perm[move.i];
      applyRelocate(perm, move.i, move.j);
      tabu.add(tabu.relocateKey(v));
    } else {
      applyTwoOpt(perm, move.i, move.j);
      tabu.add(tabu.twoOptKey(move.i, move.j));
    }
    costCurrent = mode === 'exact' ? move.cost : ev.exactTotal(perm);
    moves++;
    if (costCurrent < bestCost - EPS) {
      bestCost = costCurrent;
      best.set(perm);
      bestIteration = it;
    }
  }
  return { perm: best, cost: bestCost, moves, bestIteration };
}

/* ─────────────────────────── ITS — Algoritmo 4.3 ─────────────────────────── */

/**
 * ITS(N*iter, Nrand, Tour): misma diversificación que el ILS; el tour diversificado se mejora con
 * TS(N*iter). N*iter = ⌊√Niter⌋ se usa para las iteraciones externas y para las del TS interno.
 */
export function its(ev, perm0, { mode, nIter, nRand, tabuLength, rng }) {
  const n = perm0.length;
  let costCurrent = ev.exactTotal(perm0);
  const best = Int32Array.from(perm0);
  const tour = new Int32Array(n);
  const history = [];
  const localOptima = [];
  let bestIteration = 0;
  let improvements = 0;
  let tsMoves = 0;
  let discarded = 0;
  for (let it = 1; it <= nIter; it++) {
    tour.set(best);
    for (let r = 0; r < nRand; r++) if (!randomMove(ev, tour, rng)) discarded++;
    const ts = tabuSearch(ev, tour, ev.exactTotal(tour), { mode, nIter, tabuLength });
    tsMoves += ts.moves;
    if (ts.cost < costCurrent - EPS) {
      costCurrent = ts.cost;
      best.set(ts.perm);
      bestIteration = it;
      improvements++;
    }
    history.push(round6(costCurrent));
    localOptima.push(round6(ts.cost));
  }
  return { perm: best, cost: costCurrent, history, localOptima, bestIteration, improvements, lsMoves: tsMoves, discarded };
}

/* ─────────────────────────── Dos fases: TSP + reubicación del depósito ─────────────────────────── */

/**
 * Mosheiov (1994): mover el depósito a lo largo del ciclo TSP produce al menos un tour factible.
 * Poner el depósito antes del k-ésimo cliente del ciclo da la secuencia cycle[k:] + cycle[:k];
 * se elige la factible de menor ruteo + manipulación óptima (empate: menor k).
 */
export function relocateDepot(ev, cycle) {
  const n = cycle.length;
  const perm = new Int32Array(n);
  let best = null;
  let feasibleShifts = 0;
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) perm[t] = cycle[(k + t) % n];
    if (!ev.feasible(perm)) continue;
    feasibleShifts++;
    const routing = ev.routing(perm);
    const handling = ev.exactHandling(perm);
    const cost = routing + handling;
    if (best === null || cost < best.cost - EPS) best = { perm: Int32Array.from(perm), shift: k, routing, handling, cost };
  }
  if (best === null) throw new Error('Ninguna posición del depósito es factible (¿Q < max{Σα, Σβ}?)');
  return { ...best, feasibleShifts };
}

/* ─────────────────────────── TSP: 2-opt + Or-opt iterado (sustituto de Lin–Kernighan) ─────────────────────────── */

/**
 * Ciclo TSP por el depósito y los clientes. Búsqueda local 2-opt + Or-opt (segmentos de 1 a 3, en
 * ambos sentidos) de primera mejora con listas de vecinos ordenadas, iterada con perturbaciones
 * double-bridge: se acepta el nuevo óptimo local si no empeora. Se hacen `restarts` corridas
 * independientes y se conserva la más corta (empate: la primera). Devuelve [0, c1, …, cn] y su largo.
 */
export function solveTsp(inst, { kicks = 3000, restarts = 1, seed = 1 } = {}) {
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const run = solveTspOnce(inst, { kicks, seed: seedOf(seed, r) });
    if (best === null || run.length < best.length - EPS) best = { ...run, restart: r };
  }
  return { ...best, restarts, kicks };
}

/** Una corrida independiente de solveTsp (búsqueda local + `kicks` perturbaciones double-bridge). */
function solveTspOnce(inst, { kicks, seed }) {
  const { c, V } = inst;
  const rng = makeRng(seed);
  const d = (u, v) => c[u * V + v];
  // vecinos de cada nodo ordenados por distancia
  const neigh = [];
  for (let u = 0; u < V; u++) {
    const list = [];
    for (let v = 0; v < V; v++) if (v !== u) list.push(v);
    list.sort((x, y) => d(u, x) - d(u, y) || x - y);
    neigh.push(Int32Array.from(list));
  }

  // tour inicial: vecino más cercano desde el depósito
  let tour = new Int32Array(V);
  {
    const used = new Uint8Array(V);
    tour[0] = 0;
    used[0] = 1;
    for (let k = 1; k < V; k++) {
      const u = tour[k - 1];
      let pick = -1;
      for (const v of neigh[u]) {
        if (!used[v]) {
          pick = v;
          break;
        }
      }
      tour[k] = pick;
      used[pick] = 1;
    }
  }

  const pos = new Int32Array(V);
  const setPos = (t) => {
    for (let k = 0; k < V; k++) pos[t[k]] = k;
  };
  const length = (t) => {
    let s = d(t[V - 1], t[0]);
    for (let k = 0; k < V - 1; k++) s += d(t[k], t[k + 1]);
    return s;
  };
  const succ = (t, k) => t[(k + 1) % V];
  const pred = (t, k) => t[(k - 1 + V) % V];

  /** Invierte el tramo de posiciones a..b (cíclico, a→b hacia adelante). */
  const reverse = (t, a, b) => {
    let len = (b - a + V) % V + 1;
    let i = a;
    let j = b;
    for (let s = 0; s < (len >> 1); s++) {
      const x = t[i];
      t[i] = t[j];
      t[j] = x;
      pos[t[i]] = i;
      pos[t[j]] = j;
      i = (i + 1) % V;
      j = (j - 1 + V) % V;
    }
  };

  const twoOptPass = (t) => {
    let improved = false;
    for (let k = 0; k < V; k++) {
      const a = t[k];
      const sa = succ(t, k);
      const dA = d(a, sa);
      for (const b of neigh[a]) {
        const g1 = dA - d(a, b);
        if (g1 <= EPS) break;
        const kb = pos[b];
        const sb = succ(t, kb);
        if (b === sa || sb === a) continue;
        const gain = g1 + d(b, sb) - d(sa, sb);
        if (gain > EPS) {
          // reemplaza (a,sa),(b,sb) por (a,b),(sa,sb): invertir sa..b
          reverse(t, (k + 1) % V, kb);
          improved = true;
          break;
        }
      }
      // sentido contrario: (pa, a) y (pb, b)
      const ka = pos[a];
      const pa = pred(t, ka);
      const dP = d(pa, a);
      for (const b of neigh[a]) {
        const g1 = dP - d(a, b);
        if (g1 <= EPS) break;
        const kb = pos[b];
        const pb = pred(t, kb);
        if (b === pa || pb === a) continue;
        const gain = g1 + d(pb, b) - d(pa, pb);
        if (gain > EPS) {
          // reemplaza (pa,a),(pb,b) por (a,b),(pa,pb): invertir a..pb
          reverse(t, pos[a], pos[pb]);
          improved = true;
          break;
        }
      }
    }
    return improved;
  };

  /** Or-opt: mover un segmento de 1–3 nodos (en cualquier sentido) entre dos nodos consecutivos. */
  const orOptPass = (t) => {
    let improved = false;
    for (let segLen = 1; segLen <= 3; segLen++) {
      for (let k = 0; k < V; k++) {
        const s1 = t[k];
        const ke = (k + segLen - 1) % V;
        const s2 = t[ke];
        const p = pred(t, k);
        const nx = succ(t, ke);
        if (segLen >= V - 2) continue;
        const removeGain = d(p, s1) + d(s2, nx) - d(p, nx);
        if (removeGain <= EPS) continue;
        let done = false;
        for (const end of [s1, s2]) {
          for (const b of neigh[end]) {
            if (d(end, b) >= removeGain - EPS) break;
            // b no puede estar dentro del segmento
            const kb = pos[b];
            const off = (kb - k + V) % V;
            if (off < segLen) continue;
            for (const side of [0, 1]) {
              // insertar entre (b, succ b) o (pred b, b)
              const u = side === 0 ? b : pred(t, kb);
              const w = side === 0 ? succ(t, kb) : b;
              if (u === s2 || w === s1 || (u === p && w === nx)) continue;
              const offU = (pos[u] - k + V) % V;
              const offW = (pos[w] - k + V) % V;
              if (offU < segLen || offW < segLen) continue;
              const fwd = d(u, s1) + d(s2, w) - d(u, w);
              const bwd = d(u, s2) + d(s1, w) - d(u, w);
              const add = Math.min(fwd, bwd);
              if (removeGain - add > EPS) {
                moveSegment(t, k, segLen, u, bwd < fwd);
                improved = true;
                done = true;
                break;
              }
            }
            if (done) break;
          }
          if (done) break;
        }
      }
    }
    return improved;
  };

  /** Saca el segmento de largo len que empieza en la posición k y lo inserta tras el nodo u (invertido si rev). */
  const moveSegment = (t, k, len, u, rev) => {
    const seg = [];
    for (let s = 0; s < len; s++) seg.push(t[(k + s) % V]);
    if (rev) seg.reverse();
    const rest = [];
    for (let s = 0; s < V - len; s++) rest.push(t[(k + len + s) % V]);
    const out = [];
    for (const v of rest) {
      out.push(v);
      if (v === u) for (const x of seg) out.push(x);
    }
    for (let s = 0; s < V; s++) t[s] = out[s];
    setPos(t);
  };

  const localSearch = (t) => {
    setPos(t);
    for (let guard = 0; guard < 10000; guard++) {
      const a = twoOptPass(t);
      const b = orOptPass(t);
      if (!a && !b) return;
    }
  };

  const doubleBridge = (t) => {
    // tres cortes al azar → A B C D pasa a A C B D
    const cuts = [];
    while (cuts.length < 3) {
      const x = rng.int(1, V - 1);
      if (!cuts.includes(x)) cuts.push(x);
    }
    cuts.sort((x, y) => x - y);
    const [p1, p2, p3] = cuts;
    const out = new Int32Array(V);
    let o = 0;
    for (let s = 0; s < p1; s++) out[o++] = t[s];
    for (let s = p2; s < p3; s++) out[o++] = t[s];
    for (let s = p1; s < p2; s++) out[o++] = t[s];
    for (let s = p3; s < V; s++) out[o++] = t[s];
    return out;
  };

  localSearch(tour);
  let bestLen = length(tour);
  let best = Int32Array.from(tour);
  if (V >= 8) {
    for (let it = 0; it < kicks; it++) {
      const cand = doubleBridge(best);
      localSearch(cand);
      const L = length(cand);
      if (L <= bestLen + EPS) {
        bestLen = L;
        best = cand;
      }
    }
  }
  // rotar para que el depósito quede primero
  const k0 = best.indexOf(0);
  const out = new Int32Array(V);
  for (let s = 0; s < V; s++) out[s] = best[(k0 + s) % V];
  return { tour: Array.from(out), length: bestLen };
}

export function round6(x) {
  return Math.round(x * 1e6) / 1e6;
}

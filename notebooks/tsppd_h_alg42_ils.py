"""
Iterated Local Search (ILS) para el TSPPD-H bajo la Política 3.

Referencia:
    Erdoğan, G., Battarra, M., Laporte, G. & Vigo, D. (2012).
    "Metaheuristics for the traveling salesman problem with pickups, deliveries
    and handling costs". Computers & Operations Research, 39, 1074–1086.
    Sección 4.2, Algoritmo 4.2 (papers/Erdogan2012.pdf).

Algoritmo 4.2  ILS(Niter, Nrand, Tour)
    costCurrent ← CostOfInitialTour
    bestTour ← Tour
    for it ← 1 to Niter
        Tour ← bestTour
        for r ← 1 to Nrand                      // diversificación aleatoria
            i, j ← RandomNumber(1, ..., |Vc|)
            if (i = j)
                p ← RandomNumber(1, ..., |Vc|, p ≠ i)
                1OPT(Tour, i, p)                // reubicar el cliente de la posición i en p
            else
                2OPT(Tour, i, j)                // invertir la cadena entre las posiciones i y j
        while (improvement)
            costNew ← Perform Best Move(Tour)   // mejor movimiento relocate o 2-opt factible
        if (costNew < costCurrent)
            costCurrent ← costNew
            bestTour ← Tour

El costo de cada tour es ruteo + manipulación óptima bajo Política 3, calculada
con el Algoritmo 2.1 + DP (evaluación exacta del vecindario, tsppd_h_alg21_dp.py).

Decisiones de implementación (el paper no las fija o usa software externo):
  · Tour TSP inicial: el paper usa Lin–Kernighan de Concorde. Aquí, con n ≤ 12
    clientes se usa Held-Karp (TSP óptimo exacto); para n mayores, vecino más
    cercano + búsqueda local 2-opt/relocate sobre el ruteo.
  · Reubicación del depósito (Mosheiov, 1994): entre las n posiciones del
    depósito en el ciclo TSP se elige la factible de menor ruteo + manipulación.
  · Dos direcciones (ILS-2dir): se ejecuta el ILS desde el ciclo TSP y desde su
    inverso y se reporta el mejor; ILS-1dir es la primera ejecución.
  · Solo se consideran movimientos que producen tours factibles (capacidad Q),
    también en la diversificación: un movimiento aleatorio infactible se descarta
    y se sortea otro (máx. 100 intentos por movimiento).
  · Parámetros del paper: Niter = 200 y Nrand = d·|Vc| con d = 10 %
    (redondeado al entero más cercano, mitades hacia arriba, con mínimo 1:
    con 5 ó 10 clientes vale 1).
  · Corridas: por defecto 10, con semillas SEED, SEED+1, ... para medir la
    robustez. Se reporta la mejor (menor Z de ILS-2dir; ante empate, la de
    menor semilla) con su traza; las demás solo alimentan runsSummary.
  · En Perform Best Move se descarta un vecino sin llamar a la DP cuando su
    ruteo ya iguala o supera al mejor costo del vecindario (la manipulación es
    ≥ 0): el movimiento elegido es idéntico al de evaluar todo el vecindario.

Uso:
    python notebooks/tsppd_h_alg42_ils.py                         # 5 clientes, ID 1
    python notebooks/tsppd_h_alg42_ils.py --customers 10 --id 3
    python notebooks/tsppd_h_alg42_ils.py --customers 5 10 --all-ids --runs 10
    python notebooks/tsppd_h_alg42_ils.py --customers 10 --id 3 --iters 50 --seed 7

Cada instancia se guarda en Outputs/Erdogan2012/ILS_<n>_Clientes_ID<id>_H_<h>.json
(lo lee la Página Web 12 junto con las soluciones Gurobi de Outputs/).
"""
import os
import sys
import math
import json
import time
import random
import argparse
from datetime import datetime, timezone

from tsppd_h_alg21_dp import (
    EPS,
    PAPER_REF,
    RESULTS_DIR,
    evaluate_tour,
    format_tour,
    h_tag,
    load_gurobi_solutions,
    load_instance,
    solve_handling,
)

# Asegurar codificación UTF-8 en stdout y stderr para Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# =====================================================================
# CONFIGURACIÓN DE PARÁMETROS DE EJECUCIÓN
# =====================================================================
NUM_CUSTOMERS = 5      # Número de clientes a resolver (e.g. 5, 10)
INSTANCE_ID = 1        # ID de la instancia de datos (1 a 10)
H_VALUE = 0.1          # Costo unitario de manipulación h = h_a = h_b (default: 0.1)
N_ITER = 200           # Niter: iteraciones del ILS por dirección (§5 del paper)
D_RATIO = 0.10         # d: Nrand = d·|Vc| movimientos aleatorios por iteración (§4.2)
SEED = 1               # Semilla de la primera corrida (las siguientes usan SEED+1, SEED+2, ...)
RUNS = 10              # Corridas independientes (semillas distintas) para medir la robustez
HELD_KARP_MAX = 12     # Hasta este número de clientes el tour TSP inicial es exacto
MAX_RANDOM_TRIES = 100 # Intentos para sortear un movimiento aleatorio factible
# =====================================================================


class Evaluator:
    """Costo exacto de una secuencia de clientes: ruteo + manipulación óptima (Algoritmo 2.1 + DP)."""

    def __init__(self, inst, h_a, h_b):
        self.c = inst["c"]
        self.alpha = inst["alpha"]
        self.beta = inst["beta"]
        self.Q = inst["Q"]
        self.h_a = h_a
        self.h_b = h_b
        self.total_alpha = sum(inst["alpha"])
        self.dp_calls = 0
        self.neighbors = 0

    def routing(self, perm):
        c = self.c
        cost = c[0][perm[0]] + c[perm[-1]][0]
        for k in range(len(perm) - 1):
            cost += c[perm[k]][perm[k + 1]]
        return cost

    def feasible(self, perm):
        load = self.total_alpha
        for v in perm:
            load += self.beta[v] - self.alpha[v]
            if load > self.Q:
                return False
        return True

    def handling(self, perm):
        self.dp_calls += 1
        a = [0] + [self.alpha[v] for v in perm]
        b = [0] + [self.beta[v] for v in perm]
        return solve_handling(a, b, self.h_a, self.h_b)[0]

    def total(self, perm):
        return self.routing(perm) + self.handling(perm)


# =====================================================================
# MOVIMIENTOS (posiciones 0-based sobre la secuencia de clientes, sin el depósito)
# =====================================================================
def relocate(perm, i, p):
    """1-opt: saca al cliente de la posición i y lo reinserta en la posición p."""
    cand = perm[:i] + perm[i + 1:]
    cand.insert(p, perm[i])
    return cand


def two_opt(perm, i, j):
    """2-opt: invierte la cadena de clientes entre las posiciones i y j (i < j)."""
    return perm[:i] + perm[i:j + 1][::-1] + perm[j + 1:]


def neighborhood(perm):
    """
    Vecindario relocate + 2-opt de §3: |Vc|(|Vc|−1) reubicaciones y
    (|Vc|+1)(|Vc|−2)/2 movimientos 2-opt (pares de aristas no consecutivas).
    Invertir toda la secuencia quitaría las dos aristas del depósito, que son
    consecutivas, por lo que ese caso no es un 2-opt.
    """
    n = len(perm)
    for i in range(n):
        for p in range(n):
            if p != i:
                yield "relocate", i, p, relocate(perm, i, p)
    for i in range(n - 1):
        for j in range(i + 1, n):
            if not (i == 0 and j == n - 1):
                yield "2opt", i, j, two_opt(perm, i, j)


def perform_best_move(perm, ev):
    """Mejor vecino factible según el costo exacto; devuelve (movimiento, costo) o (None, inf)."""
    best_cost = math.inf
    best = None
    for kind, i, j, cand in neighborhood(perm):
        ev.neighbors += 1
        r = ev.routing(cand)
        if r >= best_cost - EPS:          # cota inferior: la manipulación es ≥ 0
            continue
        if not ev.feasible(cand):
            continue
        cost = r + ev.handling(cand)
        if cost < best_cost - EPS:
            best_cost = cost
            best = (kind, i, j, cand)
    return best, best_cost


def local_search(perm, cost, ev):
    """while (improvement): aplica el mejor movimiento mientras mejore el tour actual."""
    moves = 0
    while True:
        move, new_cost = perform_best_move(perm, ev)
        if move is None or new_cost >= cost - EPS:
            return perm, cost, moves
        perm, cost = move[3], new_cost
        moves += 1


def random_move(perm, rng, ev):
    """
    Un movimiento de la diversificación: i, j al azar en 1..|Vc|; si i = j se
    reubica el cliente i en una posición p ≠ i, si no se invierte la cadena i..j.
    """
    n = len(perm)
    for _ in range(MAX_RANDOM_TRIES):
        i = rng.randint(1, n)
        j = rng.randint(1, n)
        if i == j:
            p = rng.randint(1, n - 1)
            if p >= i:
                p += 1
            cand = relocate(perm, i - 1, p - 1)
        else:
            cand = two_opt(perm, min(i, j) - 1, max(i, j) - 1)
        if ev.feasible(cand):
            return cand, True
    return perm, False


# =====================================================================
# ALGORITMO 4.2 — ILS(Niter, Nrand, Tour)
# =====================================================================
def ils(initial_perm, ev, n_iter, n_rand, rng):
    """Iterated Local Search tal como el Algoritmo 4.2. Devuelve el mejor tour y la traza."""
    cost_current = ev.total(initial_perm)       # costCurrent ← CostOfInitialTour
    best_tour = list(initial_perm)              # bestTour ← Tour
    history = []
    local_optima = []
    best_iteration = 0
    improvements = 0
    ls_moves = 0
    discarded = 0

    if len(initial_perm) >= 2:
        for it in range(1, n_iter + 1):
            tour = list(best_tour)              # Tour ← bestTour
            for _ in range(n_rand):
                tour, ok = random_move(tour, rng, ev)
                discarded += not ok
            cost_new = ev.total(tour)
            tour, cost_new, moves = local_search(tour, cost_new, ev)
            ls_moves += moves
            if cost_new < cost_current - EPS:   # if (costNew < costCurrent)
                cost_current = cost_new
                best_tour = list(tour)
                best_iteration = it
                improvements += 1
            history.append(round(cost_current, 6))
            local_optima.append(round(cost_new, 6))
    else:
        # Con un solo cliente no existe ningún movimiento: el tour es óptimo y la traza es constante.
        history = [round(cost_current, 6)] * n_iter
        local_optima = [round(cost_current, 6)] * n_iter

    return {
        "perm": best_tour,
        "cost": cost_current,
        "history": history,
        "localOptima": local_optima,
        "bestIteration": best_iteration,
        "improvements": improvements,
        "localSearchMoves": ls_moves,
        "discardedRandomMoves": discarded,
    }


# =====================================================================
# SOLUCIÓN INICIAL: TSP + REUBICACIÓN DEL DEPÓSITO (§4)
# =====================================================================
def held_karp(c, n):
    """TSP óptimo por programación dinámica sobre subconjuntos (Held & Karp, 1962). O(n² 2ⁿ)."""
    if n == 1:
        return [1]
    size = 1 << n
    inf = math.inf
    dp = [[inf] * n for _ in range(size)]
    parent = [[-1] * n for _ in range(size)]
    for j in range(n):
        dp[1 << j][j] = c[0][j + 1]
    for mask in range(1, size):
        row = dp[mask]
        for j in range(n):
            cur = row[j]
            if cur == inf or not (mask >> j) & 1:
                continue
            cj = c[j + 1]
            for k in range(n):
                if (mask >> k) & 1:
                    continue
                nm = mask | (1 << k)
                value = cur + cj[k + 1]
                if value < dp[nm][k]:
                    dp[nm][k] = value
                    parent[nm][k] = j
    full = size - 1
    last = min(range(n), key=lambda j: (dp[full][j] + c[j + 1][0], j))
    order = []
    mask = full
    while last != -1:
        order.append(last + 1)
        prev = parent[mask][last]
        mask ^= 1 << last
        last = prev
    return order[::-1]


def nearest_neighbor_2opt(c, n):
    """Vecino más cercano desde el depósito + relocate/2-opt de mejor mejora sobre el ruteo."""
    unvisited = set(range(1, n + 1))
    perm = []
    cur = 0
    while unvisited:
        nxt = min(unvisited, key=lambda v: (c[cur][v], v))
        perm.append(nxt)
        unvisited.remove(nxt)
        cur = nxt

    def route(seq):
        return c[0][seq[0]] + sum(c[seq[k]][seq[k + 1]] for k in range(len(seq) - 1)) + c[seq[-1]][0]

    cost = route(perm)
    while True:
        best, best_cost = None, cost
        for i in range(n):
            for p in range(n):
                if p != i:
                    cand = relocate(perm, i, p)
                    cc = route(cand)
                    if cc < best_cost - EPS:
                        best, best_cost = cand, cc
        for i in range(n - 1):
            for j in range(i + 1, n):
                cand = two_opt(perm, i, j)
                cc = route(cand)
                if cc < best_cost - EPS:
                    best, best_cost = cand, cc
        if best is None:
            return perm
        perm, cost = best, best_cost


def tsp_tour(c, n):
    """Ciclo TSP por el depósito y todos los clientes (secuencia de clientes a partir del depósito)."""
    if n <= HELD_KARP_MAX:
        return held_karp(c, n), "Held-Karp · TSP óptimo"
    return nearest_neighbor_2opt(c, n), "Vecino más cercano + 2-opt/relocate"


def relocate_depot(cycle, ev):
    """
    Mosheiov (1994): mover el depósito a lo largo del ciclo TSP produce al menos
    un tour factible. Poner el depósito antes del k-ésimo cliente del ciclo da la
    secuencia cycle[k:] + cycle[:k]; se elige la factible de menor ruteo + manipulación.
    """
    options = []
    for k in range(len(cycle)):
        perm = cycle[k:] + cycle[:k]
        if not ev.feasible(perm):
            continue
        r = ev.routing(perm)
        h = ev.handling(perm)
        options.append((round(r + h, 9), k, perm, r, h))
    if not options:
        raise RuntimeError("Ninguna posición del depósito es factible (¿Q < max{Σα, Σβ}?)")
    total, k, perm, r, h = min(options, key=lambda o: (o[0], o[1]))
    return {"perm": perm, "shift": k, "feasibleShifts": len(options), "routing": r, "handling": h, "cost": r + h}


# =====================================================================
# EJECUCIÓN SOBRE UNA INSTANCIA
# =====================================================================
def full_tour(perm):
    return [0] + list(perm) + [0]


def summarize(perm, inst, h_val):
    """Ruteo, manipulación y detalle por parada del tour (reutiliza la evaluación del Algoritmo 2.1)."""
    ev = evaluate_tour(full_tour(perm), inst, h_val, h_val)
    return {
        "tour": ev["tour"],
        "totalDistance": ev["totalDistance"],
        "handlingCost": ev["handlingDP"],
        "objectiveValue": ev["objectiveDP"],
        "handlingP1": ev["handlingP1"],
        "handlingP2": ev["handlingP2"],
        "policies": ev["policies"],
        "policy2Customers": ev["policy2Customers"],
        "detail": ev["detail"],
    }


def run_direction(inst, h_val, initial, n_iter, n_rand, seed, direction):
    ev = Evaluator(inst, h_val, h_val)
    rng = random.Random(seed * 10 + direction)
    t0 = time.perf_counter()
    res = ils(initial["perm"], ev, n_iter, n_rand, rng)
    elapsed = time.perf_counter() - t0
    return {
        "direction": direction,
        "seed": seed,
        "initial": {
            "tour": full_tour(initial["perm"]),
            "totalDistance": initial["routing"],
            "handlingCost": round(initial["handling"], 6),
            "objectiveValue": round(initial["cost"], 6),
            "depotShift": initial["shift"],
            "feasibleShifts": initial["feasibleShifts"],
        },
        "best": {
            "tour": full_tour(res["perm"]),
            "totalDistance": ev.routing(res["perm"]),
            "handlingCost": round(res["cost"] - ev.routing(res["perm"]), 6),
            "objectiveValue": round(res["cost"], 6),
        },
        "bestIteration": res["bestIteration"],
        "improvements": res["improvements"],
        "localSearchMoves": res["localSearchMoves"],
        "discardedRandomMoves": res["discardedRandomMoves"],
        "dpCalls": ev.dp_calls,
        "neighborsScanned": ev.neighbors,
        "timeSec": round(elapsed, 4),
        "history": res["history"],
        "localOptima": res["localOptima"],
    }


def gurobi_reference(num_customers, instance_id, h_val):
    ref = {}
    for model, label, filename, sol in load_gurobi_solutions(num_customers, instance_id, h_val):
        ref[model] = {
            "label": label,
            "source": filename,
            "tour": sol.get("tour"),
            "totalDistance": sol.get("totalDistance"),
            "handlingCost": sol.get("handlingCost"),
            "objectiveValue": sol.get("objectiveValue"),
        }
    return ref


def solve_instance(num_customers=NUM_CUSTOMERS, instance_id=INSTANCE_ID, h_val=H_VALUE, n_iter=N_ITER,
                   d_ratio=D_RATIO, seed=SEED, runs=RUNS, output_dir=RESULTS_DIR, save=True, verbose=True):
    """Ejecuta ILS-1dir / ILS-2dir sobre una instancia e_vigo y guarda el resultado."""
    inst = load_instance(num_customers, instance_id)
    n = inst["n"]
    if runs < 1:
        raise ValueError("runs debe ser >= 1")
    n_rand = max(1, math.floor(d_ratio * n + 0.5 + 1e-9))
    t_start = time.perf_counter()

    if verbose:
        print("\n" + "=" * 80)
        print(f" ILS · ALGORITMO 4.2 (Erdoğan et al. 2012) — POLÍTICA 3 CON EVALUACIÓN EXACTA (ALG. 2.1 + DP)")
        print(f" Clientes: {n} | Instancia ID: {instance_id} | Q = {inst['Q']} | h = {h_val} "
              f"| Niter = {n_iter} | Nrand = {n_rand} | corridas = {runs} (semilla {seed}…)")
        print("=" * 80)

    # 1. Tour TSP y reubicación del depósito en ambas direcciones
    ev0 = Evaluator(inst, h_val, h_val)
    cycle, tsp_method = tsp_tour(inst["c"], n)
    tsp_cost = ev0.routing(cycle)
    initials = [relocate_depot(cycle, ev0), relocate_depot(cycle[::-1], ev0)]
    if verbose:
        print(f"• Tour TSP ({tsp_method}): {format_tour(full_tour(cycle))} | costo {tsp_cost}")
        for d, ini in enumerate(initials, 1):
            print(f"• Inicial dirección {d}: {format_tour(full_tour(ini['perm']))} | ruteo {ini['routing']} "
                  f"+ handling {ini['handling']:.2f} = {ini['cost']:.2f} "
                  f"({ini['feasibleShifts']}/{n} posiciones del depósito factibles)")

    # 2. ILS en cada dirección, para cada corrida
    run_list = []
    for r in range(runs):
        run_seed = seed + r
        dirs = [run_direction(inst, h_val, ini, n_iter, n_rand, run_seed, d) for d, ini in enumerate(initials, 1)]
        best_dir = min(dirs, key=lambda x: (round(x["best"]["objectiveValue"], 9), x["direction"]))
        run_list.append({
            "seed": run_seed,
            "oneDir": dirs[0]["best"]["objectiveValue"],
            "twoDir": best_dir["best"]["objectiveValue"],
            "bestDirection": best_dir["direction"],
            "timeSec": round(sum(x["timeSec"] for x in dirs), 4),
            "directions": dirs,
        })
        if verbose:
            for x in dirs:
                print(f"  - Corrida {r + 1} (semilla {run_seed}) dir. {x['direction']}: "
                      f"{x['initial']['objectiveValue']:.2f} → {x['best']['objectiveValue']:.2f} "
                      f"(mejor en it. {x['bestIteration']}, {x['improvements']} mejoras, {x['timeSec']:.2f} s)")

    # Se reporta la mejor corrida (ante empate, la de menor semilla) con su traza completa
    main_run = min(run_list, key=lambda r: (round(r["twoDir"], 9), r["seed"]))
    best_dir = next(x for x in main_run["directions"] if x["direction"] == main_run["bestDirection"])
    best = summarize(best_dir["best"]["tour"][1:-1], inst, h_val)
    one_dir = summarize(main_run["directions"][0]["best"]["tour"][1:-1], inst, h_val)

    objectives = [r["twoDir"] for r in run_list]
    best_known = min(objectives)
    ref = gurobi_reference(n, instance_id, h_val)
    p3 = ref.get("TSPPD-H_3")
    gap = None
    if p3 and p3.get("objectiveValue"):
        gap = round((best["objectiveValue"] - p3["objectiveValue"]) / p3["objectiveValue"] * 100.0, 6)

    data = {
        "algorithm": "alg42-ils",
        "algorithmName": "ILS · Algoritmo 4.2 (Erdoğan et al. 2012, §4.2)",
        "paper": PAPER_REF,
        "numCustomers": n,
        "instanceId": instance_id,
        "h": h_val,
        "h_a": h_val,
        "h_b": h_val,
        "capacity": inst["Q"],
        "params": {
            "nIter": n_iter,
            "nRand": n_rand,
            "d": d_ratio,
            "seed": seed,
            "runs": runs,
            "neighborhood": "relocate + 2-opt",
            "evaluation": "exacta (Algoritmo 2.1 + DP)",
            "tspMethod": tsp_method,
            "maxRandomTries": MAX_RANDOM_TRIES,
        },
        "nodes": [{"id": i, "alpha": inst["alpha"][i], "beta": inst["beta"][i]} for i in range(n + 1)],
        "tsp": {"tour": full_tour(cycle), "cost": tsp_cost, "method": tsp_method},
        "best": {**best, "direction": best_dir["direction"], "seed": main_run["seed"],
                 "bestIteration": best_dir["bestIteration"]},
        "oneDir": {**one_dir, "direction": 1, "seed": main_run["seed"]},
        "directions": main_run["directions"],
        "runsSummary": {
            "objectives": objectives,
            "oneDirObjectives": [r["oneDir"] for r in run_list],
            "seeds": [r["seed"] for r in run_list],
            "timesSec": [r["timeSec"] for r in run_list],
            "min": best_known,
            "mean": round(sum(objectives) / len(objectives), 6),
            "max": max(objectives),
            "hitsBest": sum(1 for z in objectives if z <= best_known + 1e-6),
        },
        "reference": ref,
        "gapToGurobiP3Pct": gap,
        "timeSec": round(time.perf_counter() - t_start, 4),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    if verbose:
        print_report(data)

    if save:
        os.makedirs(output_dir, exist_ok=True)
        filename = f"ILS_{n}_Clientes_ID{instance_id}_H_{h_tag(h_val)}.json"
        path = os.path.join(output_dir, filename)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        if verbose:
            print(f"[OK] Resultado guardado en: {path}\n")
    return data


def print_report(data):
    best = data["best"]
    print("\n" + "-" * 80)
    print(f" MEJOR SOLUCIÓN ILS-2dir (semilla {best['seed']}, dirección {best['direction']}, "
          f"mejor en la iteración {best['bestIteration']})")
    print("-" * 80)
    print(f"• Ruta:        {format_tour(best['tour'])}")
    print(f"• Ruteo:       {best['totalDistance']}")
    print(f"• Handling P3: {best['handlingCost']:.2f}  (P1 en la misma ruta: {best['handlingP1']:.2f} | "
          f"P2: {best['handlingP2']:.2f})")
    print(f"• Z = {best['objectiveValue']:.2f} | ILS-1dir: {data['oneDir']['objectiveValue']:.2f}")
    print(f"• Política 2 en los clientes: {best['policy2Customers'] or 'ninguno'}")
    rs = data["runsSummary"]
    if data["params"]["runs"] > 1:
        print(f"• {data['params']['runs']} corridas: min {rs['min']:.2f} | media {rs['mean']:.2f} | "
              f"max {rs['max']:.2f} | alcanzan el mínimo {rs['hitsBest']}/{data['params']['runs']}")
    if data["reference"]:
        print(f"\n {'Método':<22}{'Ruteo':>8}{'Handling':>10}{'Z':>10}")
        for model, ref in data["reference"].items():
            print(f" {'Gurobi · ' + ref['label']:<22}{ref['totalDistance']:>8}{ref['handlingCost']:>10.2f}"
                  f"{ref['objectiveValue']:>10.2f}")
        print(f" {'ILS · Algoritmo 4.2':<22}{best['totalDistance']:>8}{best['handlingCost']:>10.2f}"
              f"{best['objectiveValue']:>10.2f}")
        if data["gapToGurobiP3Pct"] is not None:
            print(f" Brecha ILS vs óptimo Gurobi de la Política 3: {data['gapToGurobiP3Pct']:.2f} %")
    print(f" Tiempo total: {data['timeSec']:.2f} s")


def main():
    parser = argparse.ArgumentParser(description="ILS (Algoritmo 4.2, Erdoğan et al. 2012) para el TSPPD-H bajo "
                                                 "Política 3 con evaluación exacta (Algoritmo 2.1 + DP)")
    parser.add_argument("--customers", type=int, nargs='+', default=[NUM_CUSTOMERS],
                        help=f"Número(s) de clientes (default: {NUM_CUSTOMERS})")
    parser.add_argument("--id", type=int, default=INSTANCE_ID, help=f"ID de la instancia 1 a 10 (default: {INSTANCE_ID})")
    parser.add_argument("--h", type=float, default=H_VALUE, help=f"Costo unitario de manipulación h (default: {H_VALUE})")
    parser.add_argument("--all-ids", action="store_true", help="Resolver las instancias ID 1 hasta 10")
    parser.add_argument("--iters", type=int, default=N_ITER, help=f"Niter por dirección (default: {N_ITER})")
    parser.add_argument("--d", type=float, default=D_RATIO, help=f"Nrand = d·|Vc| (default: {D_RATIO})")
    parser.add_argument("--seed", type=int, default=SEED, help=f"Semilla de la primera corrida (default: {SEED})")
    parser.add_argument("--runs", type=int, default=RUNS, help=f"Corridas con semillas consecutivas; se reporta la mejor (default: {RUNS})")
    parser.add_argument("--no-save", action="store_true", help="No guardar los resultados en Outputs/Erdogan2012/")
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs debe ser >= 1")
    if args.iters < 0:
        parser.error("--iters debe ser >= 0")

    ids = range(1, 11) if args.all_ids else [args.id]
    results = []
    for n in args.customers:
        for instance_id in ids:
            results.append(solve_instance(n, instance_id, args.h, args.iters, args.d, args.seed, args.runs,
                                          save=not args.no_save))

    if len(results) > 1:
        print("\n" + "=" * 80)
        print(f" RESUMEN ILS-2dir vs GUROBI POLÍTICA 3 ({len(results)} instancias)")
        print("=" * 80)
        print(f" {'n':>3} {'ID':>3} {'Z Gurobi P3':>12} {'Z ILS':>9} {'Brecha %':>9} {'H Gurobi P3':>12} "
              f"{'H ILS':>7} {'Tiempo s':>9}")
        for d in results:
            p3 = d["reference"].get("TSPPD-H_3", {})
            gap = d["gapToGurobiP3Pct"]
            print(f" {d['numCustomers']:>3} {d['instanceId']:>3} {p3.get('objectiveValue', float('nan')):>12.2f} "
                  f"{d['best']['objectiveValue']:>9.2f} {gap if gap is not None else float('nan'):>9.2f} "
                  f"{p3.get('handlingCost', float('nan')):>12.2f} {d['best']['handlingCost']:>7.2f} "
                  f"{d['timeSec']:>9.2f}")
        with_ref = [d for d in results if d["gapToGurobiP3Pct"] is not None]
        no_ref = len(results) - len(with_ref)
        if with_ref:
            hits = sum(1 for d in with_ref if d["gapToGurobiP3Pct"] <= 1e-6)
            extra = f" ({no_ref} sin solución Gurobi)" if no_ref else ""
            print(f"\n ILS-2dir alcanza el óptimo de Gurobi (Política 3) en {hits}/{len(with_ref)} instancias "
                  f"con referencia{extra}.\n")
        else:
            print("\n Sin soluciones Gurobi (Política 3) para estas instancias: no se calcula la brecha.\n")


if __name__ == '__main__':
    main()

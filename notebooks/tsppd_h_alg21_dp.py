"""
Algoritmo 2.1 + Programación Dinámica (DP) para el subproblema de manipulación.

Referencia:
    Erdoğan, G., Battarra, M., Laporte, G. & Vigo, D. (2012).
    "Metaheuristics for the traveling salesman problem with pickups, deliveries
    and handling costs". Computers & Operations Research, 39, 1074–1086.
    Sección 2.1 (papers/Erdogan2012.pdf).

Dado un tour FIJO, calcula el costo mínimo de manipulación bajo la Política 3
(en cada cliente se elige Política 1 —las β quedan en la compuerta— o
Política 2 —las β pasan al fondo tras descargar las α remanentes—).

Clientes renumerados 1..n según su orden en el tour:
    · p_ij  = costo de aplicar Política 1 en los clientes i+1..j-1 y Política 2
              en el cliente j (lo calcula el Algoritmo 2.1, O(n²)).
    · f(i)  = costo óptimo de manipular los clientes i+1..n dado que se aplicó
              Política 2 en i (f(0): se parte del depósito con todo α a bordo).
    · (DP)  f(i) = min_{j ∈ {i+1..n}} { p_ij + f(j) }   ∀ i ∈ {0..n-1}   (1)
            f(n) = 0                                                     (2)
    El costo óptimo de manipulación del tour es f(0). Complejidad total O(n²).

Nota: el pseudo-código siempre cierra la cadena con Política 2 en el cliente n.
Eso no pierde optimalidad: desde el último cliente con entrega ya no quedan α a
bordo, de modo que encadenar Política 2 en cada cliente restante cuesta
h_a·0 + h_b·0 = 0 (--verify lo comprueba contra la enumeración de las 2^n
combinaciones de políticas, incluyendo clientes con α_i = 0).

Uso:
    python notebooks/tsppd_h_alg21_dp.py                          # 5 clientes, ID 1
    python notebooks/tsppd_h_alg21_dp.py --customers 10 --id 3
    python notebooks/tsppd_h_alg21_dp.py --customers 5 10 --all-ids   # 20 instancias
    python notebooks/tsppd_h_alg21_dp.py --customers 10 --id 3 --tour 0,4,2,1,3,5,6,7,8,9,10,0
    python notebooks/tsppd_h_alg21_dp.py --verify                 # DP vs fuerza bruta 2^n

Para cada instancia evalúa con la DP los tours que Gurobi encontró (Modelo
General y Políticas 1, 2 y 3, archivos de Outputs/) y guarda el resultado en
Outputs/Erdogan2012/DP_<n>_Clientes_ID<id>_H_<h>.json (lo lee la Página Web 12).
"""
import os
import sys
import math
import json
import time
import random
import argparse
import itertools
from datetime import datetime, timezone

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

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
COST_FILE = os.path.join(BASE_DIR, "e_vigo", "ecosti.dat")
DATA_FILE = os.path.join(BASE_DIR, "e_vigo", "edati.dat")
OUTPUTS_DIR = os.path.join(BASE_DIR, "Outputs")
# Subcarpeta propia: las páginas web solo leen los archivos del nivel superior de Outputs/
RESULTS_DIR = os.path.join(OUTPUTS_DIR, "Erdogan2012")
# =====================================================================

EPS = 1e-9
PAPER_REF = ("Erdoğan, Battarra, Laporte & Vigo (2012). Metaheuristics for the TSP with "
             "pickups, deliveries and handling costs. Computers & Operations Research 39, 1074–1086.")

# Soluciones Gurobi en Outputs/ (mismo orden canónico que la Página Web 12)
GUROBI_MODELS = [
    ("TSPPD-H", "Modelo General", "Solucion_{n}_Clientes_ID{id}_H_{tag}.txt"),
    ("TSPPD-H_1", "Política 1", "Solucion_TSPPD_H1_{n}_Clientes_ID{id}_H_{tag}.txt"),
    ("TSPPD-H_2", "Política 2", "Solucion_TSPPD_H2_{n}_Clientes_ID{id}_H_{tag}.txt"),
    ("TSPPD-H_3", "Política 3", "Solucion_TSPPD_H3_{n}_Clientes_ID{id}_H_{tag}.txt"),
]


# =====================================================================
# DATOS DE LA INSTANCIA (misma derivación que los solvers Gurobi, Ec. 15)
# =====================================================================
def get_tokens(filepath, target_id):
    """Extrae el bloque de datos correspondiente a la instancia"""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    blocks = content.split('---------------------')
    for block in blocks:
        tokens = block.split()
        if len(tokens) >= 4 and tokens[0] == '0.' and tokens[1] == '50' and tokens[2] == str(target_id):
            return tokens[4:]

    raise ValueError(f"No se encontró la instancia {target_id} en {filepath}")


def load_instance(num_customers, instance_id):
    """
    Lee la matriz de costos y las demandas de e_vigo y deriva α, β y Q como en §5:
    p'_i = max{1, p_i mod 20}, β_i = ⌊p'_i (i mod 5) / 5⌋, α_i = p'_i − β_i,
    Q = max{Σ α_i, Σ β_i}. Los índices 0..n son el depósito (0) y los clientes.
    """
    c_tokens = get_tokens(COST_FILE, instance_id)
    c_full = [[int(c_tokens[i * 51 + j]) for j in range(51)] for i in range(51)]

    d_tokens = get_tokens(DATA_FILE, instance_id)
    p = [int(x) for x in d_tokens[:50]]

    V = num_customers + 1
    c = [[c_full[i][j] for j in range(V)] for i in range(V)]

    alpha = [0] * V
    beta = [0] * V
    for i in range(1, V):
        p_prime = max(1, p[i - 1] % 20)
        b_val = math.floor(p_prime * ((i % 5) / 5.0))
        alpha[i] = p_prime - b_val
        beta[i] = b_val

    Q = max(sum(alpha), sum(beta))
    return {"n": num_customers, "id": instance_id, "c": c, "alpha": alpha, "beta": beta, "Q": Q}


def routing_cost(tour, c):
    """Costo de ruteo Σ c_ij del tour [0, c1, ..., cn, 0]."""
    return sum(c[tour[k]][tour[k + 1]] for k in range(len(tour) - 1))


def is_feasible(tour, alpha, beta, Q):
    """El vehículo sale con Σα a bordo y en cada cliente entrega α_i y recoge β_i sin superar Q."""
    load = sum(alpha[v] for v in tour[1:-1])
    if load > Q:
        return False
    for v in tour[1:-1]:
        load += beta[v] - alpha[v]
        if load > Q:
            return False
    return True


def tour_sequences(tour, alpha, beta):
    """Renumera los clientes según su orden en el tour: a[k], b[k] para k = 1..n (índice 0 sin uso)."""
    customers = tour[1:-1]
    return [0] + [alpha[v] for v in customers], [0] + [beta[v] for v in customers]


# =====================================================================
# ALGORITMO 2.1 — P(a, b, h_a, h_b)
# =====================================================================
def compute_p(a, b, h_a, h_b):
    """
    Algoritmo 2.1 del paper: matriz p_ij (costo de Política 1 en i+1..j-1 y
    Política 2 en j). a[k], b[k] son las entregas y recogidas del k-ésimo cliente
    del tour (k = 1..n). a' y b' son las unidades α y β (en la compuerta) a bordo
    e y es el costo acumulado de aplicar Política 1.

    Devuelve p con filas i = 0..n-1 y columnas j = i+1..n (None fuera de rango).
    """
    n = len(a) - 1
    a0 = sum(a[1:])
    p = [[None] * (n + 1) for _ in range(n)]

    for i in range(0, n):                 # for i = 0 to (n-1)
        b_prime = 0                       # b' = 0
        y = 0.0                           # y = 0   // se aplicó Política 2 en i
        a_prime = a0                      # a' = a0 // entregas remanentes a bordo
        for j in range(1, i + 1):         # for j = 1 to i
            a_prime -= a[j]               #   a' = a' − a_j
        for j in range(i + 1, n + 1):     # for j = i+1 to n
            a_prime -= a[j]               #   entregar (igual en Política 1 ó 2)
            # costo de Política 1 hasta aquí más el costo de Política 2 en j
            if b_prime + b[j] > 0:
                p[i][j] = y + h_a * a_prime + h_b * b_prime
            else:
                p[i][j] = y
            if a[j] > 0:                  # Política 1: las b' de la compuerta obstruyen
                y = y + h_b * b_prime
            b_prime = b_prime + b[j]      # recoger como si se usara Política 1
    return p


# =====================================================================
# PROGRAMACIÓN DINÁMICA — Ecs. (1) y (2)
# =====================================================================
def dynamic_programming(p, n):
    """
    f(i) = min_{j ∈ {i+1..n}} { p_ij + f(j) },  f(n) = 0.
    Devuelve (f, succ): succ[i] es el cliente j donde se vuelve a aplicar Política 2.
    Ante empates se conserva el menor j.
    """
    f = [0.0] * (n + 1)
    succ = [None] * (n + 1)
    for i in range(n - 1, -1, -1):
        best = math.inf
        for j in range(i + 1, n + 1):
            value = p[i][j] + f[j]
            if value < best - EPS:
                best = value
                succ[i] = j
        f[i] = best
    return f, succ


def policies_from_dp(succ, n):
    """Reconstruye la política de cada posición k = 1..n: 1 (compuerta) ó 2 (fondo)."""
    policy = [None] * (n + 1)
    i = 0
    while i < n:
        j = succ[i]
        for k in range(i + 1, j):
            policy[k] = 1
        policy[j] = 2
        i = j
    return policy


def solve_handling(a, b, h_a, h_b):
    """Algoritmo 2.1 + DP en secuencia. Devuelve (costo óptimo f(0), f, succ, policy)."""
    n = len(a) - 1
    if n == 0:
        return 0.0, [0.0], [None], [None]
    p = compute_p(a, b, h_a, h_b)
    f, succ = dynamic_programming(p, n)
    return f[0], f, succ, policies_from_dp(succ, n)


def handling_cost_p3(tour, alpha, beta, h_a, h_b):
    """Costo óptimo de manipulación (Política 3) del tour [0, c1, ..., cn, 0]."""
    a, b = tour_sequences(tour, alpha, beta)
    return solve_handling(a, b, h_a, h_b)[0]


# =====================================================================
# SIMULACIÓN FÍSICA DE LA CARGA (verificación independiente de la DP)
# =====================================================================
def simulate_policies(a, b, h_a, h_b, policy):
    """
    Simula el compartimiento [F, β_fondo…, α…, β_compuerta…, R] aplicando en
    cada posición k la política policy[k] ∈ {1, 2}:
      · Política 1: si hay entrega (a_k > 0) se descargan y recargan las β de la
        compuerta (h_b c/u); las nuevas β quedan en la compuerta.
      · Política 2: si hay β que reubicar (compuerta + nuevas > 0) se descargan
        las β de la compuerta (h_b c/u) y las α remanentes tras entregar (h_a c/u);
        todas las β pasan al fondo y se recargan las α.
    Devuelve (costo total, detalle por parada).
    """
    n = len(a) - 1
    a_on = sum(a[1:])
    b_front = 0
    b_rear = 0
    total = 0.0
    detail = []
    for k in range(1, n + 1):
        arrival = (a_on, b_front, b_rear)
        a_on -= a[k]
        ops_a = 0
        ops_b = 0
        if policy[k] == 1:
            if a[k] > 0:
                ops_b = b_rear
            b_rear += b[k]
        else:
            if b_rear + b[k] > 0:
                ops_b = b_rear
                ops_a = a_on
            b_front += b_rear + b[k]
            b_rear = 0
        cost = h_a * ops_a + h_b * ops_b
        total += cost
        detail.append({
            "position": k,
            "aArrival": arrival[0], "bFrontArrival": arrival[1], "bRearArrival": arrival[2],
            "policy": policy[k],
            "opsA": ops_a, "opsB": ops_b,
            "cost": round(cost, 6),
            "aDeparture": a_on, "bFrontDeparture": b_front, "bRearDeparture": b_rear,
        })
    return total, detail


def brute_force_p3(a, b, h_a, h_b):
    """Mínimo sobre las 2^n combinaciones de políticas (solo para verificar instancias pequeñas)."""
    n = len(a) - 1
    best = math.inf
    for combo in itertools.product((1, 2), repeat=n):
        cost, _ = simulate_policies(a, b, h_a, h_b, [None] + list(combo))
        best = min(best, cost)
    return best


def evaluate_tour(tour, inst, h_a, h_b):
    """Evalúa un tour: ruteo, manipulación P1, P2 y P3 (DP) y el detalle de cada parada."""
    alpha, beta = inst["alpha"], inst["beta"]
    a, b = tour_sequences(tour, alpha, beta)
    n = len(a) - 1

    t0 = time.perf_counter()
    cost_dp, f, succ, policy = solve_handling(a, b, h_a, h_b)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    cost_sim, detail = simulate_policies(a, b, h_a, h_b, policy)
    if abs(cost_sim - cost_dp) > 1e-6:
        raise AssertionError(f"La simulación de las políticas de la DP ({cost_sim}) no reproduce f(0) = {cost_dp}")
    cost_p1, _ = simulate_policies(a, b, h_a, h_b, [None] + [1] * n)
    cost_p2, _ = simulate_policies(a, b, h_a, h_b, [None] + [2] * n)

    for row, v in zip(detail, tour[1:-1]):
        row["customer"] = v
        row["alpha"] = alpha[v]
        row["beta"] = beta[v]

    dist = routing_cost(tour, inst["c"])
    return {
        "tour": tour,
        "feasible": is_feasible(tour, alpha, beta, inst["Q"]),
        "totalDistance": dist,
        "handlingDP": round(cost_dp, 6),
        "objectiveDP": round(dist + cost_dp, 6),
        "handlingP1": round(cost_p1, 6),
        "handlingP2": round(cost_p2, 6),
        "policies": {str(v): policy[k] for k, v in enumerate(tour[1:-1], start=1)},
        "policy2Customers": [v for k, v in enumerate(tour[1:-1], start=1) if policy[k] == 2],
        "f": [round(x, 6) for x in f[:n + 1]],
        "detail": detail,
        "dpTimeMs": round(elapsed_ms, 4),
    }


# =====================================================================
# EVALUACIÓN DE LOS TOURS DE GUROBI (Outputs/)
# =====================================================================
def h_tag(h_val):
    return str(h_val).replace('.', '')


def load_gurobi_solutions(num_customers, instance_id, h_val):
    """Lee las soluciones Gurobi disponibles en Outputs/ para la instancia (las que falten se omiten)."""
    found = []
    for model, label, pattern in GUROBI_MODELS:
        filename = pattern.format(n=num_customers, id=instance_id, tag=h_tag(h_val))
        path = os.path.join(OUTPUTS_DIR, filename)
        if not os.path.exists(path):
            continue
        with open(path, 'r', encoding='utf-8') as f:
            found.append((model, label, filename, json.load(f)))
    return found


def check_demands(inst, sol, filename):
    """Confirma que α, β y Q del archivo Gurobi coinciden con los derivados de e_vigo."""
    for node in sol.get("nodes", []):
        i = node["id"]
        if i == 0 or i >= len(inst["alpha"]):
            continue
        if node["alpha"] != inst["alpha"][i] or node["beta"] != inst["beta"][i]:
            raise ValueError(f"{filename}: demandas del nodo {i} no coinciden con e_vigo")
    if sol.get("capacity") not in (None, inst["Q"]):
        raise ValueError(f"{filename}: capacidad {sol.get('capacity')} ≠ Q = {inst['Q']}")


def evaluate_instance(num_customers, instance_id, h_val):
    """Aplica el Algoritmo 2.1 + DP a cada tour Gurobi de la instancia."""
    inst = load_instance(num_customers, instance_id)
    rows = []
    for model, label, filename, sol in load_gurobi_solutions(num_customers, instance_id, h_val):
        check_demands(inst, sol, filename)
        tour = [int(v) for v in sol["tour"]]
        ev = evaluate_tour(tour, inst, h_val, h_val)
        if ev["totalDistance"] != sol.get("totalDistance", ev["totalDistance"]):
            raise ValueError(f"{filename}: distancia {sol.get('totalDistance')} ≠ {ev['totalDistance']} recalculada")
        # Costo que Gurobi pagó en cada parada (para comparar parada a parada con la DP)
        gurobi_stops = {int(st["to"]): {"cost": st.get("handlingCost", 0), "ops": st.get("handlingCount", 0)}
                        for st in sol.get("steps", []) if int(st["to"]) != 0}
        # Decisiones s_i de Gurobi en la Política 3 (s_i = 1 → Política 1, s_i = 0 → Política 2)
        gurobi_policies = None
        if sol.get("policyDecisions"):
            gurobi_policies = {str(k): (1 if int(v) == 1 else 2) for k, v in sol["policyDecisions"].items()}
        rows.append({
            "model": model,
            "label": label,
            "source": filename,
            "gurobiHandling": sol.get("handlingCost"),
            "gurobiObjective": sol.get("objectiveValue"),
            "gurobiStops": {str(k): v for k, v in gurobi_stops.items()},
            "gurobiPolicies": gurobi_policies,
            **ev,
        })
    return inst, rows


def format_tour(tour):
    return "-".join(str(v) for v in tour)


def print_instance_report(inst, rows, h_val, show_detail=True):
    """Reporte en consola: handling de Gurobi frente al de la DP sobre la misma ruta."""
    print("\n" + "=" * 96)
    print(f" ALGORITMO 2.1 + DP (Erdoğan et al. 2012, §2.1) · Clientes: {inst['n']} | Instancia ID: {inst['id']} "
          f"| Q = {inst['Q']} | h = {h_val}")
    print("=" * 96)
    if not rows:
        print(" [AVISO] No hay soluciones Gurobi en Outputs/ para esta instancia.")
        return
    print(f" {'Modelo Gurobi':<15}{'Ruta':<34}{'Dist':>6}{'H Gurobi':>10}{'H P1':>8}{'H P2':>8}"
          f"{'H DP (P3)':>11}{'Z DP':>9}")
    print("-" * 96)
    for r in rows:
        print(f" {r['label']:<15}{format_tour(r['tour']):<34}{r['totalDistance']:>6}"
              f"{r['gurobiHandling']:>10.2f}{r['handlingP1']:>8.2f}{r['handlingP2']:>8.2f}"
              f"{r['handlingDP']:>11.2f}{r['objectiveDP']:>9.2f}")
    print("-" * 96)
    p3 = next((r for r in rows if r["model"] == "TSPPD-H_3"), None)
    if p3 is not None:
        ok = abs(p3["handlingDP"] - p3["gurobiHandling"]) <= 0.005 + 1e-9
        print(f" Validación: DP sobre el tour de la Política 3 = {p3['handlingDP']:.2f} | Gurobi = "
              f"{p3['gurobiHandling']:.2f} → {'COINCIDE' if ok else 'NO COINCIDE'}")

    if show_detail and p3 is not None:
        print(f"\n Detalle por parada del tour Política 3 (decisiones de la DP):")
        print(f" {'#':>3} {'Cliente':>8} {'α':>4} {'β':>4} {'α a bordo':>10} {'β fondo':>8} {'β compuerta':>12}"
              f" {'Política':>9} {'ops α':>6} {'ops β':>6} {'Costo':>7}")
        for d in p3["detail"]:
            print(f" {d['position']:>3} {d['customer']:>8} {d['alpha']:>4} {d['beta']:>4} {d['aArrival']:>10}"
                  f" {d['bFrontArrival']:>8} {d['bRearArrival']:>12} {'P' + str(d['policy']):>9}"
                  f" {d['opsA']:>6} {d['opsB']:>6} {d['cost']:>7.2f}")


def save_instance_result(inst, rows, h_val, output_dir=RESULTS_DIR):
    """Guarda la evaluación en Outputs/Erdogan2012/DP_<n>_Clientes_ID<id>_H_<h>.json."""
    os.makedirs(output_dir, exist_ok=True)
    filename = f"DP_{inst['n']}_Clientes_ID{inst['id']}_H_{h_tag(h_val)}.json"
    data = {
        "algorithm": "alg21-dp",
        "algorithmName": "Algoritmo 2.1 + DP (Erdoğan et al. 2012, §2.1)",
        "paper": PAPER_REF,
        "numCustomers": inst["n"],
        "instanceId": inst["id"],
        "h": h_val,
        "h_a": h_val,
        "h_b": h_val,
        "capacity": inst["Q"],
        "nodes": [{"id": i, "alpha": inst["alpha"][i], "beta": inst["beta"][i]} for i in range(inst["n"] + 1)],
        "evaluations": rows,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    path = os.path.join(output_dir, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return path


# =====================================================================
# VERIFICACIÓN: DP vs FUERZA BRUTA
# =====================================================================
def run_verification(trials=3000, max_n=10, seed=2012):
    """
    Compara la DP con la enumeración de las 2^n combinaciones de políticas en
    tours aleatorios (incluye clientes con α = 0 o β = 0 y h_a ≠ h_b).
    """
    rng = random.Random(seed)
    worst = 0.0
    zero_alpha_last = 0
    for t in range(trials):
        n = rng.randint(1, max_n)
        a = [0] + [rng.choice([0, 0, 1, 2, 3, 5, 8]) for _ in range(n)]
        b = [0] + [rng.choice([0, 0, 1, 2, 4, 6]) for _ in range(n)]
        h_a = rng.choice([0.1, 0.5, 1.0, 2.0])
        h_b = rng.choice([0.1, 0.5, 1.0, 2.0])
        exact = brute_force_p3(a, b, h_a, h_b)
        dp, _, _, policy = solve_handling(a, b, h_a, h_b)
        sim, _ = simulate_policies(a, b, h_a, h_b, policy)
        worst = max(worst, abs(dp - exact), abs(sim - dp))
        if abs(dp - exact) > 1e-6 or abs(sim - dp) > 1e-6:
            raise AssertionError(f"Discrepancia en la prueba {t}: a={a} b={b} h_a={h_a} h_b={h_b} "
                                 f"DP={dp} fuerza bruta={exact} simulación={sim}")
        zero_alpha_last += a[n] == 0
    print(f"[OK] DP = fuerza bruta en {trials} tours aleatorios (n ≤ {max_n}; {zero_alpha_last} con α_n = 0); "
          f"error máximo {worst:.2e}.")


def parse_tour(text, n):
    tour = [int(x) for x in text.replace(' ', '').split(',') if x != '']
    if tour[0] != 0:
        tour = [0] + tour
    if tour[-1] != 0:
        tour = tour + [0]
    if sorted(tour[1:-1]) != list(range(1, n + 1)):
        raise ValueError(f"El tour debe visitar una vez cada cliente 1..{n}: {tour}")
    return tour


def main():
    parser = argparse.ArgumentParser(description="Algoritmo 2.1 + DP (Erdoğan et al. 2012): costo óptimo de "
                                                 "manipulación bajo Política 3 para tours fijos")
    parser.add_argument("--customers", type=int, nargs='+', default=[NUM_CUSTOMERS],
                        help=f"Número(s) de clientes (default: {NUM_CUSTOMERS})")
    parser.add_argument("--id", type=int, default=INSTANCE_ID, help=f"ID de la instancia 1 a 10 (default: {INSTANCE_ID})")
    parser.add_argument("--h", type=float, default=H_VALUE, help=f"Costo unitario de manipulación h (default: {H_VALUE})")
    parser.add_argument("--all-ids", action="store_true", help="Evaluar las instancias ID 1 hasta 10")
    parser.add_argument("--tour", type=str, default=None, help="Evaluar un tour propio, e.g. 0,3,1,2,4,5,0")
    parser.add_argument("--no-save", action="store_true", help="No guardar los resultados en Outputs/Erdogan2012/")
    parser.add_argument("--quiet", action="store_true", help="Omitir el detalle por parada")
    parser.add_argument("--verify", action="store_true", help="Comparar la DP con fuerza bruta en tours aleatorios")
    args = parser.parse_args()

    if args.verify:
        run_verification()
        return

    if args.tour:
        n = args.customers[0]
        inst = load_instance(n, args.id)
        tour = parse_tour(args.tour, n)
        ev = evaluate_tour(tour, inst, args.h, args.h)
        print(f"\nTour: {format_tour(tour)} | Factible (Q = {inst['Q']}): {'sí' if ev['feasible'] else 'NO'}")
        print(f"Distancia: {ev['totalDistance']} | Handling P1: {ev['handlingP1']:.2f} | P2: {ev['handlingP2']:.2f} "
              f"| P3 (DP): {ev['handlingDP']:.2f} | Z = {ev['objectiveDP']:.2f}")
        print(f"Política 2 en los clientes: {ev['policy2Customers'] or 'ninguno'}")
        return

    ids = range(1, 11) if args.all_ids else [args.id]
    summary = []
    for n in args.customers:
        for instance_id in ids:
            inst, rows = evaluate_instance(n, instance_id, args.h)
            print_instance_report(inst, rows, args.h, show_detail=not args.quiet)
            if rows and not args.no_save:
                path = save_instance_result(inst, rows, args.h)
                print(f"\n[OK] Evaluación guardada en: {path}")
            for r in rows:
                summary.append((n, instance_id, r))

    if len(summary) > 4:
        p3_rows = [(n, i, r) for n, i, r in summary if r["model"] == "TSPPD-H_3"]
        matches = sum(1 for _, _, r in p3_rows if abs(r["handlingDP"] - r["gurobiHandling"]) <= 0.005 + 1e-9)
        print("\n" + "=" * 70)
        print(f" RESUMEN: la DP reproduce el handling Gurobi de la Política 3 en {matches}/{len(p3_rows)} tours")
        print("=" * 70 + "\n")


if __name__ == '__main__':
    main()

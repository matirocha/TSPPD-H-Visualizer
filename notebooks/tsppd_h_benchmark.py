"""
Benchmark de tiempos de cómputo para el TSPPD-H.

Compara, sobre las instancias de Battarra et al. (2010) derivadas de e_vigo
(los primeros |Vc| clientes de las instancias de 50 clientes, Ec. 15), el tiempo
y la calidad de:

    · general  Modelo General TSPPD-H (Ecs. 1-16)          — Gurobi  (tsppd_h_gurobi.py), solo hasta
               N = GENERAL_MAX_N: con N mayor se registra «skipped» por su alto costo computacional
    · p1       TSPPD-H_1, Política 1 (Ecs. 17-25)           — Gurobi  (tsppd_h_1_gurobi.py)
    · p2       TSPPD-H_2, Política 2 (Ecs. 26-30)           — Gurobi  (tsppd_h_2_gurobi.py)
    · p3       TSPPD-H_3, Política 3 (Ecs. 31-48)           — Gurobi  (tsppd_h_3_gurobi.py)
    · dp       Algoritmo 2.1 + DP en dos fases: tour TSP → reubicación del depósito
               → manipulación óptima con la DP (solución inicial del §4 de Erdoğan et al. 2012)
    · ils      ILS-2dir, Algoritmo 4.2 con evaluación exacta (Algoritmo 2.1 + DP)

Los modelos Gurobi se ejecutan con su `solve_instance` original: el script solo
intercepta la creación del modelo (gp.Model) para fijar TimeLimit/Threads y leer
después Runtime, Status, ObjVal, ObjBound y MIPGap, como en las Tablas 2-4 de
Battarra et al. (2010) (allí el límite fue 7 200 s).

Resultados (los lee la Página Web 12, sección «Tiempos»):
    Outputs/Benchmark/registros.jsonl         una línea por ejecución (se reanuda desde aquí)
    Outputs/Benchmark/benchmark_tiempos.json  consolidado: configuración + registros
    Outputs/Benchmark/soluciones/             soluciones óptimas que escriben los solvers

Uso:
    python notebooks/tsppd_h_benchmark.py                                   # grilla completa
    python notebooks/tsppd_h_benchmark.py --customers 5 10 --h 0.1          # subconjunto
    python notebooks/tsppd_h_benchmark.py --methods p1 p2 p3 --time-limit 600
    python notebooks/tsppd_h_benchmark.py --workers 4 --threads 2           # 4 procesos × 2 hilos
    python notebooks/tsppd_h_benchmark.py --consolidate                     # solo regenerar el JSON
Las ejecuciones ya registradas con la misma configuración se omiten (usar --force para repetirlas).
"""
import os
import sys
import json
import math
import time
import argparse
import platform
from datetime import datetime, timezone
from multiprocessing import get_context

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
# CONFIGURACIÓN POR DEFECTO (Battarra et al. 2010, §5)
# =====================================================================
CUSTOMERS = [5, 10, 15, 20, 25]   # |Vc|
INSTANCE_IDS = list(range(1, 11))  # Id = 1..10
H_VALUES = [0.1, 0.5, 1.0]         # h = h_a = h_b (Tablas 2, 3 y 4)
METHODS = ["general", "p1", "p2", "p3", "dp", "ils"]
TIME_LIMIT = 1800.0                # segundos por modelo Gurobi (Battarra et al. 2010 usó 7 200 s)
THREADS = 1                        # hilos de Gurobi por proceso (un hilo, como CPLEX 11.2 en el paper)
WORKERS = 7                        # procesos en paralelo
NODEFILE_START_GB = 1.0            # sobre este tamaño del árbol B&B, Gurobi pasa nodos a disco
# El Modelo General está indexado por posiciones de carga (~52 000 binarias con N = 15): con N = 15
# ya llegaba a los 1 800 s con gaps de 40-58 %. Sobre este N no se ejecuta y se registra como
# «skipped» por su alto costo computacional (las demás formulaciones y heurísticas sí se ejecutan).
GENERAL_MAX_N = 10
SKIP_REASON = "No se ejecuta: alto costo computacional del Modelo General (formulación indexada por posiciones)"
ILS_ITERS = 200                    # Niter por dirección (Erdoğan et al. 2012, §5)
ILS_D = 0.10                       # Nrand = d·|Vc|
ILS_SEED = 1
ILS_RUNS = 10                      # corridas con semillas consecutivas
DP_REPEATS = 200                   # repeticiones para cronometrar una sola llamada a la DP

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BENCH_DIR = os.path.join(BASE_DIR, "Outputs", "Benchmark")
SOLUTIONS_DIR = os.path.join(BENCH_DIR, "soluciones")
RECORDS_FILE = os.path.join(BENCH_DIR, "registros.jsonl")
SUMMARY_FILE = os.path.join(BENCH_DIR, "benchmark_tiempos.json")
# =====================================================================

GUROBI_METHODS = {
    "general": ("tsppd_h_gurobi", "TSPPD-H", "Modelo General"),
    "p1": ("tsppd_h_1_gurobi", "TSPPD-H_1", "Política 1"),
    "p2": ("tsppd_h_2_gurobi", "TSPPD-H_2", "Política 2"),
    "p3": ("tsppd_h_3_gurobi", "TSPPD-H_3", "Política 3"),
}
METHOD_LABELS = {
    **{k: v[2] for k, v in GUROBI_METHODS.items()},
    "dp": "Algoritmo 2.1 + DP (dos fases)",
    "ils": "ILS-2dir (Algoritmo 4.2)",
}


def task_key(method, n, instance_id, h):
    return f"{method}|{n}|{instance_id}|{h:g}"


def config_signature(method, args):
    """Parámetros que, si cambian, invalidan un registro previo de ese método."""
    if method in GUROBI_METHODS:
        return {"timeLimitSec": args.time_limit, "threads": args.threads}
    if method == "ils":
        return {"nIter": args.ils_iters, "d": args.ils_d, "seed": args.ils_seed, "runs": args.ils_runs}
    return {}


def cpu_name():
    if sys.platform == "win32":
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            return winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
        except OSError:
            pass
    return platform.processor() or platform.machine()


# =====================================================================
# MODELOS GUROBI
# =====================================================================
class _GpProxy:
    """Sustituye al módulo gurobipy dentro de un solver: delega todo y captura cada gp.Model creado."""

    def __init__(self, real, on_model):
        self._real = real
        self._on_model = on_model

    def __getattr__(self, name):
        return getattr(self._real, name)

    def Model(self, *args, **kwargs):
        m = self._real.Model(*args, **kwargs)
        self._on_model(m)
        return m


STATUS_NAMES = {2: "optimal", 3: "infeasible", 4: "inf_or_unbd", 5: "unbounded", 9: "time_limit",
                10: "solution_limit", 11: "interrupted", 12: "numeric", 13: "suboptimal"}


def extract_tour(model, n):
    """Reconstruye el tour [0, …, 0] desde las variables x[i,j] de la mejor solución entera."""
    succ = {}
    for i in range(n + 1):
        for j in range(n + 1):
            if i == j:
                continue
            var = model.getVarByName(f"x[{i},{j}]")
            if var is not None and var.X > 0.5:
                succ[i] = j
    tour, cur = [0], 0
    for _ in range(n + 1):
        cur = succ.get(cur)
        if cur is None:
            return None
        tour.append(cur)
        if cur == 0:
            break
    if tour[-1] != 0 or len(tour) != n + 2 or len(set(tour[1:-1])) != n:
        return None
    return tour


def run_gurobi(method, n, instance_id, h, time_limit, threads):
    import importlib
    import gurobipy as gp
    from tsppd_h_alg21_dp import load_instance, routing_cost

    module_name, model_code, label = GUROBI_METHODS[method]
    module = importlib.import_module(module_name)
    captured = []

    def on_model(m):
        m.setParam("TimeLimit", time_limit)
        m.setParam("Threads", threads)
        m.setParam("NodefileStart", NODEFILE_START_GB)
        captured.append(m)

    real_gp = module.gp
    module.gp = _GpProxy(gp, on_model)
    os.makedirs(SOLUTIONS_DIR, exist_ok=True)
    t0 = time.perf_counter()
    try:
        module.solve_instance(num_customers=n, instance_id=instance_id, h_val=h,
                              output_dir=SOLUTIONS_DIR, verbose=False, gurobi_log=False)
    finally:
        module.gp = real_gp
    wall = time.perf_counter() - t0
    if not captured:
        raise RuntimeError(f"{module_name}.solve_instance no creó ningún modelo Gurobi")
    m = captured[-1]

    status = STATUS_NAMES.get(m.Status, f"status_{m.Status}")
    rec = {
        "model": model_code,
        "status": status,
        "optimal": m.Status == gp.GRB.OPTIMAL,
        "timeSec": round(m.Runtime, 4),
        "buildSec": round(max(0.0, wall - m.Runtime), 4),
        "solCount": m.SolCount,
        "nodeCount": round(m.NodeCount),
        "numVars": m.NumVars,
        "numBinVars": m.NumBinVars,
        "numConstrs": m.NumConstrs,
        "objective": None,
        "bound": None,
        "gapPct": None,
        "totalDistance": None,
        "handlingCost": None,
        "tour": None,
    }
    try:
        rec["bound"] = round(m.ObjBound, 6)
    except gp.GurobiError:
        pass
    if m.SolCount > 0:
        rec["objective"] = round(m.ObjVal, 6)
        rec["gapPct"] = round(m.MIPGap * 100.0, 6) if math.isfinite(m.MIPGap) else None
        tour = extract_tour(m, n)
        if tour:
            inst = load_instance(n, instance_id)
            dist = routing_cost(tour, inst["c"])
            rec["tour"] = tour
            rec["totalDistance"] = dist
            rec["handlingCost"] = round(m.ObjVal - dist, 6)
    m.dispose()
    return rec


# =====================================================================
# ALGORITMO 2.1 + DP (DOS FASES) E ILS
# =====================================================================
def run_dp(n, instance_id, h):
    from tsppd_h_alg21_dp import load_instance, solve_handling
    from tsppd_h_alg42_ils import Evaluator, full_tour, relocate_depot, tsp_tour

    inst = load_instance(n, instance_id)
    t0 = time.perf_counter()
    cycle, tsp_method = tsp_tour(inst["c"], n)
    t_tsp = time.perf_counter() - t0
    ev = Evaluator(inst, h, h)
    options = [relocate_depot(cycle, ev), relocate_depot(cycle[::-1], ev)]
    best = min(options, key=lambda o: (round(o["cost"], 9), o["shift"]))
    total = time.perf_counter() - t0

    # Tiempo de una sola llamada al Algoritmo 2.1 + DP sobre el tour elegido (promedio de DP_REPEATS)
    a = [0] + [inst["alpha"][v] for v in best["perm"]]
    b = [0] + [inst["beta"][v] for v in best["perm"]]
    t1 = time.perf_counter()
    for _ in range(DP_REPEATS):
        solve_handling(a, b, h, h)
    dp_ms = (time.perf_counter() - t1) * 1000.0 / DP_REPEATS

    return {
        "status": "heuristic",
        "optimal": False,
        "timeSec": round(total, 6),
        "tspTimeSec": round(t_tsp, 6),
        "tspMethod": tsp_method,
        "dpCalls": ev.dp_calls,
        "dpTimeMs": round(dp_ms, 6),
        "objective": round(best["cost"], 6),
        "totalDistance": best["routing"],
        "handlingCost": round(best["handling"], 6),
        "tour": full_tour(best["perm"]),
    }


def run_ils(n, instance_id, h, n_iter, d_ratio, seed, runs):
    from tsppd_h_alg42_ils import solve_instance

    data = solve_instance(num_customers=n, instance_id=instance_id, h_val=h, n_iter=n_iter, d_ratio=d_ratio,
                          seed=seed, runs=runs, save=False, verbose=False)
    rs = data["runsSummary"]
    run_times = rs["timesSec"]
    # Tiempo de una ejecución ILS-2dir = búsqueda en ambas direcciones + construcción inicial (TSP, compartida)
    init_sec = max(0.0, data["timeSec"] - sum(run_times))
    per_run = [t + init_sec for t in run_times]
    return {
        "status": "heuristic",
        "optimal": False,
        "timeSec": round(sum(per_run) / len(per_run), 6),
        "timeMinSec": round(min(per_run), 6),
        "timeMaxSec": round(max(per_run), 6),
        "totalTimeSec": data["timeSec"],
        "runs": runs,
        "nRand": data["params"]["nRand"],
        "tspMethod": data["params"]["tspMethod"],
        "objective": round(rs["min"], 6),
        "objectiveMean": rs["mean"],
        "objectiveMax": rs["max"],
        "objective1dir": round(min(rs["oneDirObjectives"]), 6),
        "objectives": rs["objectives"],
        "hitsBest": rs["hitsBest"],
        "totalDistance": data["best"]["totalDistance"],
        "handlingCost": data["best"]["handlingCost"],
        "tour": data["best"]["tour"],
    }


def run_task(task):
    """Se ejecuta en un proceso del pool. Nunca lanza: los errores quedan registrados."""
    method, n, instance_id, h, opts = task
    base = {
        "key": task_key(method, n, instance_id, h),
        "method": method,
        "label": METHOD_LABELS[method],
        "numCustomers": n,
        "instanceId": instance_id,
        "h": h,
        "config": opts["signature"],
        # Condiciones de carga durante la medición (procesos simultáneos × hilos de Gurobi)
        "parallel": {"workers": opts.get("workers"), "threads": opts["threads"] if method in GUROBI_METHODS else 1},
    }
    try:
        if method in GUROBI_METHODS:
            rec = run_gurobi(method, n, instance_id, h, opts["timeLimit"], opts["threads"])
        elif method == "dp":
            rec = run_dp(n, instance_id, h)
        else:
            rec = run_ils(n, instance_id, h, opts["ilsIters"], opts["ilsD"], opts["ilsSeed"], opts["ilsRuns"])
    except Exception as exc:  # noqa: BLE001 — se registra y se continúa con la grilla
        rec = {"status": "error", "optimal": False, "error": f"{type(exc).__name__}: {exc}"}
    rec["finishedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {**base, **rec}


def _worker_init():
    try:
        import gurobipy as gp
        gp.setParam("OutputFlag", 0)
    except Exception:
        pass


# =====================================================================
# REGISTROS Y CONSOLIDADO
# =====================================================================
def read_records():
    """Último registro por clave (las líneas posteriores reemplazan a las anteriores)."""
    records = {}
    if not os.path.exists(RECORDS_FILE):
        return records
    with open(RECORDS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            records[rec["key"]] = rec
    return records


def environment_meta(args):
    try:
        import gurobipy as gp
        gurobi_version = ".".join(str(x) for x in gp.gurobi.version())
    except Exception:
        gurobi_version = None
    return {
        "cpu": cpu_name(),
        "logicalCpus": os.cpu_count(),
        "os": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
        "gurobi": gurobi_version,
        "timeLimitSec": args.time_limit,
        "threads": args.threads,
        "workers": args.workers,
        "ils": {"nIter": args.ils_iters, "d": args.ils_d, "seed": args.ils_seed, "runs": args.ils_runs},
        "dpRepeats": DP_REPEATS,
        # Grilla diseñada (la página calcula el avance con ella)
        "grid": {"customers": sorted(args.customers), "ids": sorted(args.ids), "h": sorted(args.h),
                 "methods": [m for m in METHODS if m in args.methods]},
        # Mayor N en que se ejecuta el Modelo General (None = sin tope); sobre él, registros «skipped»
        "generalMaxN": args.general_max_n if args.general_max_n > 0 else None,
    }


def skipped_record(n, instance_id, h, max_n):
    """Registro de un Modelo General que no se ejecuta por su alto costo computacional (N > max_n)."""
    return {
        "key": task_key("general", n, instance_id, h),
        "method": "general",
        "label": METHOD_LABELS["general"],
        "numCustomers": n,
        "instanceId": instance_id,
        "h": h,
        "config": {"generalMaxN": max_n},
        "model": GUROBI_METHODS["general"][1],
        "status": "skipped",
        "optimal": False,
        "reason": f"{SKIP_REASON}; solo se ejecuta hasta N = {max_n}.",
        "objective": None,
        "timeSec": None,
        "finishedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def write_summary(meta):
    records = sorted(read_records().values(),
                     key=lambda r: (r["h"], r["numCustomers"], r["instanceId"], METHODS.index(r["method"])))
    data = {
        "title": "Benchmark de tiempos TSPPD-H — Gurobi (General, Políticas 1-3) vs Algoritmo 2.1 + DP e ILS",
        "reference": "Instancias de Battarra, Erdoğan, Laporte & Vigo (2010), Transportation Science 44(3), "
                     "derivadas de e_vigo (Gendreau, Laporte & Vigo 1999) con la Ec. (15).",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "meta": meta,
        "methods": [{"key": k, "label": METHOD_LABELS[k]} for k in METHODS],
        "count": len(records),
        "records": records,
    }
    tmp = f"{SUMMARY_FILE}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    # En Windows el reemplazo falla si otro proceso (p. ej. la Página Web) tiene el archivo abierto:
    # se reintenta y, si persiste, se deja para el próximo registro sin detener el benchmark.
    for attempt in range(10):
        try:
            os.replace(tmp, SUMMARY_FILE)
            break
        except PermissionError:
            time.sleep(0.2 * (attempt + 1))
    else:
        print(f"[AVISO] No se pudo actualizar {SUMMARY_FILE}; se reintentará con el siguiente registro.")
        try:
            os.remove(tmp)
        except OSError:
            pass
    return data


def describe(rec):
    if rec["status"] == "error":
        return f"ERROR {rec.get('error')}"
    if rec["status"] == "skipped":
        return "no se ejecuta (alto costo computacional)"
    z = rec.get("objective")
    z_txt = f"z={z:.2f}" if z is not None else "sin solución"
    extra = ""
    if rec["method"] in GUROBI_METHODS and not rec.get("optimal") and rec.get("gapPct") is not None:
        extra = f" gap={rec['gapPct']:.2f}%"
    return f"{rec['status']:<10} {z_txt}{extra} t={rec.get('timeSec', 0):.2f}s"


# =====================================================================
# MAIN
# =====================================================================
def main():
    parser = argparse.ArgumentParser(description="Benchmark de tiempos: Gurobi (General, P1-P3) vs Alg. 2.1 + DP e ILS")
    parser.add_argument("--customers", type=int, nargs="+", default=CUSTOMERS, help=f"|Vc| (default: {CUSTOMERS})")
    parser.add_argument("--ids", type=int, nargs="+", default=INSTANCE_IDS, help="IDs de instancia (default: 1..10)")
    parser.add_argument("--h", type=float, nargs="+", default=H_VALUES, help=f"Valores de h (default: {H_VALUES})")
    parser.add_argument("--methods", nargs="+", default=METHODS, choices=METHODS, help="Métodos a ejecutar")
    parser.add_argument("--time-limit", type=float, default=TIME_LIMIT, help=f"TimeLimit de Gurobi en s (default: {TIME_LIMIT})")
    parser.add_argument("--threads", type=int, default=THREADS, help=f"Hilos de Gurobi por proceso (default: {THREADS})")
    parser.add_argument("--workers", type=int, default=WORKERS, help=f"Procesos en paralelo (default: {WORKERS})")
    parser.add_argument("--ils-iters", type=int, default=ILS_ITERS)
    parser.add_argument("--ils-d", type=float, default=ILS_D)
    parser.add_argument("--ils-seed", type=int, default=ILS_SEED)
    parser.add_argument("--ils-runs", type=int, default=ILS_RUNS)
    parser.add_argument("--general-max-n", type=int, default=GENERAL_MAX_N,
                        help=f"Mayor N en que se ejecuta el Modelo General; con N mayor se registra como no ejecutado "
                             f"por su alto costo computacional (0 = sin tope; default: {GENERAL_MAX_N})")
    parser.add_argument("--force", action="store_true", help="Repetir también las ejecuciones ya registradas")
    parser.add_argument("--consolidate", action="store_true", help="Solo regenerar benchmark_tiempos.json")
    args = parser.parse_args()

    os.makedirs(BENCH_DIR, exist_ok=True)
    meta = environment_meta(args)
    if args.consolidate:
        data = write_summary(meta)
        print(f"[OK] {data['count']} registros consolidados en {SUMMARY_FILE}")
        return

    done = read_records()
    tasks = []
    skipped = []
    # Primero las instancias pequeñas: los resultados útiles aparecen antes
    for n in sorted(args.customers):
        for h in args.h:
            for instance_id in args.ids:
                for method in args.methods:
                    prev = done.get(task_key(method, n, instance_id, h))
                    if method == "general" and 0 < args.general_max_n < n:
                        # Reemplaza (última línea gana) cualquier ejecución previa con N sobre el tope
                        if not (prev and prev.get("status") == "skipped"
                                and prev.get("config", {}).get("generalMaxN") == args.general_max_n):
                            skipped.append(skipped_record(n, instance_id, h, args.general_max_n))
                        continue
                    sig = config_signature(method, args)
                    if prev and not args.force and prev.get("status") != "error" and prev.get("config") == sig:
                        continue
                    opts = {"signature": sig, "timeLimit": args.time_limit, "threads": args.threads,
                            "workers": args.workers,
                            "ilsIters": args.ils_iters, "ilsD": args.ils_d, "ilsSeed": args.ils_seed,
                            "ilsRuns": args.ils_runs}
                    tasks.append((method, n, instance_id, h, opts))

    if skipped:
        with open(RECORDS_FILE, "a", encoding="utf-8") as f:
            for rec in skipped:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        write_summary(meta)

    print("=" * 80)
    print(f" BENCHMARK TSPPD-H · {len(tasks)} ejecuciones pendientes ({len(done)} ya registradas)")
    print(f" CPU: {meta['cpu']} | Gurobi {meta['gurobi']} | TimeLimit {args.time_limit:g} s | "
          f"{args.workers} procesos × {args.threads} hilos")
    if args.general_max_n > 0:
        print(f" Modelo General solo hasta N = {args.general_max_n} (alto costo computacional); "
              f"{len(skipped)} registros nuevos como no ejecutados")
    print("=" * 80)
    if not tasks:
        write_summary(meta)
        return

    t_start = time.perf_counter()
    ctx = get_context("spawn")
    with ctx.Pool(processes=max(1, args.workers), initializer=_worker_init, maxtasksperchild=1) as pool:
        for k, rec in enumerate(pool.imap_unordered(run_task, tasks), 1):
            with open(RECORDS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            write_summary(meta)
            elapsed = time.perf_counter() - t_start
            print(f"[{k:>4}/{len(tasks)}] {elapsed/60:7.1f} min | {rec['method']:<7} N={rec['numCustomers']:<3} "
                  f"ID={rec['instanceId']:<2} h={rec['h']:<4g} | {describe(rec)}", flush=True)

    print(f"[OK] Benchmark terminado en {(time.perf_counter() - t_start)/60:.1f} min → {SUMMARY_FILE}")


if __name__ == "__main__":
    main()

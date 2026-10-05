"""
Extrae del PDF de Erdoğan et al. (2012) los resultados publicados que sirven de referencia
para el benchmark de metaheurísticas a gran escala (Página Web 12, sección «Metaheurísticas»).

    · Tablas 8 y 9 — por instancia (|Vc| = 20…200, Id = 1…10): Best, solución inicial
      (1 dir. / 2 dir.) e ILS / ITS con evaluación heurística y exacta (1 dir. / 2 dir.).
    · Tabla 2 — ILS-1dir e ITS-1dir (evaluación exacta): desviación promedio y segundos por |Vc|.
    · Tabla 3 — desviación promedio de ILS e ITS (exactos) en 1 y 2 direcciones por |Vc|.
    · Fila «Time (s)» de la Tabla 9 — segundos promedio de cada columna de ILS / ITS.

Importante (verificado contra la Tabla 3): en las Tablas 8 y 9 la columna «2 dir.» es la
corrida que parte del tour TSP INVERTIDO por sí sola; el resultado «X-2dir» de las Tablas 2–3
es el mínimo de las columnas «1 dir.» y «2 dir.».

El texto se lee con PyMuPDF (sin OCR) agrupando las palabras de cada página por renglón.
Antes de escribir el JSON se valida:
    1. 100 filas completas (10 tamaños × 10 instancias) con 11 valores cada una.
    2. Best y solución inicial coinciden con las Tablas 6 y 7 (otra copia de las mismas cifras).
    3. Recalculando con las Tablas 8–9, las desviaciones de ILS/ITS exactos reproducen las
       Tablas 2 y 3 (tolerancia ±0,006 por el redondeo a dos decimales del paper).

Uso:
    python notebooks/erdogan2012/paper_tables.py
Escribe Outputs/BenchmarkErdogan2012/paper_erdogan2012.json.
"""
import os
import sys
import json
import re

import pymupdf

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF = os.path.join(BASE_DIR, "papers", "Erdogan2012.pdf")
OUT_DIR = os.path.join(BASE_DIR, "Outputs", "BenchmarkErdogan2012")
OUT_FILE = os.path.join(OUT_DIR, "paper_erdogan2012.json")

SIZES = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200]
# Columnas de las Tablas 8 y 9 (después de |Vc| e Id.)
COLUMNS = ["best", "init1", "init2", "ilsH1", "ilsH2", "ilsE1", "ilsE2", "itsH1", "itsH2", "itsE1", "itsE2"]
NUM = re.compile(r"^\d+\.\d+$")
INT = re.compile(r"^\d+$")


def page_rows(page):
    """Palabras de la página agrupadas por renglón (misma línea base ±2 pt) y ordenadas en x."""
    words = page.get_text("words")
    rows = []
    for w in sorted(words, key=lambda w: (round(w[3], 0), w[0])):
        y = w[3]
        if rows and abs(rows[-1]["y"] - y) <= 2.0:
            rows[-1]["words"].append(w)
        else:
            rows.append({"y": y, "words": [w]})
    out = []
    for r in rows:
        ws = sorted(r["words"], key=lambda w: w[0])
        out.append({"y": r["y"], "x0": ws[0][0], "tokens": [w[4] for w in ws], "xs": [w[0] for w in ws]})
    return out


def table_rows(doc, page_idx, title, n_values, column_split=None, size=None):
    """
    Filas numéricas de la tabla que empieza en el renglón `title` de la página. Cada fila es
    [|Vc|?] Id v1 … vk (|Vc| solo aparece en la primera fila del grupo). Si la página tiene
    texto a dos columnas, `column_split` limita la búsqueda a las palabras con x ≥ ese valor.
    `size` es el |Vc| vigente al empezar (la continuación de una tabla hereda el de la página anterior).
    """
    rows = page_rows(doc[page_idx])
    start = next(i for i, r in enumerate(rows) if " ".join(r["tokens"]).startswith(title))
    parsed = []
    for r in rows[start + 1:]:
        toks = r["tokens"]
        if column_split is not None:
            toks = [t for t, x in zip(r["tokens"], r["xs"]) if x >= column_split]
        if not toks:
            continue
        if toks[0].startswith("Time") or toks[0] == "G." or toks[0].startswith("Table"):
            break
        nums = [t for t in toks if NUM.match(t)]
        if len(nums) != n_values:
            continue
        head = [t for t in toks if not NUM.match(t)]
        if len(head) == 2 and all(INT.match(t) for t in head):
            size = int(head[0])
            iid = int(head[1])
        elif len(head) == 1 and INT.match(head[0]):
            iid = int(head[0])
        else:
            continue
        parsed.append((size, iid, [float(x) for x in nums]))
    return parsed


def time_row(doc, page_idx, title):
    rows = page_rows(doc[page_idx])
    start = next(i for i, r in enumerate(rows) if " ".join(r["tokens"]).startswith(title))
    for r in rows[start + 1:]:
        if r["tokens"] and r["tokens"][0] == "Time":
            return [float(t) for t in r["tokens"] if NUM.match(t)]
    raise ValueError(f"Sin fila Time en {title}")


def find_page(doc, title):
    for i, page in enumerate(doc):
        for r in page_rows(page):
            if " ".join(r["tokens"]).startswith(title):
                return i
    raise ValueError(f"No se encontró «{title}»")


def find_caption(doc, title, caption):
    """
    Página, renglón y x del título de una tabla en una página a dos columnas: «Table k» seguido,
    en el renglón de abajo y a la misma x, por el epígrafe `caption` (así se descartan las menciones
    de la tabla dentro del texto).
    """
    word, num = title.split()
    for i, page in enumerate(doc):
        rows = page_rows(page)
        for ri, r in enumerate(rows):
            for k, (t, x) in enumerate(zip(r["tokens"], r["xs"])):
                if t != word or k + 1 >= len(r["tokens"]) or r["tokens"][k + 1] != num:
                    continue
                for nxt in rows[ri + 1:ri + 3]:
                    near = [tt for tt, xx in zip(nxt["tokens"], nxt["xs"]) if abs(xx - x) < 3]
                    if near and near[0] == caption.split()[0]:
                        line = " ".join(tt for tt, xx in zip(nxt["tokens"], nxt["xs"]) if xx >= x - 3)
                        if line.startswith(caption):
                            return i, ri, x
    raise ValueError(f"No se encontró «{title}» con epígrafe «{caption}»")


def summary_table(doc, title, caption, n_values):
    """Tablas 2 y 3: renglones «|Vc| v1 … vk» (página a dos columnas: se toma la columna de la tabla)."""
    p, start, title_x = find_caption(doc, title, caption)
    rows = page_rows(doc[p])
    split = title_x - 5
    out = {}
    for r in rows[start + 1:]:
        toks = [t for t, x in zip(r["tokens"], r["xs"]) if x >= split and x < split + 260]
        if not toks:
            continue
        if toks[0] == "Avg.":
            out["avg"] = [float(t) for t in toks[1:] if NUM.match(t)]
            break
        if INT.match(toks[0]) and int(toks[0]) in SIZES:
            vals = [float(t) for t in toks[1:] if NUM.match(t)]
            if len(vals) == n_values:
                out[int(toks[0])] = vals
    return out


def main():
    doc = pymupdf.open(PDF)

    # ── Tablas 8 y 9 ────────────────────────────────────────────────────────
    rows = []
    for title in ("Table 8", "Table 9"):
        p = find_page(doc, title)
        rows += table_rows(doc, p, title, len(COLUMNS))
    instances = [{"n": n, "id": iid, **dict(zip(COLUMNS, vals))} for n, iid, vals in rows]
    keys = {(r["n"], r["id"]) for r in instances}
    expected = {(n, i) for n in SIZES for i in range(1, 11)}
    if keys != expected or len(instances) != 100:
        raise SystemExit(f"[ERROR] Tablas 8–9: {len(instances)} filas; faltan {sorted(expected - keys)}")
    times = time_row(doc, find_page(doc, "Table 9"), "Table 9")
    if len(times) != 8:
        raise SystemExit(f"[ERROR] Fila Time de la Tabla 9: {times}")

    # ── Tablas 6 y 7: misma Best y solución inicial ─────────────────────────
    t67 = []
    for title in ("Table 6", "Table 7"):
        p = find_page(doc, title)
        first = table_rows(doc, p, title, 15)
        # La continuación de cada tabla está en la página siguiente y sigue con el último |Vc|
        t67 += first + table_rows(doc, p + 1, f"{title} (continued", 15, size=first[-1][0])
    t67 = {(n, i): vals for n, i, vals in t67}
    if set(t67) != expected:
        raise SystemExit(f"[ERROR] Tablas 6–7: faltan {sorted(expected - set(t67))}")
    mism = [(k, v[:3]) for k, v in t67.items()
            for r in instances if (r["n"], r["id"]) == k and [r["best"], r["init1"], r["init2"]] != v[:3]]
    if mism:
        raise SystemExit(f"[ERROR] Best / solución inicial difieren entre Tablas 6–7 y 8–9: {mism[:5]}")

    # ── Tablas 2 y 3 ────────────────────────────────────────────────────────
    # TS dev, TS t, ILS dev, ILS t, ITS dev, ITS t
    table2 = summary_table(doc, "Table 2", "Comparison of the performances", 6)
    # TS 1d, TS 2d, ILS 1d, ILS 2d, ITS 1d, ITS 2d
    table3 = summary_table(doc, "Table 3", "Comparison of the single", 6)
    for name, t in (("Tabla 2", table2), ("Tabla 3", table3)):
        if set(k for k in t if k != "avg") != set(SIZES) or "avg" not in t:
            raise SystemExit(f"[ERROR] {name} incompleta: {sorted(k for k in t if k != 'avg')}")

    def dev(z, best):
        return (z - best) / best * 100.0

    checks = 0
    worst = 0.0
    for n in SIZES:
        group = [r for r in instances if r["n"] == n]
        mean = lambda f: sum(f(r) for r in group) / len(group)
        recomputed = {
            "ILS-1dir": mean(lambda r: dev(r["ilsE1"], r["best"])),
            "ILS-2dir": mean(lambda r: dev(min(r["ilsE1"], r["ilsE2"]), r["best"])),
            "ITS-1dir": mean(lambda r: dev(r["itsE1"], r["best"])),
            "ITS-2dir": mean(lambda r: dev(min(r["itsE1"], r["itsE2"]), r["best"])),
        }
        published = {
            "ILS-1dir": [table2[n][2], table3[n][2]],
            "ILS-2dir": [table3[n][3]],
            "ITS-1dir": [table2[n][4], table3[n][4]],
            "ITS-2dir": [table3[n][5]],
        }
        for k, vals in published.items():
            for v in vals:
                diff = abs(round(recomputed[k], 2) - v)
                worst = max(worst, abs(recomputed[k] - v))
                checks += 1
                if diff > 0.006:
                    raise SystemExit(f"[ERROR] |Vc|={n} {k}: Tablas 8–9 dan {recomputed[k]:.4f} % y el paper publica {v} %")

    by_n = {}
    for n in SIZES:
        by_n[str(n)] = {
            "ilsExact1dirDevPct": table2[n][2],
            "ilsExact1dirTimeSec": table2[n][3],
            "itsExact1dirDevPct": table2[n][4],
            "itsExact1dirTimeSec": table2[n][5],
            "ilsExact2dirDevPct": table3[n][3],
            "itsExact2dirDevPct": table3[n][5],
        }

    data = {
        "source": "Erdoğan, Battarra, Laporte & Vigo (2012). Metaheuristics for the traveling salesman problem "
                  "with pickups, deliveries and handling costs. Computers & Operations Research 39, 1074–1086.",
        "pdf": "papers/Erdogan2012.pdf",
        "machine": "Intel Core 2 Quad 2.83 GHz, código en C (§5)",
        "h": "h_a = h_b = h con h·|Vc| = 20 (§5)",
        "params": {"nIter": 200, "d": 0.10, "tabuRatio": 0.5, "nIterIts": "⌊√Niter⌋ = 14"},
        "columns": {
            "best": "Best: mejor solución conocida (mínimo de todas las corridas del paper, incluido TS)",
            "init1": "Solución inicial, tour TSP (Lin–Kernighan) con el depósito reubicado",
            "init2": "Solución inicial desde el tour TSP invertido",
            "ilsH1": "ILS heurístico, 200 iteraciones, desde el tour original",
            "ilsH2": "ILS heurístico, 200 iteraciones, desde el tour invertido",
            "ilsE1": "ILS exacto, 200 iteraciones, desde el tour original",
            "ilsE2": "ILS exacto, 200 iteraciones, desde el tour invertido",
            "itsH1": "ITS heurístico, desde el tour original",
            "itsH2": "ITS heurístico, desde el tour invertido",
            "itsE1": "ITS exacto, desde el tour original",
            "itsE2": "ITS exacto, desde el tour invertido",
        },
        "note": "En las Tablas 8–9 «2 dir.» es la corrida desde el tour invertido por sí sola; X-2dir = min(1 dir., 2 dir.) "
                "(así se reproducen las Tablas 2 y 3).",
        "instances": instances,
        "timeRowTable9": {
            "ilsH1": times[0], "ilsH2": times[1], "ilsE1": times[2], "ilsE2": times[3],
            "itsH1": times[4], "itsH2": times[5], "itsE1": times[6], "itsE2": times[7],
        },
        "byN": by_n,
        "averages": {
            "ilsExact1dirDevPct": table2["avg"][2], "ilsExact1dirTimeSec": table2["avg"][3],
            "itsExact1dirDevPct": table2["avg"][4], "itsExact1dirTimeSec": table2["avg"][5],
            "ilsExact2dirDevPct": table3["avg"][3], "itsExact2dirDevPct": table3["avg"][5],
        },
        "validation": {
            "tables67Match": True,
            "deviationChecks": checks,
            "maxAbsDiffPct": round(worst, 4),
        },
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[OK] 100 instancias de las Tablas 8–9; Best e inicial = Tablas 6–7; {checks} desviaciones de las Tablas 2–3 "
          f"reproducidas (máx. |Δ| = {worst:.4f} pp).")
    print(f"     Fila Time (s) de la Tabla 9: {times}")
    print(f"[OK] {OUT_FILE}")


if __name__ == "__main__":
    main()

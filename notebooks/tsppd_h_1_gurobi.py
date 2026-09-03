import os
import sys
import math
import json
import argparse
import gurobipy as gp
from gurobipy import GRB

# Asegurar codificación UTF-8 en stdout y stderr para soportar caracteres griegos y símbolos en Windows
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
# CONFIGURACIÓN DE PARÁMETROS PARA REPLICAR EL PAPER (POLÍTICA 1)
# =====================================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
COST_FILE = os.path.join(BASE_DIR, "e_vigo", "ecosti.dat")
DATA_FILE = os.path.join(BASE_DIR, "e_vigo", "edati.dat")
OUTPUTS_DIR = os.path.join(BASE_DIR, "Outputs")
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

def format_truck_diagram(slots):
    """Genera una barra visual compacta del compartimiento del camión: Puerta -> Fondo"""
    chars = []
    for s in slots:
        if s == "A":
            chars.append("α")
        elif s == "B":
            chars.append("β")
        else:
            chars.append("·")
    return f"[Puerta] |{' '.join(chars)}| [Fondo]"

def format_slot_ranges(slot_list):
    """Formatea una lista de slots como rangos legibles, e.g. [1, 2, 3, 5] -> '1-3, 5'"""
    if not slot_list:
        return "Ninguno"
    ranges = []
    start = slot_list[0]
    prev = slot_list[0]
    for s in slot_list[1:]:
        if s == prev + 1:
            prev = s
        else:
            ranges.append(f"{start}-{prev}" if start != prev else f"{start}")
            start = s
            prev = s
    ranges.append(f"{start}-{prev}" if start != prev else f"{start}")
    return ", ".join(ranges)

def generate_step_explanation(step_idx, total_steps, from_node, to_node, dist, deliver_a, pickup_b, a_on_truck, b_on_truck, handling_count, handling_cost, h_val):
    """Genera una explicación detallada en lenguaje natural para cada paso de la ruta bajo Política 1"""
    if step_idx == 0:
        if handling_count > 0:
            handling_txt = f" ⚠️ Se requirieron {handling_count} operaciones de manipulación (handling) con costo adicional de {handling_cost:.2f}."
        else:
            handling_txt = " Como el camión sale cargado solo con mercancía α desde el depósito, no hay mercancía β obstruyendo la compuerta."
        return (
            f"<strong>Paso 1 — Depósito (Nodo 0) → {to_node['label']}:</strong> El camión recorre {dist} km bajo el modelo <strong>TSPPD-H_1 (Política 1)</strong>. "
            f"Al llegar entrega <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span>.{handling_txt} "
            f"Posteriormente recolecta <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> ubicándolas estrictamente en la compuerta trasera (rear) según la Política 1."
        )
    elif step_idx == total_steps - 1:
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → Depósito (Nodo 0):</strong> El camión regresa al depósito "
            f"recorriendo {dist} km transportando la totalidad de la mercancía recolectada (<span style='color:#06b6d4;font-weight:600;'>{b_on_truck} unidades β</span>). "
            f"<strong>¡Tour completado bajo Política 1 (TSPPD-H_1)!</strong>"
        )
    else:
        if deliver_a > 0 and handling_count > 0:
            handling_txt = (
                f" ⚠️ <strong>Conflicto LIFO en Puerta (Política 1):</strong> Toda la carga β a bordo ({handling_count} unidades) se encontraba "
                f"en la compuerta trasera obstruyendo el acceso a la mercancía α en el fondo. Se evacuaron temporalmente y se recargaron "
                f"({handling_count} operaciones × h={h_val} = {handling_cost:.2f} costo de manejo)."
            )
        elif deliver_a > 0 and handling_count == 0:
            handling_txt = " No se requirió manipulación ya que no había mercancía β acumulada en la compuerta."
        else:
            handling_txt = " Como este cliente no solicitó entregas α (demanda α = 0), no fue necesario mover la carga β de la compuerta (Costo de handling: $0.00)."
        
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → {to_node['label']}:</strong> Tramo de {dist} km. "
            f"Se entregan <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span>.{handling_txt} "
            f"Luego se cargan <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> en la compuerta trasera."
        )

def print_detailed_schedule(tour, c, alpha, beta, Q, positions, h_val, steps, total_dist, total_handling_cost, obj_val, instance_id, num_customers):
    """Imprime en la salida estándar el reporte detallado de carga, descarga y handling para Política 1"""
    print("\n" + "="*80)
    print(f" DETALLE DE CARGA, DESCARGA Y HANDLING POR CLIENTE (TSPPD-H_1 - POLÍTICA 1)")
    print(f" Instancia ID: {instance_id} | Clientes: {num_customers} | Capacidad Q: {Q} | h = {h_val}")
    print(f" Ruta óptima: {' -> '.join('Depósito (0)' if node == 0 else f'Cliente {node}' for node in tour)}")
    print("="*80)

    # 1. SALIDA DEL DEPÓSITO
    first_step = steps[0]
    first_cust = first_step["to"]
    total_alpha_init = sum(alpha[cust] for cust in range(1, num_customers + 1))
    slots_init = first_step["slotsArrival"]
    
    print("\n[PASO 1] SALIDA DESDE EL DEPÓSITO (Nodo 0)")
    print("-" * 80)
    print(f"• Carga inicial en depósito: {total_alpha_init} objetos tipo α (entregas para los {num_customers} clientes)")
    print(f"• Objetos tipo β a bordo: 0 objetos (compuerta libre)")
    print(f"• Ocupación inicial: {total_alpha_init}/{Q} ({total_alpha_init/Q*100:.1f}%)")
    print(f"• Compartimiento inicial (Puerta -> Fondo):")
    print(f"  {format_truck_diagram(slots_init)}")
    print(f"• Rumbo hacia: Cliente {first_cust} (Distancia: {first_step['distance']} km)")

    # 2. CLIENTES EN LA RUTA
    for step in steps[:-1]:
        idx = step["stepIndex"] + 1
        u_n = step["from"]
        v_n = step["to"]
        dist = step["distance"]
        del_a = step["deliverA"]
        pick_b = step["pickupB"]
        
        slots_in = step["slotsArrival"]
        alpha_in = [k for k in positions if slots_in[k-1] == "A"]
        beta_in = [k for k in positions if slots_in[k-1] == "B"]
        empty_in = [k for k in positions if slots_in[k-1] == "EMPTY"]
        occ_in = len(alpha_in) + len(beta_in)
        
        slots_out = step["slotsDeparture"]
        alpha_out = [k for k in positions if slots_out[k-1] == "A"]
        beta_out = [k for k in positions if slots_out[k-1] == "B"]
        empty_out = [k for k in positions if slots_out[k-1] == "EMPTY"]
        occ_out = len(alpha_out) + len(beta_out)
        
        succ_n = step["succ"]
        succ_label = "Depósito (Nodo 0)" if succ_n == 0 else f"Cliente {succ_n}"
        
        re_b = step["rehandledB"]
        num_re = len(re_b)
        h_cost = step["handlingCost"]
        del_slots = step["deliveredSlots"]
        new_b_slots = step["newBSlots"]
        
        print("\n" + "="*80)
        print(f"[PARADA {idx}] CLIENTE {v_n} (Tramo: Nodo {u_n} -> Nodo {v_n} | Distancia: {dist} km)")
        print("-" * 80)
        print(f"• Demandas del Cliente {v_n}:")
        print(f"  - Entrega (tipo α):     {del_a} unidades")
        print(f"  - Recolección (tipo β): {pick_b} unidades")
        
        print(f"\n1. ESTADO DEL CAMIÓN AL LLEGAR:")
        print(f"   - Ocupación: {occ_in}/{Q} unidades ({occ_in/Q*100:.1f}%)")
        print(f"   - Objetos tipo α (fondo): {len(alpha_in)} unidades (Slots: {format_slot_ranges(alpha_in)})")
        print(f"   - Objetos tipo β (puerta): {len(beta_in)} unidades (Slots: {format_slot_ranges(beta_in)})")
        print(f"   - Slots vacíos intermedios: {len(empty_in)} (Slots: {format_slot_ranges(empty_in)})")
        print(f"   - Compartimiento (Puerta -> Fondo):")
        print(f"     {format_truck_diagram(slots_in)}")
        
        print(f"\n2. OPERACIÓN DE DESCARGA:")
        print(f"   • Entrega definitiva al cliente:")
        print(f"     - Se entregan {del_a} unidades tipo α.")
        print(f"     - Slots entregados: {format_slot_ranges(del_slots)}")
        if num_re > 0:
            print(f"   • Descarga temporal obligatoria por Política 1 (Rear door blocked):")
            print(f"     - {num_re} unidades tipo β descargadas temporalmente para acceder a la carga α (Slots: {format_slot_ranges(re_b)}).")
        else:
            print(f"   • Descarga temporal:")
            print(f"     - ✅ Ninguna ({'no había mercancía β en compuerta' if len(beta_in) == 0 else 'no se requirió entrega de α'}).")
            
        print(f"\n3. MANIPULACIÓN (HANDLING):")
        if num_re > 0:
            print(f"   - Operaciones de re-handling: {num_re} unidades β")
            print(f"   - Costo de handling en esta parada: ${h_cost:.2f} ({num_re} ops × h={h_val})")
        else:
            print(f"   - Operaciones de re-handling: 0 unidades")
            print(f"   - Costo de handling: $0.00")
            
        print(f"\n4. OPERACIÓN DE CARGA:")
        if num_re > 0:
            print(f"   • Recarga de mercancía β temporal:")
            print(f"     - Se vuelven a ingresar las {num_re} unidades β.")
        print(f"   • Carga de recolección (nueva):")
        if pick_b > 0:
            print(f"     - Se cargan {pick_b} unidades tipo β recolectadas en los primeros slots de la compuerta.")
            print(f"     - Slots asignados: {format_slot_ranges(new_b_slots)}")
        else:
            print(f"     - No hubo recolección en este cliente.")
            
        print(f"\n5. ESTADO DEL CAMIÓN AL SALIR (Rumbo a {succ_label}):")
        print(f"   - Ocupación: {occ_out}/{Q} unidades ({occ_out/Q*100:.1f}%)")
        print(f"   - Objetos tipo α restantes (fondo): {len(alpha_out)} unidades (Slots: {format_slot_ranges(alpha_out)})")
        print(f"   - Objetos tipo β acumulados (puerta): {len(beta_out)} unidades (Slots: {format_slot_ranges(beta_out)})")
        print(f"   - Slots vacíos: {len(empty_out)} (Slots: {format_slot_ranges(empty_out)})")
        print(f"   - Compartimiento (Puerta -> Fondo):")
        print(f"     {format_truck_diagram(slots_out)}")

    # 3. LLEGADA AL DEPÓSITO
    last_step = steps[-1]
    u_last = last_step["from"]
    dist_last = last_step["distance"]
    slots_final = last_step["slotsArrival"]
    b_final_slots = [k for k in positions if slots_final[k-1] == "B"]
    
    print("\n" + "="*80)
    print(f"[PASO FINAL] LLEGADA AL DEPÓSITO (Nodo 0) — Fin del Recorrido (Política 1)")
    print("-" * 80)
    print(f"• Tramo final: Cliente {u_last} -> Depósito (Nodo 0) | Distancia: {dist_last} km")
    print(f"• Estado al llegar: 0 objetos tipo α | {len(b_final_slots)} objetos tipo β recolectados")
    print(f"• Ocupación al llegar: {len(b_final_slots)}/{Q} ({len(b_final_slots)/Q*100:.1f}%)")
    print(f"• Compartimiento al llegar (Puerta -> Fondo):")
    print(f"  {format_truck_diagram(slots_final)}")
    print(f"• DESCARGA FINAL EN DEPÓSITO:")
    print(f"  - Se descargan {len(b_final_slots)} objetos tipo β directamente desde la compuerta.")
    print(f"  - Slots descargados: {format_slot_ranges(b_final_slots)}")
    print(f"• Estado final del camión: Completamente vacío (0/{Q} unidades).")

    # 4. RESUMEN GLOBAL
    total_ops = sum(s.get("handlingCount", 0) for s in steps)
    total_a = sum(alpha[i] for i in range(1, num_customers + 1))
    total_b = sum(beta[i] for i in range(1, num_customers + 1))
    print("\n" + "="*80)
    print(f" RESUMEN GLOBAL DE LA SOLUCIÓN (TSPPD-H_1)")
    print("="*80)
    print(f"• Ruta óptima:              {' -> '.join(map(str, tour))}")
    print(f"• Distancia total de ruteo: {total_dist} km")
    print(f"• Costo total de handling:  ${total_handling_cost:.2f} ({total_ops} operaciones)")
    print(f"• Valor función objetivo:   ${obj_val:.2f}")
    print(f"• Total α entregadas:       {total_a} unidades")
    print(f"• Total β recolectadas:     {total_b} unidades")
    print("="*80 + "\n")

def solve_instance(num_customers=5, instance_id=1, h_val=0.1, output_dir=OUTPUTS_DIR, verbose=True, gurobi_log=False):
    """Resuelve una instancia del modelo TSPPD-H_1 (Política 1, Ecs. 17-25) y guarda la solución en Outputs/"""
    if verbose:
        print("\n" + "="*60)
        print(f" RESOLVIENDO MODELO TSPPD-H_1 (POLÍTICA 1, ECUACIONES 17-25)")
        print(f" Clientes: {num_customers} | Instancia ID: {instance_id} | h: {h_val}")
        print("="*60)
    
    # 1. Leer costos (Matriz de distancias)
    c_tokens = get_tokens(COST_FILE, instance_id)
    c_full = []
    idx = 0
    for i in range(51):
        row = []
        for j in range(51):
            row.append(int(c_tokens[idx]))
            idx += 1
        c_full.append(row)
        
    # 2. Leer demandas
    d_tokens = get_tokens(DATA_FILE, instance_id)
    p = [int(x) for x in d_tokens[:50]]
    
    # 3. Preparar parámetros 
    V = num_customers + 1
    nodes = list(range(V))
    customers = list(range(1, V))
    
    c = {}
    for i in nodes:
        for j in nodes:
            c[i,j] = c_full[i][j]
            
    alpha = {0: 0}
    beta = {0: 0}
    
    for i in customers:
        p_prime = max(1, p[i-1] % 20)
        b_val = math.floor(p_prime * ((i % 5) / 5.0))
        a_val = p_prime - b_val
        alpha[i] = a_val
        beta[i] = b_val
        
    alpha[0] = -sum(alpha[i] for i in customers)
    beta[0] = -sum(beta[i] for i in customers)
    
    # Capacidad Q y posiciones
    Q = max(sum(alpha[i] for i in customers), sum(beta[i] for i in customers))
    positions = list(range(1, Q + 1))
    
    h_a = h_val
    h_b = h_val
            
    # 4. Crear modelo en Gurobi (Ecuaciones 17 - 25)
    m = gp.Model(f"TSPPD-H1_C{num_customers}_ID{instance_id}_H{h_val}")
    m.setParam('OutputFlag', 1 if gurobi_log else 0)
    
    # --- Variables de Decisión ---
    # x[i, j]: binaria, indica si el vehículo recorre el arco (i, j)
    x = m.addVars(nodes, nodes, vtype=GRB.BINARY, name="x")
    # y[i, j]: continua >= 0, cantidad de mercancía tipo alfa a bordo en arco (i, j)
    y = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="y")
    # z[i, j]: continua >= 0, cantidad de mercancía tipo beta a bordo en arco (i, j)
    z = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="z")
    # u[i]: continua >= 0, para eliminación de subtoures (MTZ)
    u = m.addVars(nodes, vtype=GRB.CONTINUOUS, lb=0, name="u") 
    
    # Eliminar auto-bucles
    for i in nodes:
        m.addConstr(x[i,i] == 0)
        m.addConstr(y[i,i] == 0)
        m.addConstr(z[i,i] == 0)
        
    # Condiciones de frontera con el depósito:
    # No se devuelve mercancía alfa al depósito
    # No sale mercancía beta del depósito
    for j in nodes:
        m.addConstr(y[j, 0] == 0, name=f"no_a_depot_{j}")
        m.addConstr(z[0, j] == 0, name=f"no_b_from_depot_{j}")
            
    # --- Función Objetivo (Ecuación 17) ---
    # min sum c_ij * x_ij + sum_{j in Vc : alpha_j > 0} h_b * z_ij
    obj_routing = gp.quicksum(c[i,j] * x[i,j] for i in nodes for j in nodes if i != j)
    obj_handling = gp.quicksum(h_b * z[i,j] for i in nodes for j in customers if i != j and alpha[j] > 0)
    
    m.setObjective(obj_routing + obj_handling, GRB.MINIMIZE)
    
    # --- Restricciones ---
    # (18) y (19) Grado del grafo
    for i in nodes:
        m.addConstr(gp.quicksum(x[i,j] for j in nodes if j != i) == 1, name=f"deg_out_{i}")
        m.addConstr(gp.quicksum(x[j,i] for j in nodes if j != i) == 1, name=f"deg_in_{i}")
        
    # (20) Conservación de flujo para mercancía de entrega (alfa / y)
    for i in nodes:
        m.addConstr(
            gp.quicksum(y[j,i] for j in nodes if j != i) - 
            gp.quicksum(y[i,j] for j in nodes if j != i) == alpha[i],
            name=f"flow_a_{i}"
        )
                    
    # (21) Conservación de flujo para mercancía de recolección (beta / z)
    for i in nodes:
        m.addConstr(
            gp.quicksum(z[i,j] for j in nodes if j != i) - 
            gp.quicksum(z[j,i] for j in nodes if j != i) == beta[i],
            name=f"flow_b_{i}"
        )
                    
    # (22) Restricción de capacidad en cada arco
    for i in nodes:
        for j in nodes:
            if i != j:
                m.addConstr(y[i,j] + z[i,j] <= Q * x[i,j], name=f"cap_{i}_{j}")
                    
    # (23) Eliminación de Subtoures (MTZ)
    for i in customers:
        for j in customers:
            if i != j:
                m.addConstr(u[i] - u[j] + (V-1)*x[i,j] <= V - 2, name=f"mtz_{i}_{j}")

    # --- Optimizar ---
    m.optimize()
    
    # --- Procesar Resultados ---
    if m.Status == GRB.OPTIMAL:
        curr = 0
        tour = [0]
        while True:
            for j in nodes:
                if curr != j and x[curr,j].X > 0.5:
                    tour.append(j)
                    curr = j
                    break
            if curr == 0:
                break
        
        routing_cost = sum(c[tour[idx], tour[idx+1]] for idx in range(len(tour)-1))
        handling_cost = m.ObjVal - routing_cost
        
        # Construir estructura de nodos
        node_defs = []
        for i in nodes:
            node_defs.append({
                "id": i,
                "alpha": alpha[i] if i != 0 else sum(alpha[cust] for cust in customers),
                "beta": beta[i] if i != 0 else sum(beta[cust] for cust in customers),
                "isDepot": (i == 0),
                "label": "Depósito" if i == 0 else f"Cliente {i}"
            })
            
        # Matriz de distancias
        dist_matrix = []
        for i in nodes:
            row = []
            for j in nodes:
                row.append(c[i,j])
            dist_matrix.append(row)
            
        # Construir pasos detallados y dinámica de slots bajo Política 1:
        # En la Política 1:
        # Los ítems beta están al fondo de la carga respecto a la compuerta, o sea en la compuerta trasera (slots 1..z).
        # Los ítems alfa están hacia el fondo del camión (slots Q - y + 1 .. Q).
        steps = []
        total_steps = len(tour) - 1
        
        for s in range(total_steps):
            u_node = tour[s]
            v_node = tour[s+1]
            dist = c[u_node, v_node]
            
            del_a = alpha[v_node] if v_node != 0 else 0
            pick_b = beta[v_node] if v_node != 0 else 0
            
            # Carga a bordo en el arco (u_node -> v_node)
            y_arr = int(round(y[u_node, v_node].X))
            z_arr = int(round(z[u_node, v_node].X))
            
            # Construir slots al llegar:
            # Slots 1 .. z_arr -> "B" (cerca de la puerta)
            # Slots (z_arr + 1) .. (Q - y_arr) -> "EMPTY"
            # Slots (Q - y_arr + 1) .. Q -> "A" (hacia el fondo)
            slots_arr = ["EMPTY"] * Q
            for k_idx in range(z_arr):
                slots_arr[k_idx] = "B"
            for k_idx in range(Q - y_arr, Q):
                slots_arr[k_idx] = "A"
                
            # Operaciones de descarga y manejo en v_node
            rehandled_b = []
            delivered_a_slots = []
            new_b_slots = []
            h_count = 0
            h_cost = 0.0
            
            if v_node != 0:
                # Si se debe entregar alfa y hay mercancía beta en la compuerta:
                if del_a > 0:
                    if z_arr > 0:
                        rehandled_b = list(range(1, z_arr + 1))
                        h_count = z_arr
                        h_cost = round(z_arr * h_b, 4)
                    
                    # Slots de alfa entregados (los más accesibles de la pila de alfa)
                    start_del = (Q - y_arr) + 1
                    delivered_a_slots = list(range(start_del, start_del + del_a))
                
                # Carga de nueva mercancía beta en la compuerta (slots 1 .. pick_b)
                if pick_b > 0:
                    new_b_slots = list(range(1, pick_b + 1))
            
            # Slots al salir hacia el siguiente nodo
            slots_dep = ["EMPTY"] * Q
            if v_node != 0:
                succ_node = tour[s+2]
                y_dep = int(round(y[v_node, succ_node].X))
                z_dep = int(round(z[v_node, succ_node].X))
                
                for k_idx in range(z_dep):
                    slots_dep[k_idx] = "B"
                for k_idx in range(Q - y_dep, Q):
                    slots_dep[k_idx] = "A"
            else:
                succ_node = None
                slots_dep = ["EMPTY"] * Q
            
            explanation = generate_step_explanation(
                step_idx=s,
                total_steps=total_steps,
                from_node=node_defs[u_node],
                to_node=node_defs[v_node],
                dist=dist,
                deliver_a=del_a,
                pickup_b=pick_b,
                a_on_truck=y_arr,
                b_on_truck=z_arr,
                handling_count=h_count,
                handling_cost=h_cost,
                h_val=h_val
            )
            
            steps.append({
                "stepIndex": s,
                "from": u_node,
                "to": v_node,
                "succ": succ_node,
                "distance": dist,
                "deliverA": del_a,
                "pickupB": pick_b,
                "aOnTruck": y_arr,
                "bOnTruck": z_arr,
                "slots": slots_arr,
                "slotsArrival": slots_arr,
                "slotsDeparture": slots_dep,
                "kMax": z_arr if (del_a > 0 and z_arr > 0) else 0,
                "rehandledB": rehandled_b,
                "rehandledA": [],
                "deliveredSlots": delivered_a_slots,
                "newBSlots": new_b_slots,
                "handlingCount": h_count,
                "handlingCost": round(h_cost, 2),
                "explanation": explanation
            })
            
        # Objeto de solución completa
        solution_data = {
            "instance": f"Solucion_TSPPD_H1_{num_customers}_Clientes_ID{instance_id}_H_{str(h_val).replace('.', '')}",
            "model": "TSPPD-H_1",
            "modelName": "TSPPD-H_1 (Política 1, Ecs. 17-25)",
            "policy": 1,
            "numCustomers": num_customers,
            "instanceId": instance_id,
            "h": h_val,
            "h_a": h_a,
            "h_b": h_b,
            "capacity": Q,
            "objectiveValue": round(m.ObjVal, 2),
            "totalDistance": routing_cost,
            "handlingCost": round(handling_cost, 2),
            "tour": tour,
            "nodes": node_defs,
            "steps": steps,
            "distMatrix": dist_matrix
        }
        
        # Guardar en archivo .txt en Outputs/
        os.makedirs(output_dir, exist_ok=True)
        h_tag = str(h_val).replace('.', '')
        filename = f"Solucion_TSPPD_H1_{num_customers}_Clientes_ID{instance_id}_H_{h_tag}.txt"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(solution_data, f, indent=2, ensure_ascii=False)
            
        if verbose:
            print_detailed_schedule(
                tour=tour,
                c=c,
                alpha=alpha,
                beta=beta,
                Q=Q,
                positions=positions,
                h_val=h_val,
                steps=steps,
                total_dist=routing_cost,
                total_handling_cost=handling_cost,
                obj_val=m.ObjVal,
                instance_id=instance_id,
                num_customers=num_customers
            )
            print(f"[OK] Solución guardada exitosamente en:")
            print(f"     {filepath}")
            print(f"- Ruta: {' -> '.join(map(str, tour))}")
            print(f"- ObjVal: {m.ObjVal:.2f} | Ruteo: {routing_cost} | Handling: {handling_cost:.2f}\n")
            
        return solution_data
    else:
        print(f"[ERROR] No se encontró solución óptima para ID {instance_id}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Resuelve instancias TSPPD-H_1 (Política 1, Ecs 17-25) con Gurobi y guarda la solución en Outputs/")
    parser.add_argument("--customers", type=int, default=5, help="Número de clientes (default: 5)")
    parser.add_argument("--id", type=int, default=1, help="ID de la instancia (1 a 10)")
    parser.add_argument("--h", type=float, default=0.1, help="Parámetro de costo de manipulación h (default: 0.1)")
    parser.add_argument("--all-ids", action="store_true", help="Resolver automáticamente las instancias ID 1 hasta 10 para 5 clientes")
    parser.add_argument("--gurobi-log", action="store_true", help="Mostrar logs detallados de Gurobi Optimizer")
    
    args = parser.parse_args()
    
    if args.all_ids:
        print("="*70)
        print(f" RESOLVIENDO TODAS LAS INSTANCIAS (1 a 10) PARA {args.customers} CLIENTES (MODELO TSPPD-H_1, H = {args.h})")
        print("="*70)
        for i in range(1, 11):
            solve_instance(num_customers=args.customers, instance_id=i, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)
    else:
        solve_instance(num_customers=args.customers, instance_id=args.id, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)

if __name__ == '__main__':
    main()

import os
import sys
import math
import json
import argparse
import gurobipy as gp
from gurobipy import GRB

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
NUM_CUSTOMERS = 5      # Número de clientes a resolver (e.g. 5, 10, 15, 20, 50)
INSTANCE_ID = 1        # ID de la instancia de datos (1 a 10)
H_VALUE = 0.1          # Costo unitario de manipulación h (default: 0.1)

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
    """Genera una explicación detallada en lenguaje natural para cada paso de la ruta bajo Política 2"""
    if step_idx == 0:
        if handling_count > 0:
            handling_txt = (
                f" ⚠️ <strong>Reubicación de Carga α (Política 2):</strong> Para ubicar las {pickup_b} unidades β recolectadas al fondo "
                f"del camión, se requirió evacuar y recargar las {handling_count} unidades α remanentes a bordo "
                f"({handling_count} operaciones × h={h_val} = ${handling_cost:.2f} costo de manipulación)."
            )
        else:
            handling_txt = " Dado que no hubo recolección de mercancía β (o no quedó carga α remanente), no se requirió reubicación."
        return (
            f"<strong>Paso 1 — Depósito (Nodo 0) → {to_node['label']}:</strong> El camión recorre {dist} km bajo el modelo <strong>TSPPD-H_2 (Política 2)</strong>. "
            f"Al llegar entrega <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span> ubicadas directamente en la compuerta trasera (sin conflicto de descarga). "
            f"Posteriormente recolecta <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> ubicándolas al fondo del camión.{handling_txt}"
        )
    elif step_idx == total_steps - 1:
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → Depósito (Nodo 0):</strong> El camión regresa al depósito "
            f"recorriendo {dist} km transportando la totalidad de la mercancía recolectada (<span style='color:#06b6d4;font-weight:600;'>{b_on_truck} unidades β</span>). "
            f"<strong>¡Tour completado bajo Política 2 (TSPPD-H_2)!</strong>"
        )
    else:
        if handling_count > 0:
            handling_txt = (
                f" ⚠️ <strong>Reordenamiento al Fondo (Política 2):</strong> La mercancía α restante ({handling_count} unidades) se encontraba "
                f"en la compuerta. Para almacenar las {pickup_b} nuevas unidades β en el fondo del compartimiento (detrás de las β previas), "
                f"se evacuó la carga α remanente, se acomodó la carga β al fondo y se reingresó la carga α "
                f"({handling_count} operaciones × h={h_val} = ${handling_cost:.2f} costo de manejo)."
            )
        else:
            handling_txt = f" Como no hubo recolección de mercancía β (β = {pickup_b}), no se requirió evacuar ni manipular mercancía α."
        
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → {to_node['label']}:</strong> Recorrido de {dist} km. "
            f"Se entregan <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span> directamente desde la compuerta.{handling_txt} "
            f"Luego se recogen <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> hacia el fondo."
        )

def print_detailed_schedule(tour, c, alpha, beta, Q, positions, h_val, steps, total_dist, total_handling_cost, obj_val, instance_id, num_customers):
    """Imprime en la salida estándar el reporte detallado de carga, descarga y handling bajo Política 2"""
    print("\n" + "="*80)
    print(f" DETALLE DE CARGA, DESCARGA Y HANDLING POR CLIENTE (TSPPD-H_2 — POLÍTICA 2)")
    print(f" Instancia ID: {instance_id} | Clientes: {num_customers} | Capacidad Q: {Q} | h = {h_val}")
    print(f" Ruta óptima: {' -> '.join('Depósito (0)' if node == 0 else f'Cliente {node}' for node in tour)}")
    print("="*80)

    # 1. SALIDA DEL DEPÓSITO
    tot_a = sum(alpha[i] for i in range(1, num_customers + 1))
    first_step = steps[0]
    slots_init = first_step["slotsArrival"]
    a_init_slots = [k for k in positions if slots_init[k-1] == "A"]
    
    print(f"\n[PASO 0] SALIDA DEL DEPÓSITO CENTRAL (Nodo 0)")
    print("-" * 80)
    print(f"• Carga total a bordo: {tot_a} unidades tipo α (Entrega) | 0 unidades tipo β")
    print(f"• Ocupación de salida: {tot_a}/{Q} unidades ({tot_a/Q*100:.1f}%)")
    print(f"• Posición de estiba (Política 2: α en compuerta, fondo vacío para β):")
    print(f"  - Carga α: Slots {format_slot_ranges(a_init_slots)} (cerca de la compuerta)")
    print(f"  - Compartimiento (Puerta -> Fondo):")
    print(f"    {format_truck_diagram(slots_init)}")

    # 2. PARADAS DE CLIENTES
    for idx, step in enumerate(steps[:-1], 1):
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
        
        re_a = step["rehandledA"]
        num_re = len(re_a)
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
        print(f"   - Objetos tipo α (puerta): {len(alpha_in)} unidades (Slots: {format_slot_ranges(alpha_in)})")
        print(f"   - Objetos tipo β (fondo):  {len(beta_in)} unidades (Slots: {format_slot_ranges(beta_in)})")
        print(f"   - Slots vacíos intermedios: {len(empty_in)} (Slots: {format_slot_ranges(empty_in)})")
        print(f"   - Compartimiento (Puerta -> Fondo):")
        print(f"     {format_truck_diagram(slots_in)}")
        
        print(f"\n2. OPERACIÓN DE DESCARGA:")
        print(f"   • Entrega definitiva al cliente:")
        print(f"     - Se entregan {del_a} unidades tipo α directamente desde la compuerta (sin obstrucción).")
        print(f"     - Slots entregados: {format_slot_ranges(del_slots)}")
        if num_re > 0:
            print(f"   • Evacuación temporal obligatoria por Política 2 (Front-loading beta):")
            print(f"     - {num_re} unidades tipo α remanentes evacuadas temporalmente para ubicar β al fondo (Slots: {format_slot_ranges(re_a)}).")
        else:
            print(f"   • Evacuación temporal:")
            print(f"     - ✅ Ninguna ({'no hubo recolección de mercancía β' if pick_b == 0 else 'no queda mercancía α remanente a bordo'}).")
            
        print(f"\n3. MANIPULACIÓN (HANDLING):")
        if num_re > 0:
            print(f"   - Operaciones de re-handling: {num_re} unidades α")
            print(f"   - Costo de handling en esta parada: ${h_cost:.2f} ({num_re} ops × h={h_val})")
        else:
            print(f"   - Operaciones de re-handling: 0 unidades")
            print(f"   - Costo de handling: $0.00")
            
        print(f"\n4. OPERACIÓN DE CARGA:")
        if pick_b > 0:
            print(f"   • Carga de recolección (al fondo):")
            print(f"     - Se cargan {pick_b} unidades tipo β recolectadas en el compartimiento de fondo.")
            print(f"     - Slots asignados: {format_slot_ranges(new_b_slots)}")
        else:
            print(f"   • Sin recolección en este cliente.")
        if num_re > 0:
            print(f"   • Recarga de mercancía α remanente en compuerta:")
            print(f"     - Se vuelven a ingresar las {num_re} unidades α hacia la compuerta trasera.")
            
        print(f"\n5. ESTADO DEL CAMIÓN AL SALIR (Rumbo a {succ_label}):")
        print(f"   - Ocupación: {occ_out}/{Q} unidades ({occ_out/Q*100:.1f}%)")
        print(f"   - Objetos tipo α restantes (puerta): {len(alpha_out)} unidades (Slots: {format_slot_ranges(alpha_out)})")
        print(f"   - Objetos tipo β acumulados (fondo): {len(beta_out)} unidades (Slots: {format_slot_ranges(beta_out)})")
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
    print(f"[PASO FINAL] LLEGADA AL DEPÓSITO (Nodo 0) — Fin del Recorrido (Política 2)")
    print("-" * 80)
    print(f"• Tramo final: Cliente {u_last} -> Depósito (Nodo 0) | Distancia: {dist_last} km")
    print(f"• Estado al llegar: 0 objetos tipo α | {len(b_final_slots)} objetos tipo β recolectados")
    print(f"• Ocupación al llegar: {len(b_final_slots)}/{Q} ({len(b_final_slots)/Q*100:.1f}%)")
    print(f"• Compartimiento al llegar (Puerta -> Fondo):")
    print(f"  {format_truck_diagram(slots_final)}")
    print(f"• DESCARGA FINAL EN DEPÓSITO:")
    print(f"  - Se descargan {len(b_final_slots)} objetos tipo β desde el fondo del camión.")
    print(f"  - Slots descargados: {format_slot_ranges(b_final_slots)}")
    print(f"• Estado final del camión: Completamente vacío (0/{Q} unidades).")

    # 4. RESUMEN GLOBAL
    total_ops = sum(s.get("handlingCount", 0) for s in steps)
    total_a = sum(alpha[i] for i in range(1, num_customers + 1))
    total_b = sum(beta[i] for i in range(1, num_customers + 1))
    print("\n" + "="*80)
    print(f" RESUMEN GLOBAL DE LA SOLUCIÓN (TSPPD-H_2)")
    print("="*80)
    print(f"• Ruta óptima:              {' -> '.join(map(str, tour))}")
    print(f"• Distancia total de ruteo: {total_dist} km")
    print(f"• Costo total de handling:  ${total_handling_cost:.2f} ({total_ops} operaciones)")
    print(f"• Valor función objetivo:   ${obj_val:.2f}")
    print(f"• Total α entregadas:       {total_a} unidades")
    print(f"• Total β recolectadas:     {total_b} unidades")
    print("="*80 + "\n")

def solve_instance(num_customers=NUM_CUSTOMERS, instance_id=INSTANCE_ID, h_val=H_VALUE, output_dir=OUTPUTS_DIR, verbose=True, gurobi_log=False):
    """Resuelve una instancia del modelo TSPPD-H_2 (Política 2, Ecs. 26-27) y guarda la solución en Outputs/"""
    if verbose:
        print("\n" + "="*60)
        print(f" RESOLVIENDO MODELO TSPPD-H_2 (POLÍTICA 2, ECUACIONES 26-27)")
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
            
    # 4. Crear modelo en Gurobi (Ecuaciones 26 - 27)
    m = gp.Model(f"TSPPD-H2_C{num_customers}_ID{instance_id}_H{h_val}")
    m.setParam('OutputFlag', 1 if gurobi_log else 0)
    
    # --- Variables de Decisión ---
    x = m.addVars(nodes, nodes, vtype=GRB.BINARY, name="x")
    y = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="y")
    z = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="z")
    u = m.addVars(nodes, vtype=GRB.CONTINUOUS, lb=0, name="u") 
    
    # Eliminar auto-bucles
    for i in nodes:
        m.addConstr(x[i,i] == 0)
        m.addConstr(y[i,i] == 0)
        m.addConstr(z[i,i] == 0)
        
    # Condiciones de frontera con el depósito:
    for j in nodes:
        m.addConstr(y[j, 0] == 0, name=f"no_a_depot_{j}")
        m.addConstr(z[0, j] == 0, name=f"no_b_from_depot_{j}")
            
    # --- Función Objetivo (Ecuación 26) ---
    # min sum c_ij * x_ij + sum_{(i,j) in A \ A_d : beta_i > 0} h_a * y_ij
    obj_routing = gp.quicksum(c[i,j] * x[i,j] for i in nodes for j in nodes if i != j)
    obj_handling = gp.quicksum(h_a * y[i,j] for i in customers for j in nodes if i != j and beta[i] > 0)
    
    m.setObjective(obj_routing + obj_handling, GRB.MINIMIZE)
    
    # --- Restricciones (18 - 25) ---
    for i in nodes:
        m.addConstr(gp.quicksum(x[i,j] for j in nodes if j != i) == 1, name=f"deg_out_{i}")
        m.addConstr(gp.quicksum(x[j,i] for j in nodes if j != i) == 1, name=f"deg_in_{i}")
        
    for i in nodes:
        m.addConstr(
            gp.quicksum(y[j,i] for j in nodes if j != i) - 
            gp.quicksum(y[i,j] for j in nodes if j != i) == alpha[i],
            name=f"flow_a_{i}"
        )
                    
    for i in nodes:
        m.addConstr(
            gp.quicksum(z[i,j] for j in nodes if j != i) - 
            gp.quicksum(z[j,i] for j in nodes if j != i) == beta[i],
            name=f"flow_b_{i}"
        )
                    
    for i in nodes:
        for j in nodes:
            if i != j:
                m.addConstr(y[i,j] + z[i,j] <= Q * x[i,j], name=f"cap_{i}_{j}")
                    
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
        
        node_defs = []
        for i in nodes:
            node_defs.append({
                "id": i,
                "alpha": alpha[i] if i != 0 else sum(alpha[cust] for cust in customers),
                "beta": beta[i] if i != 0 else sum(beta[cust] for cust in customers),
                "isDepot": (i == 0),
                "label": "Depósito" if i == 0 else f"Cliente {i}"
            })
            
        dist_matrix = []
        for i in nodes:
            row = []
            for j in nodes:
                row.append(c[i,j])
            dist_matrix.append(row)
            
        # Simulación física de slots bajo Política 2:
        # Patrón (F, b, ..., b, a, ..., a, R)
        # Puerta (Door, slots 1..y): Mercancía α
        # Fondo (Front, slots Q-z+1..Q): Mercancía β
        steps = []
        total_steps = len(tour) - 1
        
        for s in range(total_steps):
            u_node = tour[s]
            v_node = tour[s+1]
            dist = c[u_node, v_node]
            
            del_a = alpha[v_node] if v_node != 0 else 0
            pick_b = beta[v_node] if v_node != 0 else 0
            
            y_arr = int(round(y[u_node, v_node].X))
            z_arr = int(round(z[u_node, v_node].X))
            
            # Slots al llegar:
            # Slots 0 .. y_arr-1 -> "A" (en la compuerta)
            # Slots y_arr .. Q - z_arr - 1 -> "EMPTY"
            # Slots Q - z_arr .. Q - 1 -> "B" (en el fondo)
            slots_arr = ["EMPTY"] * Q
            for k_idx in range(y_arr):
                slots_arr[k_idx] = "A"
            for k_idx in range(Q - z_arr, Q):
                slots_arr[k_idx] = "B"
                
            # Operaciones en v_node
            rehandled_a = []
            delivered_a_slots = []
            new_b_slots = []
            h_count = 0
            h_cost = 0.0
            
            if v_node != 0:
                # 1. Entrega de alfa (directamente en la compuerta, slots 1..del_a)
                if del_a > 0:
                    delivered_a_slots = list(range(1, del_a + 1))
                
                # 2. Re-handling de alfa remanente si hay recolección de beta
                y_dep = y_arr - del_a
                if pick_b > 0 and y_dep > 0:
                    # Las unidades alfa remanentes se evacúan temporalmente
                    rehandled_a = list(range(del_a + 1, y_arr + 1))
                    h_count = y_dep
                    h_cost = round(y_dep * h_a, 4)
                
                # 3. Carga de nueva beta en el fondo
                if pick_b > 0:
                    start_b = (Q - z_arr - pick_b) + 1
                    new_b_slots = list(range(start_b, start_b + pick_b))
            
            # Slots al salir
            slots_dep = ["EMPTY"] * Q
            if v_node != 0:
                succ_node = tour[s+2]
                y_dep_val = int(round(y[v_node, succ_node].X))
                z_dep_val = int(round(z[v_node, succ_node].X))
                
                for k_idx in range(y_dep_val):
                    slots_dep[k_idx] = "A"
                for k_idx in range(Q - z_dep_val, Q):
                    slots_dep[k_idx] = "B"
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
                "kMax": y_dep if (pick_b > 0 and y_dep > 0) else 0,
                "rehandledB": [],
                "rehandledA": rehandled_a,
                "deliveredSlots": delivered_a_slots,
                "newBSlots": new_b_slots,
                "handlingCount": h_count,
                "handlingCost": round(h_cost, 2),
                "explanation": explanation
            })
            
        solution_data = {
            "instance": f"Solucion_TSPPD_H2_{num_customers}_Clientes_ID{instance_id}_H_{str(h_val).replace('.', '')}",
            "model": "TSPPD-H_2",
            "modelName": "TSPPD-H_2 (Política 2, Ecs. 26-27)",
            "policy": 2,
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
        filename = f"Solucion_TSPPD_H2_{num_customers}_Clientes_ID{instance_id}_H_{h_tag}.txt"
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
    parser = argparse.ArgumentParser(description="Resuelve instancias TSPPD-H_2 (Política 2, Ecs 26-27) con Gurobi y guarda la solución en Outputs/")
    parser.add_argument("--customers", type=int, default=NUM_CUSTOMERS, help=f"Número de clientes (default: {NUM_CUSTOMERS})")
    parser.add_argument("--id", type=int, default=INSTANCE_ID, help=f"ID de la instancia 1 a 10 (default: {INSTANCE_ID})")
    parser.add_argument("--h", type=float, default=H_VALUE, help=f"Parámetro de costo de manipulación h (default: {H_VALUE})")
    parser.add_argument("--all-ids", action="store_true", help="Resolver automáticamente las instancias ID 1 hasta 10 para los clientes configurados")
    parser.add_argument("--gurobi-log", action="store_true", help="Mostrar logs detallados de Gurobi Optimizer")
    
    args = parser.parse_args()
    
    if args.all_ids:
        print("="*70)
        print(f" RESOLVIENDO TODAS LAS INSTANCIAS (1 a 10) PARA {args.customers} CLIENTES (MODELO TSPPD-H_2, H = {args.h})")
        print("="*70)
        for i in range(1, 11):
            solve_instance(num_customers=args.customers, instance_id=i, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)
    else:
        solve_instance(num_customers=args.customers, instance_id=args.id, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)

if __name__ == '__main__':
    main()

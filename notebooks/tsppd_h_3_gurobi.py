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

def generate_step_explanation(step_idx, total_steps, from_node, to_node, dist, deliver_a, pickup_b, a_on_truck, b_rear_on_truck, b_front_on_truck, handling_count, handling_cost, h_val, policy_applied):
    """Genera una explicación detallada en lenguaje natural para cada paso de la ruta bajo Política 3"""
    if step_idx == 0:
        policy_label = f"Política {policy_applied}"
        handling_txt = (
            f" Se aplicó la <strong>{policy_label}</strong> (s={1 if policy_applied==1 else 0})."
        )
        if handling_count > 0:
            handling_txt += f" ⚠️ Costo de manipulación en parada: ${handling_cost:.2f} ({handling_count} ops)."
        else:
            handling_txt += " No hubo costo de manipulación al salir inicialmente del depósito."
        return (
            f"<strong>Paso 1 — Depósito (Nodo 0) → {to_node['label']}:</strong> El camión recorre {dist} km bajo el modelo <strong>TSPPD-H_3 (Política 3 - Híbrida/Óptima)</strong>. "
            f"Al llegar entrega <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span>.{handling_txt} "
            f"Posteriormente recolecta <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> ubicándolas según la {policy_label}."
        )
    elif step_idx == total_steps - 1:
        total_b = b_rear_on_truck + b_front_on_truck
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → Depósito (Nodo 0):</strong> El camión regresa al depósito "
            f"recorriendo {dist} km transportando la totalidad de la mercancía recolectada (<span style='color:#06b6d4;font-weight:600;'>{total_b} unidades β</span>: "
            f"{b_front_on_truck} en el fondo y {b_rear_on_truck} en la compuerta). "
            f"<strong>¡Tour completado exitosamente bajo Política 3 (TSPPD-H_3)!</strong>"
        )
    else:
        policy_label = f"Política {policy_applied}"
        if policy_applied == 1:
            policy_desc = "Política 1 elegida (s=1): La nueva mercancía β se almacena en la compuerta trasera."
            if handling_count > 0:
                handling_txt = (
                    f" ⚠️ <strong>Obstrucción en Puerta (LIFO):</strong> {handling_count} unidades β en compuerta obstruían la entrega de α. "
                    f"Se evacuaron y recargaron ({handling_count} ops × h={h_val} = ${handling_cost:.2f})."
                )
            else:
                handling_txt = " Sin conflicto de compuerta."
        else:
            policy_desc = "Política 2 elegida (s=0): Toda la mercancía β se traslada/ubica al fondo del camión."
            if handling_count > 0:
                handling_txt = (
                    f" ⚠️ <strong>Reubicación al Frente:</strong> Se evacuó la carga remanente para posicionar la mercancía β al fondo "
                    f"({handling_count} ops × h={h_val} = ${handling_cost:.2f})."
                )
            else:
                handling_txt = " Reubicación directa sin costo adicional."
        
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → {to_node['label']}:</strong> Recorrido de {dist} km. "
            f"Se entregan <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span>. "
            f"Decisión: <strong>{policy_desc}</strong>{handling_txt} "
            f"Se recogen <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span>."
        )

def print_detailed_schedule(tour, c, alpha, beta, Q, positions, h_val, steps, total_dist, total_handling_cost, obj_val, instance_id, num_customers, s_decisions):
    """Imprime en la salida estándar el reporte detallado bajo Política 3"""
    print("\n" + "="*80)
    print(f" DETALLE DE CARGA, DESCARGA Y HANDLING POR CLIENTE (TSPPD-H_3 — POLÍTICA 3)")
    print(f" Instancia ID: {instance_id} | Clientes: {num_customers} | Capacidad Q: {Q} | h = {h_val}")
    print(f" Ruta óptima: {' -> '.join('Depósito (0)' if node == 0 else f'Cliente {node}' for node in tour)}")
    print(f" Decisiones de Política s_i: {', '.join(f'Cliente {i}: Pol.{1 if s_decisions[i]>0.5 else 2}' for i in range(1, num_customers + 1))}")
    print("="*80)

    for idx, step in enumerate(steps[:-1], 1):
        u_n = step["from"]
        v_n = step["to"]
        dist = step["distance"]
        del_a = step["deliverA"]
        pick_b = step["pickupB"]
        pol = step.get("policyApplied", 1)
        
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
        
        h_cost = step["handlingCost"]
        h_ops = step["handlingCount"]
        
        print("\n" + "="*80)
        print(f"[PARADA {idx}] CLIENTE {v_n} (Tramo: Nodo {u_n} -> Nodo {v_n} | Distancia: {dist} km | Política Adoptada: Política {pol})")
        print("-" * 80)
        print(f"• Demandas: Entrega α = {del_a} | Recolección β = {pick_b}")
        print(f"• Estado al llegar: {occ_in}/{Q} unidades | α = {len(alpha_in)}, β = {len(beta_in)}")
        print(f"  Compartimiento: {format_truck_diagram(slots_in)}")
        print(f"• Operaciones de Manipulación (Handling): {h_ops} ops | Costo: ${h_cost:.2f}")
        print(f"• Estado al salir (Rumbo a {succ_label}): {occ_out}/{Q} unidades")
        print(f"  Compartimiento: {format_truck_diagram(slots_out)}")

    # Resumen
    total_ops = sum(s.get("handlingCount", 0) for s in steps)
    print("\n" + "="*80)
    print(f" RESUMEN GLOBAL DE LA SOLUCIÓN (TSPPD-H_3)")
    print("="*80)
    print(f"• Ruta óptima:              {' -> '.join(map(str, tour))}")
    print(f"• Distancia total de ruteo: {total_dist} km")
    print(f"• Costo total de handling:  ${total_handling_cost:.2f} ({total_ops} operaciones)")
    print(f"• Valor función objetivo:   ${obj_val:.2f}")
    print("="*80 + "\n")

def solve_instance(num_customers=NUM_CUSTOMERS, instance_id=INSTANCE_ID, h_val=H_VALUE, output_dir=OUTPUTS_DIR, verbose=True, gurobi_log=False):
    """Resuelve una instancia del modelo TSPPD-H_3 (Política 3, Ecs. 31-48) y guarda la solución en Outputs/"""
    if verbose:
        print("\n" + "="*60)
        print(f" RESOLVIENDO MODELO TSPPD-H_3 (POLÍTICA 3, ECUACIONES 31-48)")
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
    
    tot_a = sum(alpha[i] for i in customers)
    tot_b = sum(beta[i] for i in customers)
    Q = max(tot_a, tot_b)
    positions = list(range(1, Q + 1))
    
    h_a = h_val
    h_b = h_val
            
    # 4. Crear modelo en Gurobi (Ecuaciones 31 - 48)
    m = gp.Model(f"TSPPD-H3_C{num_customers}_ID{instance_id}_H{h_val}")
    m.setParam('OutputFlag', 1 if gurobi_log else 0)
    
    # --- Variables de Decisión ---
    x = m.addVars(nodes, nodes, vtype=GRB.BINARY, name="x")
    s = m.addVars(customers, vtype=GRB.BINARY, name="s")
    y = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="y")
    w = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="w")
    z = m.addVars(nodes, nodes, vtype=GRB.CONTINUOUS, lb=0, ub=Q, name="z")
    p_var = m.addVars(customers, vtype=GRB.CONTINUOUS, lb=0, name="p")
    q_var = m.addVars(customers, vtype=GRB.CONTINUOUS, lb=0, name="q")
    u = m.addVars(nodes, vtype=GRB.CONTINUOUS, lb=0, name="u") 
    
    # Eliminar auto-bucles
    for i in nodes:
        m.addConstr(x[i,i] == 0)
        m.addConstr(y[i,i] == 0)
        m.addConstr(w[i,i] == 0)
        m.addConstr(z[i,i] == 0)
        
    # Condiciones de frontera con el depósito:
    for j in nodes:
        m.addConstr(y[j, 0] == 0, name=f"no_a_depot_{j}")
        m.addConstr(w[0, j] == 0, name=f"no_w_from_depot_{j}")
        m.addConstr(z[0, j] == 0, name=f"no_z_from_depot_{j}")
            
    # --- Función Objetivo (Ecuación 31) ---
    # min sum c_ij * x_ij + sum_{(i,j) in A \ A_r : alpha_j > 0} h_b * z_ij + sum_{i in Vc} q_i
    obj_routing = gp.quicksum(c[i,j] * x[i,j] for i in nodes for j in nodes if i != j)
    obj_h1_term = gp.quicksum(h_b * z[i,j] for i in nodes for j in customers if i != j and alpha[j] > 0)
    obj_q_term = gp.quicksum(q_var[i] for i in customers)
    
    m.setObjective(obj_routing + obj_h1_term + obj_q_term, GRB.MINIMIZE)
    
    # --- Restricciones ---
    # (32) y (33) Grado
    for i in nodes:
        m.addConstr(gp.quicksum(x[i,j] for j in nodes if j != i) == 1, name=f"deg_out_{i}")
        m.addConstr(gp.quicksum(x[j,i] for j in nodes if j != i) == 1, name=f"deg_in_{i}")
        
    # (34) Conservación de flujo para alfa (y)
    for i in customers:
        m.addConstr(
            gp.quicksum(y[j,i] for j in nodes if j != i) - 
            gp.quicksum(y[i,j] for j in nodes if j != i) == alpha[i],
            name=f"flow_a_{i}"
        )
                    
    # (35) Conservación de flujo para total beta (w + z)
    for i in customers:
        m.addConstr(
            gp.quicksum(w[i,j] + z[i,j] for j in nodes if j != i) - 
            gp.quicksum(w[j,i] + z[j,i] for j in nodes if j != i) == beta[i],
            name=f"flow_b_total_{i}"
        )

    # (36) Restricción de flujo de mercancía frontal w
    for i in customers:
        m.addConstr(
            gp.quicksum(w[i,j] for j in nodes if j != i) - 
            gp.quicksum(w[j,i] for j in nodes if j != i) <= (1 - s[i]) * tot_b,
            name=f"front_w_limit_{i}"
        )
                    
    # (37) Capacidad de vehículo en cada arco
    for i in nodes:
        for j in nodes:
            if i != j:
                m.addConstr(w[i,j] + y[i,j] + z[i,j] <= Q * x[i,j], name=f"cap_{i}_{j}")
                    
    # (38) Subtour elimination MTZ
    for i in customers:
        for j in customers:
            if i != j:
                m.addConstr(u[i] - u[j] + (V-1)*x[i,j] <= V - 2, name=f"mtz_{i}_{j}")

    # (39) - (44) Ecuaciones de costo de manipulación condicionales a s_i
    for i in customers:
        if alpha[i] == 0:
            m.addConstr(
                gp.quicksum(h_a * y[i,j] for j in nodes if j != i) + 
                gp.quicksum(h_b * z[j,i] for j in nodes if j != i) == p_var[i] + q_var[i],
                name=f"cost_eq_zero_a_{i}"
            )
            m.addConstr(p_var[i] <= (h_a * tot_a + h_b * tot_b) * s[i], name=f"bound_p_zero_a_{i}")
            m.addConstr(q_var[i] <= (h_a * tot_a + h_b * tot_b) * (1 - s[i]), name=f"bound_q_zero_a_{i}")
        else:
            m.addConstr(
                gp.quicksum(h_a * y[i,j] for j in nodes if j != i) == p_var[i] + q_var[i],
                name=f"cost_eq_pos_a_{i}"
            )
            m.addConstr(p_var[i] <= (h_a * tot_a) * s[i], name=f"bound_p_pos_a_{i}")
            m.addConstr(q_var[i] <= (h_a * tot_a) * (1 - s[i]), name=f"bound_q_pos_a_{i}")

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
            
        s_decisions = {}
        for i in customers:
            s_decisions[i] = 1 if s[i].X > 0.5 else 0

        # Simulación física de slots de 3 bloques bajo Política 3:
        # Patrón (F, b_front, ..., b_front, a, ..., a, b_rear, ..., b_rear, R)
        # Slots 0 .. z-1: Mercancía β en compuerta (Rear)
        # Slots z .. z+y-1: Mercancía α en el medio
        # Slots Q-w .. Q-1: Mercancía β en el fondo (Front)
        steps = []
        total_steps = len(tour) - 1
        
        for st in range(total_steps):
            u_node = tour[st]
            v_node = tour[st+1]
            dist = c[u_node, v_node]
            
            del_a = alpha[v_node] if v_node != 0 else 0
            pick_b = beta[v_node] if v_node != 0 else 0
            
            y_arr = int(round(y[u_node, v_node].X))
            w_arr = int(round(w[u_node, v_node].X))
            z_arr = int(round(z[u_node, v_node].X))
            
            # Construir slots de llegada
            slots_arr = ["EMPTY"] * Q
            for k_idx in range(z_arr):
                slots_arr[k_idx] = "B"
            for k_idx in range(z_arr, z_arr + y_arr):
                slots_arr[k_idx] = "A"
            for k_idx in range(Q - w_arr, Q):
                slots_arr[k_idx] = "B"
                
            pol_applied = s_decisions.get(v_node, 1) if v_node != 0 else 1
            
            rehandled_b = []
            rehandled_a = []
            delivered_a_slots = []
            new_b_slots = []
            h_count = 0
            h_cost = 0.0
            
            if v_node != 0:
                q_val = q_var[v_node].X
                
                # Caso Política 1 (s = 1)
                if pol_applied == 1:
                    if del_a > 0 and z_arr > 0:
                        rehandled_b = list(range(1, z_arr + 1))
                        h_count = z_arr
                        h_cost = round(z_arr * h_b, 4)
                        
                    start_del = z_arr + 1
                    delivered_a_slots = list(range(start_del, start_del + del_a))
                    
                    if pick_b > 0:
                        new_b_slots = list(range(1, pick_b + 1))
                # Caso Política 2 (s = 0)
                else:
                    # En Política 2, z_arr se desaloja si había entrega o si se traslada al fondo
                    y_dep_val = y_arr - del_a
                    if del_a > 0:
                        if z_arr > 0:
                            rehandled_b = list(range(1, z_arr + 1))
                            h_count += z_arr
                            h_cost += round(z_arr * h_b, 4)
                        delivered_a_slots = list(range(z_arr + 1, z_arr + 1 + del_a))
                    
                    # Se desaloja alfa remanente para ubicar todo b en el fondo
                    if y_dep_val > 0:
                        rehandled_a = list(range(del_a + 1, del_a + 1 + y_dep_val))
                        h_count += y_dep_val
                        h_cost += round(y_dep_val * h_a, 4)
                    elif del_a == 0 and z_arr > 0:
                        # alpha=0, z_arr se traslada
                        rehandled_b = list(range(1, z_arr + 1))
                        h_count += z_arr
                        h_cost += round(z_arr * h_b, 4)
                        
                    if pick_b > 0:
                        start_b = (Q - (w_arr + z_arr + pick_b)) + 1
                        new_b_slots = list(range(start_b, start_b + pick_b))
            
            # Slots de salida
            slots_dep = ["EMPTY"] * Q
            if v_node != 0:
                succ_node = tour[st+2]
                y_dep = int(round(y[v_node, succ_node].X))
                w_dep = int(round(w[v_node, succ_node].X))
                z_dep = int(round(z[v_node, succ_node].X))
                
                for k_idx in range(z_dep):
                    slots_dep[k_idx] = "B"
                for k_idx in range(z_dep, z_dep + y_dep):
                    slots_dep[k_idx] = "A"
                for k_idx in range(Q - w_dep, Q):
                    slots_dep[k_idx] = "B"
            else:
                succ_node = None
                slots_dep = ["EMPTY"] * Q
                
            explanation = generate_step_explanation(
                step_idx=st,
                total_steps=total_steps,
                from_node=node_defs[u_node],
                to_node=node_defs[v_node],
                dist=dist,
                deliver_a=del_a,
                pickup_b=pick_b,
                a_on_truck=y_arr,
                b_rear_on_truck=z_arr,
                b_front_on_truck=w_arr,
                handling_count=h_count,
                handling_cost=h_cost,
                h_val=h_val,
                policy_applied=pol_applied
            )
            
            steps.append({
                "stepIndex": st,
                "from": u_node,
                "to": v_node,
                "succ": succ_node,
                "distance": dist,
                "deliverA": del_a,
                "pickupB": pick_b,
                "aOnTruck": y_arr,
                "bOnTruck": z_arr + w_arr,
                "wOnTruck": w_arr,
                "zOnTruck": z_arr,
                "policyApplied": pol_applied,
                "slots": slots_arr,
                "slotsArrival": slots_arr,
                "slotsDeparture": slots_dep,
                "kMax": z_arr if (del_a > 0 and z_arr > 0) else 0,
                "rehandledB": rehandled_b,
                "rehandledA": rehandled_a,
                "deliveredSlots": delivered_a_slots,
                "newBSlots": new_b_slots,
                "handlingCount": h_count,
                "handlingCost": round(h_cost, 2),
                "explanation": explanation
            })
            
        solution_data = {
            "instance": f"Solucion_TSPPD_H3_{num_customers}_Clientes_ID{instance_id}_H_{str(h_val).replace('.', '')}",
            "model": "TSPPD-H_3",
            "modelName": "TSPPD-H_3 (Política 3, Ecs. 31-48)",
            "policy": 3,
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
            "distMatrix": dist_matrix,
            "policyDecisions": s_decisions
        }
        
        # Guardar en archivo .txt en Outputs/
        os.makedirs(output_dir, exist_ok=True)
        h_tag = str(h_val).replace('.', '')
        filename = f"Solucion_TSPPD_H3_{num_customers}_Clientes_ID{instance_id}_H_{h_tag}.txt"
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
                num_customers=num_customers,
                s_decisions=s_decisions
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
    parser = argparse.ArgumentParser(description="Resuelve instancias TSPPD-H_3 (Política 3, Ecs 31-48) con Gurobi y guarda la solución en Outputs/")
    parser.add_argument("--customers", type=int, default=NUM_CUSTOMERS, help=f"Número de clientes (default: {NUM_CUSTOMERS})")
    parser.add_argument("--id", type=int, default=INSTANCE_ID, help=f"ID de la instancia 1 a 10 (default: {INSTANCE_ID})")
    parser.add_argument("--h", type=float, default=H_VALUE, help=f"Parámetro de costo de manipulación h (default: {H_VALUE})")
    parser.add_argument("--all-ids", action="store_true", help="Resolver automáticamente las instancias ID 1 hasta 10 para los clientes configurados")
    parser.add_argument("--gurobi-log", action="store_true", help="Mostrar logs detallados de Gurobi Optimizer")
    
    args = parser.parse_args()
    
    if args.all_ids:
        print("="*70)
        print(f" RESOLVIENDO TODAS LAS INSTANCIAS (1 a 10) PARA {args.customers} CLIENTES (MODELO TSPPD-H_3, H = {args.h})")
        print("="*70)
        for i in range(1, 11):
            solve_instance(num_customers=args.customers, instance_id=i, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)
    else:
        solve_instance(num_customers=args.customers, instance_id=args.id, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)

if __name__ == '__main__':
    main()

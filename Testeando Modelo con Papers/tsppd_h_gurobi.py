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
# CONFIGURACIÓN DE PARÁMETROS PARA REPLICAR EL PAPER
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
    """Genera una explicación detallada en lenguaje natural para cada paso de la ruta"""
    if step_idx == 0:
        if handling_count > 0:
            handling_txt = f" ⚠️ Se requirieron {handling_count} operaciones de manipulación (handling) con costo adicional de {handling_cost:.2f}."
        else:
            handling_txt = " Como el camión solo transportaba mercancía α, no hubo obstrucción ni costo de manipulación."
        return (
            f"<strong>Paso 1 — Depósito (Nodo 0) → {to_node['label']}:</strong> El camión viaja una distancia de {dist} km. "
            f"Al llegar descarga <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span> (entrega requerida).{handling_txt} "
            f"Posteriormente recolecta <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> que se colocan al final del compartimiento LIFO."
        )
    elif step_idx == total_steps - 1:
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → Depósito (Nodo 0):</strong> El camión regresa al depósito "
            f"recorriendo {dist} km transportando la totalidad de la carga recolectada (<span style='color:#06b6d4;font-weight:600;'>{b_on_truck} unidades β</span>). "
            f"<strong>¡Tour completado exitosamente!</strong>"
        )
    else:
        if handling_count > 0:
            handling_txt = (
                f" ⚠️ <strong>Conflicto LIFO (Handling):</strong> Se requirieron {handling_count} operaciones de manipulación por obstrucción en la puerta. "
                f"Tuvieron que descargarse temporalmente y recargarse ({handling_count} operaciones × h={h_val} = {handling_cost:.2f} costo de manejo)."
            )
        else:
            handling_txt = " No se generó conflicto de manipulación (handling)."
        
        return (
            f"<strong>Paso {step_idx + 1} — {from_node['label']} → {to_node['label']}:</strong> Recorrido de {dist} km. "
            f"Se entregan <span style='color:#ef4444;font-weight:600;'>{deliver_a} unidades α</span>.{handling_txt} "
            f"Luego se recogen <span style='color:#06b6d4;font-weight:600;'>{pickup_b} unidades β</span> para el depósito."
        )

def print_detailed_schedule(tour, c, alpha, beta, Q, positions, h_val, steps, total_dist, total_handling_cost, obj_val, instance_id, num_customers):
    """Imprime en la salida estándar el reporte detallado de carga, descarga y handling del camión para cada cliente"""
    print("\n" + "="*80)
    print(f" DETALLE DE CARGA, DESCARGA Y HANDLING POR CLIENTE (TSPPD-H)")
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
    print(f"• Objetos tipo β a bordo: 0 objetos (ninguna recolección todavía)")
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
        
        # Slots al llegar
        slots_in = step["slotsArrival"]
        alpha_in = [k for k in positions if slots_in[k-1] == "A"]
        beta_in = [k for k in positions if slots_in[k-1] == "B"]
        empty_in = [k for k in positions if slots_in[k-1] == "EMPTY"]
        occ_in = len(alpha_in) + len(beta_in)
        
        # Slots al salir
        slots_out = step["slotsDeparture"]
        alpha_out = [k for k in positions if slots_out[k-1] == "A"]
        beta_out = [k for k in positions if slots_out[k-1] == "B"]
        empty_out = [k for k in positions if slots_out[k-1] == "EMPTY"]
        occ_out = len(alpha_out) + len(beta_out)
        
        succ_n = step["succ"]
        succ_label = "Depósito (Nodo 0)" if succ_n == 0 else f"Cliente {succ_n}"
        
        k_max = step["kMax"]
        re_b = step["rehandledB"]
        re_a = step["rehandledA"]
        num_re = len(re_b) + len(re_a)
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
        print(f"   - Objetos tipo α (entregas pendientes): {len(alpha_in)} unidades (Slots: {format_slot_ranges(alpha_in)})")
        print(f"   - Objetos tipo β (recolecciones previas): {len(beta_in)} unidades (Slots: {format_slot_ranges(beta_in)})")
        print(f"   - Slots vacíos: {len(empty_in)} (Slots: {format_slot_ranges(empty_in)})")
        print(f"   - Compartimiento (Puerta -> Fondo):")
        print(f"     {format_truck_diagram(slots_in)}")
        
        print(f"\n2. OPERACIÓN DE DESCARGA:")
        print(f"   • Entrega definitiva al cliente:")
        print(f"     - Se descargan {del_a} unidades tipo α.")
        print(f"     - Slots entregados: {format_slot_ranges(del_slots)}")
        if num_re > 0:
            print(f"   • Descarga temporal por conflicto LIFO (Handling):")
            print(f"     - Profundidad requerida en el compartimiento: hasta el slot {k_max} (de {Q}).")
            print(f"     - Para acceder a la mercancía α en el fondo, se descargaron temporalmente:")
            if len(re_b) > 0:
                print(f"       * {len(re_b)} unidades tipo β que bloqueaban la puerta (Slots: {format_slot_ranges(re_b)})")
            if len(re_a) > 0:
                print(f"       * {len(re_a)} unidades tipo α de otros clientes reubicadas (Slots: {format_slot_ranges(re_a)})")
        else:
            print(f"   • Descarga temporal por conflicto LIFO:")
            print(f"     - ✅ Ninguna: Los objetos tipo α requeridos se encontraban accesibles sin obstrucción.")
            
        print(f"\n3. MANIPULACIÓN (HANDLING):")
        if num_re > 0:
            print(f"   - Operaciones de re-handling: {num_re} unidades (descargadas temporalmente y recargadas)")
            print(f"   - Costo de handling en esta parada: ${h_cost:.2f} ({num_re} ops × h={h_val})")
        else:
            print(f"   - Operaciones de re-handling: 0 unidades")
            print(f"   - Costo de handling: $0.00")
            
        print(f"\n4. OPERACIÓN DE CARGA:")
        if num_re > 0:
            print(f"   • Recarga de objetos temporales:")
            print(f"     - Se vuelven a ingresar al camión los {num_re} objetos retirados durante el handling.")
        print(f"   • Carga de recolección (nueva):")
        if pick_b > 0:
            print(f"     - Se cargan {pick_b} unidades tipo β recolectadas del Cliente {v_n} hacia el depósito.")
            print(f"     - Slots asignados: {format_slot_ranges(new_b_slots)}")
        else:
            print(f"     - Este cliente no generó recolección (0 unidades tipo β cargadas).")
            
        print(f"\n5. ESTADO DEL CAMIÓN AL SALIR (Rumbo a {succ_label}):")
        print(f"   - Ocupación: {occ_out}/{Q} unidades ({occ_out/Q*100:.1f}%)")
        print(f"   - Objetos tipo α restantes: {len(alpha_out)} unidades (Slots: {format_slot_ranges(alpha_out)})")
        print(f"   - Objetos tipo β acumulados: {len(beta_out)} unidades (Slots: {format_slot_ranges(beta_out)})")
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
    print(f"[PASO FINAL] LLEGADA AL DEPÓSITO (Nodo 0) — Fin del Recorrido")
    print("-" * 80)
    print(f"• Tramo final: Cliente {u_last} -> Depósito (Nodo 0) | Distancia: {dist_last} km")
    print(f"• Estado al llegar: 0 objetos tipo α | {len(b_final_slots)} objetos tipo β recolectados")
    print(f"• Ocupación al llegar: {len(b_final_slots)}/{Q} ({len(b_final_slots)/Q*100:.1f}%)")
    print(f"• Compartimiento al llegar (Puerta -> Fondo):")
    print(f"  {format_truck_diagram(slots_final)}")
    print(f"• DESCARGA FINAL EN DEPÓSITO:")
    print(f"  - Se descargan {len(b_final_slots)} objetos tipo β (totalidad de la mercancía recolectada).")
    print(f"  - Slots descargados: {format_slot_ranges(b_final_slots)}")
    print(f"• Estado final del camión: Completamente vacío (0/{Q} unidades).")

    # 4. RESUMEN GLOBAL
    total_ops = sum(s.get("handlingCount", 0) for s in steps)
    total_a = sum(alpha[i] for i in range(1, num_customers + 1))
    total_b = sum(beta[i] for i in range(1, num_customers + 1))
    print("\n" + "="*80)
    print(f" RESUMEN GLOBAL DE LA SOLUCIÓN")
    print("="*80)
    print(f"• Ruta óptima:              {' -> '.join(map(str, tour))}")
    print(f"• Distancia total de ruteo: {total_dist} km")
    print(f"• Costo total de handling:  ${total_handling_cost:.2f} ({total_ops} operaciones)")
    print(f"• Valor función objetivo:   ${obj_val:.2f}")
    print(f"• Total α entregadas:       {total_a} unidades")
    print(f"• Total β recolectadas:     {total_b} unidades")
    print("="*80 + "\n")

def solve_instance(num_customers=5, instance_id=1, h_val=0.1, output_dir=OUTPUTS_DIR, verbose=True, gurobi_log=False):
    """Resuelve una instancia de TSPPD-H y guarda la solución óptima en el directorio Outputs"""
    if verbose:
        print("\n" + "="*60)
        print(f" RESOLVIENDO MODELO GENERAL TSPPD-H (ECUACIONES 1-16)")
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
    h_prime = max(h_a, h_b)
            
    # 4. Crear modelo en Gurobi
    m = gp.Model(f"TSPPD-H_C{num_customers}_ID{instance_id}_H{h_val}")
    m.setParam('OutputFlag', 1 if gurobi_log else 0)
    
    # --- Variables ---
    x = m.addVars(nodes, nodes, vtype=GRB.BINARY, name="x")
    a = m.addVars(nodes, nodes, positions, vtype=GRB.BINARY, name="a")
    b = m.addVars(nodes, nodes, positions, vtype=GRB.BINARY, name="b")
    r = m.addVars(customers, positions, vtype=GRB.BINARY, name="r")
    v = m.addVars(customers, positions, vtype=GRB.CONTINUOUS, lb=0, name="v")
    u = m.addVars(nodes, vtype=GRB.CONTINUOUS, lb=0, name="u") 
    
    # Eliminar viajes a sí mismo
    for i in nodes:
        m.addConstr(x[i,i] == 0)
        for k in positions:
            m.addConstr(a[i,i,k] == 0)
            m.addConstr(b[i,i,k] == 0)
            
    # --- Función Objetivo (Ecuación 1) ---
    obj = gp.quicksum(c[i,j] * x[i,j] for i in nodes for j in nodes if i != j)
    obj += gp.quicksum(v[i,k] for i in customers for k in positions)
    const_term = sum(h_a * alpha[i] for i in customers)
    
    m.setObjective(obj - const_term, GRB.MINIMIZE)
    
    # --- Restricciones ---
    # (2) y (3) Grado
    for i in nodes:
        m.addConstr(gp.quicksum(x[i,j] for j in nodes if j != i) == 1, name=f"out_{i}")
        m.addConstr(gp.quicksum(x[j,i] for j in nodes if j != i) == 1, name=f"in_{i}")
        
    # (4) Flujo de entregas (a) a nivel de posiciones
    for i in nodes:
        m.addConstr(gp.quicksum(a[j,i,k] for j in nodes if j!=i for k in positions) - 
                    gp.quicksum(a[i,j,k] for j in nodes if j!=i for k in positions) == alpha[i], name=f"flow_a_{i}")
                    
    # (5) Flujo de recolecciones (b) a nivel de posiciones
    for i in nodes:
        m.addConstr(gp.quicksum(b[i,j,k] for j in nodes if j!=i for k in positions) - 
                    gp.quicksum(b[j,i,k] for j in nodes if j!=i for k in positions) == beta[i], name=f"flow_b_{i}")
                    
    # (6) Política LIFO en las posiciones
    for i in customers:
        for k in range(2, Q + 1):
            m.addConstr(r[i,k] <= r[i,k-1], name=f"lifo_r_{i}_{k}")
            
    # (7) Restricciones lógicas entre x, a y b en cada posición
    for i in nodes:
        for j in nodes:
            if i != j:
                for k in positions:
                    m.addConstr(a[i,j,k] + b[i,j,k] <= x[i,j], name=f"cap_k_{i}_{j}_{k}")
                    
    # (8) y (9) Relación entre mercancía a y manipulación r
    for i in customers:
        for k in positions:
            m.addConstr(gp.quicksum(a[i,j,k] for j in nodes if j!=i) - gp.quicksum(a[j,i,k] for j in nodes if j!=i) <= r[i,k])
            m.addConstr(gp.quicksum(a[j,i,k] for j in nodes if j!=i) - gp.quicksum(a[i,j,k] for j in nodes if j!=i) <= r[i,k])
            
    # (10) y (11) Relación entre mercancía b y manipulación r
    for i in customers:
        for k in positions:
            m.addConstr(gp.quicksum(b[i,j,k] for j in nodes if j!=i) - gp.quicksum(b[j,i,k] for j in nodes if j!=i) <= r[i,k])
            m.addConstr(gp.quicksum(b[j,i,k] for j in nodes if j!=i) - gp.quicksum(b[i,j,k] for j in nodes if j!=i) <= r[i,k])
            
    # (12) Linealización del costo (v_i^k)
    for i in customers:
        for k in positions:
            expr = gp.quicksum(h_a * a[j,i,k] + h_b * b[j,i,k] for j in nodes if j!=i)
            m.addConstr(v[i,k] >= expr - (1 - r[i,k]) * h_prime, name=f"v_cost_{i}_{k}")
            
    # (13) Eliminación de Subtoures (MTZ)
    for i in customers:
        for j in customers:
            if i != j:
                m.addConstr(u[i] - u[j] + (V-1)*x[i,j] <= V - 2)

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
            
        # Matriz de distancias restringida a los nodos del problema
        dist_matrix = []
        for i in nodes:
            row = []
            for j in nodes:
                row.append(c[i,j])
            dist_matrix.append(row)
            
        # Construir pasos detallados
        steps = []
        total_steps = len(tour) - 1
        
        for s in range(total_steps):
            u_node = tour[s]
            v_node = tour[s+1]
            dist = c[u_node, v_node]
            
            del_a = alpha[v_node] if v_node != 0 else 0
            pick_b = beta[v_node] if v_node != 0 else 0
            
            # Posiciones en el camión al llegar (arco u_node -> v_node)
            slots_arr = []
            a_count = 0
            b_count = 0
            alpha_in_slots = []
            beta_in_slots = []
            
            for k in positions:
                is_a = (a[u_node, v_node, k].X > 0.5)
                is_b = (b[u_node, v_node, k].X > 0.5)
                if is_a:
                    slots_arr.append("A")
                    alpha_in_slots.append(k)
                    a_count += 1
                elif is_b:
                    slots_arr.append("B")
                    beta_in_slots.append(k)
                    b_count += 1
                else:
                    slots_arr.append("EMPTY")
                    
            # Posiciones en el camión al salir (arco v_node -> succ_node)
            slots_dep = []
            alpha_out_slots = []
            beta_out_slots = []
            if v_node != 0:
                succ_node = tour[s+2]
                for k in positions:
                    is_a = (a[v_node, succ_node, k].X > 0.5)
                    is_b = (b[v_node, succ_node, k].X > 0.5)
                    if is_a:
                        slots_dep.append("A")
                        alpha_out_slots.append(k)
                    elif is_b:
                        slots_dep.append("B")
                        beta_out_slots.append(k)
                    else:
                        slots_dep.append("EMPTY")
            else:
                succ_node = None
                slots_dep = ["EMPTY"] * Q
                
            # Handling y operaciones en el nodo destino v_node
            K_max = 0
            rehandled_b = []
            rehandled_a = []
            delivered_a_slots = []
            new_b_slots = []
            h_count = 0
            h_cost = 0.0
            
            if v_node != 0:
                K_max = max([k for k in positions if r[v_node, k].X > 0.5], default=0)
                items_acc_a = [k for k in alpha_in_slots if k <= K_max]
                items_acc_b = [k for k in beta_in_slots if k <= K_max]
                
                rehandled_b = items_acc_b
                num_re_a = max(0, len(items_acc_a) - del_a)
                rehandled_a = [k for k in items_acc_a if k not in alpha_out_slots][:num_re_a] if num_re_a > 0 else []
                
                h_count = len(rehandled_b) + num_re_a
                h_cost = round(len(rehandled_b) * h_b + num_re_a * h_a, 4)
                
                delivered_a_slots = [k for k in alpha_in_slots if k not in alpha_out_slots and k not in rehandled_a]
                new_b_slots = [k for k in beta_out_slots if k not in beta_in_slots]
            
            explanation = generate_step_explanation(
                step_idx=s,
                total_steps=total_steps,
                from_node=node_defs[u_node],
                to_node=node_defs[v_node],
                dist=dist,
                deliver_a=del_a,
                pickup_b=pick_b,
                a_on_truck=a_count,
                b_on_truck=b_count,
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
                "aOnTruck": a_count,
                "bOnTruck": b_count,
                "slots": slots_arr,
                "slotsArrival": slots_arr,
                "slotsDeparture": slots_dep,
                "kMax": K_max,
                "rehandledB": rehandled_b,
                "rehandledA": rehandled_a,
                "deliveredSlots": delivered_a_slots,
                "newBSlots": new_b_slots,
                "handlingCount": h_count,
                "handlingCost": round(h_cost, 2),
                "explanation": explanation
            })
            
        # Objeto de solución completa
        solution_data = {
            "instance": f"Solucion_{num_customers}_Clientes_ID{instance_id}_H_{str(h_val).replace('.', '')}",
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
        
        # Guardar en archivo .txt
        os.makedirs(output_dir, exist_ok=True)
        h_tag = str(h_val).replace('.', '')
        filename = f"Solucion_{num_customers}_Clientes_ID{instance_id}_H_{h_tag}.txt"
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
    parser = argparse.ArgumentParser(description="Resuelve instancias TSPPD-H con Gurobi y guarda la solución en Outputs/")
    parser.add_argument("--customers", type=int, default=5, help="Número de clientes (default: 5)")
    parser.add_argument("--id", type=int, default=1, help="ID de la instancia (1 a 10)")
    parser.add_argument("--h", type=float, default=0.1, help="Parámetro de costo de manipulación h (default: 0.1)")
    parser.add_argument("--all-ids", action="store_true", help="Resolver automáticamente las instancias ID 1 hasta 10 para 5 clientes")
    parser.add_argument("--gurobi-log", action="store_true", help="Mostrar logs detallados de Gurobi Optimizer")
    
    args = parser.parse_args()
    
    if args.all_ids:
        print("="*70)
        print(f" RESOLVIENDO TODAS LAS INSTANCIAS (1 a 10) PARA {args.customers} CLIENTES (H = {args.h})")
        print("="*70)
        for i in range(1, 11):
            solve_instance(num_customers=args.customers, instance_id=i, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)
    else:
        solve_instance(num_customers=args.customers, instance_id=args.id, h_val=args.h, verbose=True, gurobi_log=args.gurobi_log)

if __name__ == '__main__':
    main()

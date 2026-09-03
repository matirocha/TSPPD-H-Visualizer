import os
import glob
import gurobipy as gp
from gurobipy import GRB

def parse_instance(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    capacity = 0
    dist_matrix = []
    demands = {}
    
    parsing_matrix = False
    parsing_demands = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('CAPACITY'):
            parts = line.split(':')
            capacity = int(parts[1].strip())
        elif line.startswith('EDGE_WEIGHT_SECTION'):
            parsing_matrix = True
            continue
        elif line.startswith('DEMAND_SECTION'):
            parsing_matrix = False
            parsing_demands = True
            continue
        elif line == 'EOF' or line.startswith('DEPOT_SECTION'):
            break
            
        if parsing_matrix:
            row = [int(x) for x in line.split()]
            dist_matrix.append(row)
            
        if parsing_demands:
            parts = [int(x) for x in line.split()]
            node_id = parts[0]
            alpha = parts[1]
            beta = parts[2]
            demands[node_id] = (alpha, beta)
            
    n_nodes = len(dist_matrix)
    
    alpha = [0] * n_nodes
    beta = [0] * n_nodes
    
    sum_alpha = 0
    sum_beta = 0
    
    for i in range(1, n_nodes):
        if i in demands:
            alpha[i] = demands[i][0]
            beta[i] = demands[i][1]
            sum_alpha += alpha[i]
            sum_beta += beta[i]
            
    # For depot (node 0), inflow - outflow = alpha_0 => -sum(alpha)
    alpha[0] = -sum_alpha
    beta[0] = -sum_beta
            
    return dist_matrix, capacity, alpha, beta, n_nodes


def solve_tsppd_h(c, Q, alpha, beta, n_nodes, h_a=0.1, h_b=0.1):
    model = gp.Model("TSPPD-H")
    
    V = list(range(n_nodes))
    Vc = list(range(1, n_nodes))
    
    # Variables
    print("Agregando variables al modelo...")
    x = model.addVars(V, V, vtype=GRB.BINARY, name="x")
    a = model.addVars(V, V, range(1, Q+1), vtype=GRB.BINARY, name="a")
    b = model.addVars(V, V, range(1, Q+1), vtype=GRB.BINARY, name="b")
    r = model.addVars(Vc, range(1, Q+1), vtype=GRB.BINARY, name="r")
    v = model.addVars(Vc, range(1, Q+1), vtype=GRB.CONTINUOUS, lb=0, name="v")
    
    for i in V:
        x[i, i].ub = 0
        for k in range(1, Q+1):
            a[i, i, k].ub = 0
            b[i, i, k].ub = 0
            
    # Objective
    h_prime = max(h_a, h_b)
    
    obj_routing = gp.quicksum(c[i][j] * x[i, j] for i in V for j in V if i != j)
    obj_handling = gp.quicksum(v[i, k] for i in Vc for k in range(1, Q+1)) - sum(h_a * alpha[i] for i in Vc)
    model.setObjective(obj_routing + obj_handling, GRB.MINIMIZE)
    
    # Constraints (2) and (3): Degree constraints
    print("Agregando restricciones de grado y conservación de flujo...")
    for i in V:
        model.addConstr(gp.quicksum(x[i, j] for j in V if i != j) == 1, name=f"deg_out_{i}")
        model.addConstr(gp.quicksum(x[j, i] for j in V if i != j) == 1, name=f"deg_in_{i}")
        
    # Constraints (4) and (5): Flow conservation
    for i in V:
        model.addConstr(gp.quicksum(a[j, i, k] - a[i, j, k] for j in V if i != j for k in range(1, Q+1)) == alpha[i], name=f"flow_a_{i}")
        model.addConstr(gp.quicksum(b[i, j, k] - b[j, i, k] for j in V if i != j for k in range(1, Q+1)) == beta[i], name=f"flow_b_{i}")
        
    # Constraint (6): LIFO policy
    print("Agregando restricciones LIFO y de ocupación...")
    for i in Vc:
        for k in range(2, Q+1):
            model.addConstr(r[i, k] <= r[i, k-1], name=f"lifo_{i}_{k}")
            
    # Constraint (7): Position occupancy
    for i in V:
        for j in V:
            if i != j:
                for k in range(1, Q+1):
                    model.addConstr(a[i, j, k] + b[i, j, k] <= x[i, j], name=f"occ_{i}_{j}_{k}")
                    
    # Constraints (8)-(11): Handling logic
    print("Agregando restricciones de manejo (handling)...")
    for i in Vc:
        for k in range(1, Q+1):
            sum_a_ij = gp.quicksum(a[i, j, k] for j in V if i != j)
            sum_a_ji = gp.quicksum(a[j, i, k] for j in V if i != j)
            sum_b_ij = gp.quicksum(b[i, j, k] for j in V if i != j)
            sum_b_ji = gp.quicksum(b[j, i, k] for j in V if i != j)
            
            model.addConstr(sum_a_ij - sum_a_ji <= r[i, k], name=f"h8_{i}_{k}")
            model.addConstr(sum_a_ji - sum_a_ij <= r[i, k], name=f"h9_{i}_{k}")
            model.addConstr(sum_b_ij - sum_b_ji <= r[i, k], name=f"h10_{i}_{k}")
            model.addConstr(sum_b_ji - sum_b_ij <= r[i, k], name=f"h11_{i}_{k}")
            
            # Constraint (12): Handling cost definition
            model.addConstr(v[i, k] >= h_a * sum_a_ji + h_b * sum_b_ji - (1 - r[i, k]) * h_prime, name=f"h12_{i}_{k}")
            
    # Subtour elimination using MTZ
    print("Agregando restricciones de eliminación de subtours (MTZ)...")
    u = model.addVars(Vc, vtype=GRB.CONTINUOUS, name="u")
    for i in Vc:
        for j in Vc:
            if i != j:
                model.addConstr(u[i] - u[j] + n_nodes * x[i, j] <= n_nodes - 1, name=f"mtz_{i}_{j}")
                
    # Optimize
    print("Iniciando optimización...")
    model.optimize()
    
    if model.status == GRB.OPTIMAL:
        print(f"\nSolución óptima encontrada: {model.objVal}")
        print("Ruta:")
        curr = 0
        tour = [0]
        while True:
            for j in V:
                if curr != j and x[curr, j].x > 0.5:
                    tour.append(j)
                    curr = j
                    break
            if curr == 0:
                break
        print(" -> ".join(map(str, tour)))
    else:
        print("\nNo se encontró solución óptima.")


def main():
    base_dir = '/Users/matiasrocha/Documents/Universidad/Taller de Investigacion'
    instance_dirs = [
        os.path.join(base_dir, 'Instancias'),
        os.path.join(base_dir, 'Instancias Generadas por IA')
    ]
        
    tsp_files = []
    for d in instance_dirs:
        if os.path.exists(d):
            tsp_files.extend(glob.glob(os.path.join(d, '*.tsp')))
            
    tsp_files.sort()
    
    if not tsp_files:
        print("No se encontraron instancias en la carpeta.")
        return
        
    print("Seleccione una instancia:")
    for idx, fpath in enumerate(tsp_files):
        print(f"{idx + 1}. {os.path.basename(fpath)}")
        
    choice = input("\nIngrese el número de la instancia a optimizar: ")
    try:
        choice = int(choice)
        if 1 <= choice <= len(tsp_files):
            selected_file = tsp_files[choice - 1]
            print(f"\nInstancia seleccionada: {os.path.basename(selected_file)}")
            print("Analizando y construyendo modelo. Esto puede tomar unos minutos debido a la gran cantidad de variables...")
            
            c, Q, alpha, beta, n_nodes = parse_instance(selected_file)
            
            # As per the paper (Table 1), let's use h = 0.1 as default
            solve_tsppd_h(c, Q, alpha, beta, n_nodes, h_a=0.1, h_b=0.1)
            
        else:
            print("Selección inválida.")
    except ValueError:
        print("Entrada inválida.")
        
if __name__ == "__main__":
    main()

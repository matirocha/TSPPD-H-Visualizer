"""
Solve a small TSPPD-H instance and output full solution details as JSON
for the HTML visualization.
"""
import json
import gurobipy as gp
from gurobipy import GRB

def parse_instance(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    capacity = 0
    dist_matrix = []
    demands = {}
    name = ""
    
    parsing_matrix = False
    parsing_demands = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('NAME'):
            name = line.split(':')[1].strip()
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
            alpha_val = parts[1]
            beta_val = parts[2]
            demands[node_id] = (alpha_val, beta_val)
            
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
            
    alpha[0] = -sum_alpha
    beta[0] = -sum_beta
            
    return dist_matrix, capacity, alpha, beta, n_nodes, name, demands


def solve_and_export(filepath, h_a=0.1, h_b=0.1):
    c, Q, alpha, beta, n_nodes, name, demands = parse_instance(filepath)
    
    model = gp.Model("TSPPD-H")
    model.setParam('OutputFlag', 0)
    
    V = list(range(n_nodes))
    Vc = list(range(1, n_nodes))
    
    # Variables
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
    
    # Constraints
    for i in V:
        model.addConstr(gp.quicksum(x[i, j] for j in V if i != j) == 1)
        model.addConstr(gp.quicksum(x[j, i] for j in V if i != j) == 1)
        
    for i in V:
        model.addConstr(gp.quicksum(a[j, i, k] - a[i, j, k] for j in V if i != j for k in range(1, Q+1)) == alpha[i])
        model.addConstr(gp.quicksum(b[i, j, k] - b[j, i, k] for j in V if i != j for k in range(1, Q+1)) == beta[i])
        
    for i in Vc:
        for k in range(2, Q+1):
            model.addConstr(r[i, k] <= r[i, k-1])
            
    for i in V:
        for j in V:
            if i != j:
                for k in range(1, Q+1):
                    model.addConstr(a[i, j, k] + b[i, j, k] <= x[i, j])
                    
    for i in Vc:
        for k in range(1, Q+1):
            sum_a_ij = gp.quicksum(a[i, j, k] for j in V if i != j)
            sum_a_ji = gp.quicksum(a[j, i, k] for j in V if i != j)
            sum_b_ij = gp.quicksum(b[i, j, k] for j in V if i != j)
            sum_b_ji = gp.quicksum(b[j, i, k] for j in V if i != j)
            
            model.addConstr(sum_a_ij - sum_a_ji <= r[i, k])
            model.addConstr(sum_a_ji - sum_a_ij <= r[i, k])
            model.addConstr(sum_b_ij - sum_b_ji <= r[i, k])
            model.addConstr(sum_b_ji - sum_b_ij <= r[i, k])
            
            model.addConstr(v[i, k] >= h_a * sum_a_ji + h_b * sum_b_ji - (1 - r[i, k]) * h_prime)
            
    u = model.addVars(Vc, vtype=GRB.CONTINUOUS, name="u")
    for i in Vc:
        for j in Vc:
            if i != j:
                model.addConstr(u[i] - u[j] + n_nodes * x[i, j] <= n_nodes - 1)
                
    model.optimize()
    
    if model.status != GRB.OPTIMAL:
        print("No optimal solution found")
        return
    
    # Extract route
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
    
    # Extract flow information for each arc in the tour
    steps = []
    
    # Compute load carried on each arc
    # Track cumulative load of type a and type b
    load_a = sum(alpha[i] for i in Vc)  # Start with all alpha loaded at depot
    load_b = 0  # Start with no beta
    
    for step_idx in range(len(tour) - 1):
        i = tour[step_idx]
        j = tour[step_idx + 1]
        
        # Count items of type a and b on this arc
        a_on_arc = 0
        b_on_arc = 0
        a_positions = []
        b_positions = []
        for k in range(1, Q+1):
            if a[i, j, k].x > 0.5:
                a_on_arc += 1
                a_positions.append(k)
            if b[i, j, k].x > 0.5:
                b_on_arc += 1
                b_positions.append(k)
        
        # Get demands at destination j
        alpha_j = alpha[j] if j != 0 else 0
        beta_j = beta[j] if j != 0 else 0
        
        step_info = {
            "from": i,
            "to": j,
            "distance": c[i][j],
            "items_a_on_truck": a_on_arc,
            "items_b_on_truck": b_on_arc,
            "a_positions": a_positions,
            "b_positions": b_positions,
            "deliver_a_at_dest": alpha_j if alpha_j > 0 else 0,
            "pickup_b_at_dest": beta_j if beta_j > 0 else 0,
        }
        steps.append(step_info)
    
    # Build node info
    nodes = []
    for i in range(n_nodes):
        node_info = {
            "id": i,
            "alpha": demands.get(i, (0,0))[0] if i > 0 else 0,
            "beta": demands.get(i, (0,0))[1] if i > 0 else 0,
            "is_depot": i == 0,
            "label": "Depósito" if i == 0 else f"Cliente {i}"
        }
        nodes.append(node_info)
    
    # Handle special last node (pure pickup)
    last_customer_idx = n_nodes - 1
    
    result = {
        "instance_name": name,
        "n_nodes": n_nodes,
        "n_customers": n_nodes - 2,  # excluding depot and special last node
        "capacity": Q,
        "objective_value": round(model.objVal, 2),
        "tour": tour,
        "nodes": nodes,
        "steps": steps,
        "distance_matrix": c,
        "h_a": h_a,
        "h_b": h_b,
        "total_distance": sum(c[tour[i]][tour[i+1]] for i in range(len(tour)-1))
    }
    
    return result


if __name__ == "__main__":
    import sys
    
    # Solve the 5-client instance (good size for visualization)
    filepath = "/Users/matiasrocha/Documents/Universidad/Taller de Investigacion/Instancias Generadas por IA/IA_05_clientes.tsp"
    
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    
    result = solve_and_export(filepath)
    if result:
        print(json.dumps(result, indent=2))
